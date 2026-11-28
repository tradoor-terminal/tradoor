//! IHSG, the IDX Composite: daily bars since 1990 from Yahoo Finance's chart
//! answer for `^JKSE`. It is not the exchange's own feed.
//!
//! Only closed days are kept, so it moves once a day: Yahoo is read after
//! Jakarta's close, at 17:00, and again at 20:00 for a day that came late or
//! was corrected. The server's start reads the whole history.
//!
//! Kept in partition files (docs/format.md), a year to a file, under
//! `{data}/series/`, not in the database. Unlike the markets' partitions this
//! year's is written again each day. All of it is held in memory (some nine
//! thousand bars) and folded into weeks and months as they are asked for.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::RwLock;

use anyhow::{anyhow, bail};
use serde_json::Value;
use tradoor_codec::{Period, RawCandle, Tier, TickCandles};
use tradoor_core::{Candle, Interval};
use tradoor_store::{now_ms, DataDir};
use tradoor_venues::{MarketRef, Venue};

pub const SYMBOL: &str = "IHSG";

const CHART: &str = "https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=1d";
/// Yahoo's first bar is 6 April 1990; a `period2` past any date asks up to now.
const WHOLE: &str = "period1=639000000&period2=9999999999";
/// Enough to cover the longest holiday and any late correction.
const RECENT: &str = "range=1mo";

const HOUR: i64 = 3_600_000;
const DAY: i64 = 24 * HOUR;
/// When Yahoo is read, in UTC: 17:00 and 20:00 in Jakarta (UTC+7).
const READS: [i64; 2] = [10 * HOUR, 13 * HOUR];
/// Unread for this long, the whole history is asked for again: `RECENT` would
/// soon no longer reach back to what is kept.
const STALE: i64 = 20 * DAY;

/// A day opens at midnight UTC here, and has closed once the first read is due.
fn closed(open_time: i64, now: i64) -> bool {
    now >= open_time + READS[0]
}

/// The latest weekday read at or before `now`. The exchange's holidays are not
/// known here: a read on one brings nothing new.
fn last_due(now: i64) -> i64 {
    (0..4)
        .map(|back| now.div_euclid(DAY) - back)
        .filter(|day| (day + 3).rem_euclid(7) < 5)
        .flat_map(|day| READS.iter().rev().map(move |at| day * DAY + at))
        .find(|&at| at <= now)
        .unwrap_or(0)
}

pub struct Ihsg {
    dir: DataDir,
    market: MarketRef,
    days: RwLock<TickCandles>,
    /// When this process last read Yahoo; 0 before it has.
    read: AtomicI64,
}

impl Ihsg {
    /// What the files hold; one that cannot be read is left out until Yahoo is next read whole.
    pub fn open(data_dir: &Path) -> anyhow::Result<Self> {
        let dir = DataDir::new(data_dir.join("series"));
        let market = MarketRef::new(Venue::Index, SYMBOL).ok_or_else(|| anyhow!("{SYMBOL} is no symbol"))?;
        let days = load(&dir, &market);
        Ok(Self { dir, market, days: RwLock::new(days), read: AtomicI64::new(0) })
    }

    /// Whether a read has come due since the last one that worked.
    pub fn due(&self, now: i64) -> bool {
        let read = self.read.load(Ordering::Relaxed);
        read == 0 || read < last_due(now)
    }

    /// Read Yahoo and keep the closed days that are new or corrected.
    pub async fn refresh(&self, http: &reqwest::Client) -> anyhow::Result<()> {
        let now = now_ms();
        let range = if now - self.read.load(Ordering::Relaxed) > STALE { WHOLE } else { RECENT };
        let url = format!("{CHART}&{range}");
        let resp = http.get(&url).send().await?;
        let status = resp.status();
        let body = resp.text().await?;
        if !status.is_success() {
            bail!("{status} from {url}");
        }
        self.keep(yahoo_days(&serde_json::from_str(&body)?, now)?)?;
        self.read.store(now, Ordering::Relaxed);
        Ok(())
    }

    /// Merge `fresh` in, writing the years whose bars moved.
    fn keep(&self, fresh: TickCandles) -> anyhow::Result<()> {
        if fresh.is_empty() {
            return Ok(());
        }
        let old = self.days.read().unwrap_or_else(|e| e.into_inner()).clone();
        let all = TickCandles::merge(&[old.clone(), fresh.clone()])?.ok_or_else(|| anyhow!("nothing to merge"))?;
        let mut years: Vec<Period> = fresh.open_time.iter().map(|&t| Period::containing(t, Tier::Year)).collect();
        years.dedup();
        for year in years {
            let part = all.slice(year.start(), year.end());
            if part != old.slice(year.start(), year.end()) {
                self.dir.write(&self.market, Interval::D1, year, &part)?;
            }
        }
        *self.days.write().unwrap_or_else(|e| e.into_inner()) = all;
        Ok(())
    }

    /// The bars of a length opening from `start` to `end`: the first `limit`
    /// of them when `start` is given, else the last. Counted in bars rather
    /// than time, so a holiday leaves no answer empty. None shorter than a day.
    pub fn bars(&self, interval: Interval, start: Option<i64>, end: Option<i64>, limit: usize) -> Vec<Candle> {
        let days = self.days.read().unwrap_or_else(|e| e.into_inner());
        let folded = match interval {
            Interval::D1 => days.to_candles(),
            Interval::W1 | Interval::Mo1 => days.aggregate(interval).to_candles(),
            _ => return Vec::new(),
        };
        let from = start.map_or(0, |s| folded.partition_point(|c| c.open_time < s));
        let to = end.map_or(folded.len(), |e| folded.partition_point(|c| c.open_time <= e)).max(from);
        let range = &folded[from..to];
        let cut = range.len().saturating_sub(limit);
        if start.is_some() { range[..range.len() - cut].to_vec() } else { range[cut..].to_vec() }
    }
}

fn load(dir: &DataDir, market: &MarketRef) -> TickCandles {
    let parts: Vec<TickCandles> = dir
        .periods(market, Interval::D1)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|year| match dir.read(market, Interval::D1, year) {
            Ok(part) => part,
            Err(e) => {
                tracing::warn!(error = %e, year = year.name(), "reading an IHSG partition");
                None
            }
        })
        .collect();
    TickCandles::merge(&parts).ok().flatten().unwrap_or_else(|| TickCandles::empty(Interval::D1))
}

/// Yahoo's chart answer as the days closed by `now`, to the index's two
/// decimals. A row without all four prices (a holiday) is left out, as is the
/// day still trading.
fn yahoo_days(answer: &Value, now: i64) -> anyhow::Result<TickCandles> {
    let result = &answer["chart"]["result"][0];
    let quote = &result["indicators"]["quote"][0];
    if quote.is_null() {
        bail!("no bars in Yahoo's answer: {}", answer["chart"]["error"]);
    }
    // A range with no trading in it has no times at all.
    let Some(times) = result["timestamp"].as_array() else { return Ok(TickCandles::empty(Interval::D1)) };
    // By day: of two rows of one, the later is the newer.
    let mut days = BTreeMap::new();
    for (i, t) in times.iter().enumerate() {
        let price = |key: &str| quote[key][i].as_f64().filter(|v| v.is_finite() && *v > 0.0);
        let (Some(t), Some(open), Some(high), Some(low), Some(close)) = (t.as_i64(), price("open"), price("high"), price("low"), price("close")) else { continue };
        let day = Interval::D1.align(t * 1000);
        if closed(day, now) {
            let prices = [open, high.max(open).max(close), low.min(open).min(close), close].map(|p| format!("{p:.2}"));
            days.insert(day, (prices, quote["volume"][i].as_u64().unwrap_or(0).to_string()));
        }
    }
    let rows: Vec<RawCandle<'_>> = days
        .iter()
        .map(|(t, ([open, high, low, close], volume))| RawCandle { open_time: *t, open, high, low, close, volume, quote_volume: None, taker_buy_volume: None, trades: None })
        .collect();
    Ok(TickCandles::from_raw(Interval::D1, &rows)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 09:00 in Jakarta on Friday 27 November 2026, and that day's midnight UTC.
    const OPEN: i64 = 1_795_744_800;
    const FRIDAY: i64 = 1_795_737_600_000;

    fn answer(times: &[i64], close: &[Option<f64>]) -> Value {
        serde_json::json!({ "chart": { "result": [{ "timestamp": times, "indicators": { "quote": [{
            "open": close, "high": close, "low": close, "close": close, "volume": vec![7; times.len()],
        }] } }], "error": null } })
    }

    #[test]
    fn only_closed_days_are_read() {
        let rows = answer(&[OPEN - 2 * 86_400, OPEN - 86_400, OPEN, OPEN + 25_203], &[Some(5263.22509765625), None, Some(5270.0), Some(5338.458)]);
        let trading = yahoo_days(&rows, FRIDAY + 8 * HOUR).unwrap().to_candles();
        assert_eq!(trading.iter().map(|c| (c.open_time, c.close, c.volume)).collect::<Vec<_>>(), [(FRIDAY - 2 * DAY, 5263.23, 7.0)], "no holiday, not the day still trading");
        let after = yahoo_days(&rows, FRIDAY + 10 * HOUR).unwrap().to_candles();
        assert_eq!(after.last().map(|c| (c.open_time, c.close)), Some((FRIDAY, 5338.46)), "closed, with the day's newest row");
        assert!(yahoo_days(&serde_json::json!({ "chart": { "result": null, "error": { "code": "Not Found" } } }), FRIDAY).is_err());
    }

    #[test]
    fn days_are_kept_in_files_and_folded() {
        let root = std::env::temp_dir().join(format!("tradoor-ihsg-{}", std::process::id()));
        let ihsg = Ihsg::open(&root).unwrap();
        // 31 December 2025, then Thursday and Friday of the week above.
        let times = [1_767_164_400, OPEN - 86_400, OPEN];
        ihsg.keep(yahoo_days(&answer(&times, &[Some(10.0), Some(12.0), Some(11.0)]), i64::MAX / 2).unwrap()).unwrap();
        // A correction of Friday.
        ihsg.keep(yahoo_days(&answer(&[OPEN], &[Some(9.0)]), i64::MAX / 2).unwrap()).unwrap();
        let again = Ihsg::open(&root).unwrap();
        assert_eq!(again.bars(Interval::D1, None, None, 10).iter().map(|c| c.close).collect::<Vec<_>>(), [10.0, 12.0, 9.0]);
        assert_eq!(again.bars(Interval::W1, None, None, 1).iter().map(|c| (c.open, c.close)).collect::<Vec<_>>(), [(12.0, 9.0)]);
        assert_eq!(again.bars(Interval::D1, Some(0), None, 1)[0].close, 10.0, "from a start, the first");
        assert_eq!(again.bars(Interval::D1, None, Some(FRIDAY - DAY), 10).len(), 2);
        assert!(again.bars(Interval::H1, None, None, 10).is_empty() && again.bars(Interval::D1, Some(i64::MAX), Some(0), 10).is_empty());
        assert_eq!(std::fs::read_dir(root.join("series/index/IHSG/1d")).unwrap().count(), 2, "a file a year");
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn reads_come_due_after_jakarta_closes() {
        assert_eq!(last_due(FRIDAY + 10 * HOUR), FRIDAY + 10 * HOUR);
        assert_eq!(last_due(FRIDAY + 10 * HOUR - 1), FRIDAY - DAY + 13 * HOUR, "not before the close: yesterday's second");
        assert_eq!(last_due(FRIDAY + 14 * HOUR), FRIDAY + 13 * HOUR);
        assert_eq!(last_due(FRIDAY + 3 * DAY + 9 * HOUR), FRIDAY + 13 * HOUR, "none over the weekend, nor Monday before the close");
    }
}
