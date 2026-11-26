//! Watching the exchanges for alerts, so one fires with no browser open.
//!
//! The page still watches the prices it holds anyway — that is what makes an
//! alert feel instant — but a closed browser watches nothing, and the alert
//! nobody is looking at is the one worth keeping. So every market with an
//! active alert is followed here on its exchange's public trade stream, and a
//! price that meets an alert's condition takes the same two statements the
//! API's own trigger takes: the alert stops, the log gains a line. Whichever
//! side notices first wins; the other finds it already stopped and writes
//! nothing.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::watch;
use tokio::time::{sleep, sleep_until, Instant};
use tokio_tungstenite::tungstenite::Message;
use tradoor_store::now_ms;
use tradoor_venues::{MarketRef, Venue};

use crate::alerts;
use crate::catalog::Catalog;
use crate::dns::Doh;
use crate::telegram::{self, Telegram};
use crate::trades::{self, stream_urls};

/// How often the alerts to watch are read again.
const REFRESH: Duration = Duration::from_secs(10);
const RETRY_SECS: [u64; 5] = [1, 3, 5, 10, 30];
/// Nothing at all from an exchange for this long means the socket is gone.
const SILENCE: Duration = Duration::from_secs(90);
/// Answering but carrying no trade for this long means the address is a dead
/// end — one of Binance's two took our subscription and then sent nothing — so
/// the next one is tried. A market that truly is this quiet loses only a
/// reconnection by it.
const NO_TRADES: Duration = Duration::from_secs(150);
/// Bybit closes a socket that says nothing for 20 seconds.
const PING: Duration = Duration::from_secs(15);
/// Markets followed on one exchange. Past this the page is on its own: a server
/// holding thousands of alerts should not open a subscription for each.
const MAX_SYMBOLS: usize = 200;
/// A trade older than this is an exchange's look back on subscribing, not the
/// price now: Gate's perpetuals open with the last hundred seconds or so, and a
/// level met and left in that time has not been met.
const STALE_MS: i64 = 15_000;

/// An alert as the watcher needs it: who it belongs to, and when it fires.
#[derive(Clone, Debug, PartialEq)]
pub struct Watched {
    pub id: i64,
    pub owner: String,
    pub market: String,
    pub venue: Venue,
    pub symbol: String,
    pub condition: String,
    pub price: f64,
}

/// Whether a move from `prev` to `cur` meets `condition` at `level`: the rule
/// the page follows. A cross needs a price on each
/// side, so the first price only arms it; reaching the level exactly counts.
pub fn fires(condition: &str, level: f64, prev: Option<f64>, cur: f64) -> bool {
    match condition {
        "greater" => cur > level,
        "less" => cur < level,
        "crossing_up" => prev.is_some_and(|p| p < level) && cur >= level,
        "crossing_down" => prev.is_some_and(|p| p > level) && cur <= level,
        "crossing" => prev.is_some_and(|p| (p < level && cur >= level) || (p > level && cur <= level)),
        _ => false,
    }
}

/// Whether a trade's time, 0 if the frame's is not read, puts it in the past.
fn stale(at: i64, now: i64) -> bool {
    at > 0 && now - at > STALE_MS
}

/// The venues whose trades this server follows, and so the ones whose alerts
/// fire with no browser open: every one with a trade stream, which leaves out
/// only the indices, which nothing trades.
fn venues() -> impl Iterator<Item = Venue> {
    Venue::ALL.into_iter().filter(|v| !stream_urls(*v).is_empty())
}

/// Follow every market with an active alert, for as long as the server runs.
/// An exchange no alert names opens no socket: its task only waits.
pub fn start(pool: deadpool_postgres::Pool, doh: Arc<Doh>, catalog: Arc<Catalog>, telegram: Option<Arc<Telegram>>) {
    let (tx, rx) = watch::channel(Arc::new(Vec::<Watched>::new()));
    tokio::spawn(refresh(pool.clone(), tx));
    for venue in venues() {
        tokio::spawn(follow(venue, pool.clone(), doh.clone(), catalog.clone(), telegram.clone(), rx.clone()));
    }
    tracing::info!(venues = ?venues().map(Venue::id).collect::<Vec<_>>(), "watching alerts");
}

/// The active alerts, read again every few seconds: one added on a phone is
/// watched here within that, without the page telling the server anything.
async fn refresh(pool: deadpool_postgres::Pool, tx: watch::Sender<Arc<Vec<Watched>>>) {
    loop {
        match read(&pool).await {
            Ok(list) => {
                tx.send_if_modified(|current| {
                    let same = current.as_slice() == list.as_slice();
                    if !same {
                        *current = Arc::new(list);
                    }
                    !same
                });
            }
            Err(e) => tracing::warn!(error = %e, "reading alerts to watch"),
        }
        if tx.is_closed() {
            return;
        }
        sleep(REFRESH).await;
    }
}

async fn read(pool: &deadpool_postgres::Pool) -> anyhow::Result<Vec<Watched>> {
    let client = pool.get().await?;
    let rows = client.query("SELECT id, owner, market, condition, price FROM alert WHERE active ORDER BY id", &[]).await?;
    Ok(rows
        .iter()
        .filter_map(|r| {
            let market: String = r.get(2);
            let m = MarketRef::parse(&market)?;
            (!stream_urls(m.venue).is_empty()).then_some(())?;
            Some(Watched { id: r.get(0), owner: r.get(1), market, venue: m.venue, symbol: m.symbol, condition: r.get(3), price: r.get(4) })
        })
        .collect())
}

/// The symbols one venue is asked for, in a settled order so an unchanged set
/// never looks like a change.
fn symbols_of(venue: Venue, alerts: &[Watched]) -> Vec<String> {
    let mut symbols: Vec<String> = alerts.iter().filter(|a| a.venue == venue).map(|a| a.symbol.clone()).collect();
    symbols.sort_unstable();
    symbols.dedup();
    symbols.truncate(MAX_SYMBOLS.min(trades::most_symbols(venue)));
    symbols
}

/// Keeps one exchange connected while any alert names it.
async fn follow(venue: Venue, pool: deadpool_postgres::Pool, doh: Arc<Doh>, catalog: Arc<Catalog>, telegram: Option<Arc<Telegram>>, mut alerts: watch::Receiver<Arc<Vec<Watched>>>) {
    let urls = stream_urls(venue);
    if urls.is_empty() {
        return;
    }
    let (mut attempt, mut at) = (0, 0);
    loop {
        let url = urls[at % urls.len()];
        let symbols = symbols_of(venue, &alerts.borrow_and_update().clone());
        if symbols.is_empty() {
            // Nothing to watch here: wait until an alert names this exchange.
            if alerts.changed().await.is_err() {
                return;
            }
            continue;
        }
        match session(venue, url, &symbols, &pool, &doh, &catalog, telegram.as_ref(), &mut alerts).await {
            Ok(()) => attempt = 0,
            Err(e) => {
                tracing::warn!(venue = venue.id(), url, error = %e, "alert stream lost");
                sleep(Duration::from_secs(RETRY_SECS[attempt.min(RETRY_SECS.len() - 1)])).await;
                (attempt, at) = (attempt + 1, at + 1);
            }
        }
    }
}

/// One connection, until the exchange ends it or the markets to watch change.
async fn session(
    venue: Venue,
    url: &str,
    symbols: &[String],
    pool: &deadpool_postgres::Pool,
    doh: &Doh,
    catalog: &Catalog,
    telegram: Option<&Arc<Telegram>>,
    alerts: &mut watch::Receiver<Arc<Vec<Watched>>>,
) -> anyhow::Result<()> {
    // OKX and Hyperliquid answer in their own names, so ask in them and keep
    // the way back: a trade has to land on the market the alert names.
    let native = if trades::renames(venue) { catalog.native_names(venue, symbols).await } else { HashMap::new() };
    let ours: HashMap<String, String> = native.iter().map(|(ours, theirs)| (theirs.clone(), ours.clone())).collect();
    let asked: Vec<String> = symbols.iter().map(|s| native.get(s).cloned().unwrap_or_else(|| s.clone())).collect();

    let connect = doh.connect_ws(url);
    let mut ws = tokio::time::timeout(Duration::from_secs(15), connect).await.map_err(|_| anyhow::anyhow!("connecting timed out"))??;
    for frame in trades::subscribe(venue, &asked) {
        ws.send(Message::text(frame)).await?;
    }
    tracing::info!(venue = venue.id(), markets = symbols.len(), "watching alert prices");

    let (mut heard, mut traded) = (Instant::now(), Instant::now());
    let mut ping = tokio::time::interval(PING);
    ping.reset();
    // Each market's alerts under the exchange's own name for it, so a trade
    // costs one lookup, and a trade on a market whose alerts have all gone is
    // passed over without a look at any.
    let mut markets = Markets::of(venue, &ours, &alerts.borrow_and_update());
    // Alerts already fired here, so a level that stays met is reported once.
    let mut fired: HashSet<i64> = HashSet::new();
    let mut channels = trades::Channels::default();
    loop {
        tokio::select! {
            frame = ws.next() => {
                let Some(frame) = frame else { return Ok(()) };
                heard = Instant::now();
                let text = match frame? {
                    Message::Text(text) => text.to_string(),
                    Message::Binary(bytes) if trades::gzipped(venue) => match tradoor_codec::partition::gunzip(&bytes) {
                        Ok(raw) => String::from_utf8_lossy(&raw).into_owned(),
                        Err(_) => continue,
                    },
                    Message::Close(_) => return Ok(()),
                    _ => continue,
                };
                if let Some(answer) = trades::reply(venue, &text) {
                    ws.send(Message::text(answer)).await?;
                }
                let text = channels.named(venue, text);
                let now = now_ms();
                for (theirs, price, _, _, at) in trades::timed_prints(venue, &text) {
                    traded = Instant::now();
                    if stale(at, now) {
                        continue;
                    }
                    let Some(market) = markets.get_mut(theirs.as_str()) else { continue };
                    let prev = market.last.replace(price);
                    // Between the nearest levels nothing can fire: most trades end here.
                    if !market.may_fire(prev, price) {
                        continue;
                    }
                    market.fresh = false;
                    let due: Vec<Watched> = market.alerts.iter().filter(|a| !fired.contains(&a.id) && fires(&a.condition, a.price, prev, price)).cloned().collect();
                    for alert in due {
                        fired.insert(alert.id);
                        if let Err(e) = trigger(pool, telegram, &alert, price, prev).await {
                            tracing::warn!(alert = alert.id, error = %e, "recording an alert trigger");
                        }
                    }
                }
            }
            changed = alerts.changed() => {
                changed?;
                let list = alerts.borrow_and_update().clone();
                let now_wanted = symbols_of(venue, &list);
                // A market newly wanted needs a subscription, so the socket starts
                // over; one no longer wanted only goes quiet here, until they are
                // more than the markets still wanted.
                let added = now_wanted.iter().any(|s| !symbols.contains(s));
                let unused = symbols.iter().filter(|s| !now_wanted.contains(s)).count();
                if added || unused > now_wanted.len() {
                    return Ok(());
                }
                markets.refill(venue, &ours, &list);
                // An alert that is gone from the list has stopped: forget it, so
                // the same id made active again is watched afresh.
                fired.retain(|id| list.iter().any(|a| a.id == *id));
            }
            _ = ping.tick() => {
                if let Some(frame) = trades::ping(venue) {
                    ws.send(Message::text(frame)).await?;
                }
            }
            () = sleep_until(heard + SILENCE) => anyhow::bail!("nothing heard for {} seconds", SILENCE.as_secs()),
            () = sleep_until(traded + NO_TRADES) => anyhow::bail!("no trade in {} seconds", NO_TRADES.as_secs()),
        }
    }
}

/// One market's alerts on a socket, and the price before the last.
struct Market {
    alerts: Vec<Watched>,
    /// Their levels, lowest first.
    levels: Vec<f64>,
    last: Option<f64>,
    /// Alerts came or changed since the last trade: the next one looks at all.
    fresh: bool,
}

impl Market {
    /// Whether a move from `prev` to `price` can meet any condition here. A
    /// level is met only where the move reaches it: a cross needs it between
    /// the two, and Greater or Less, met before, has fired before. So a move
    /// that touches no level is passed over, and that is nearly every trade.
    fn may_fire(&self, prev: Option<f64>, price: f64) -> bool {
        let Some(prev) = prev else { return true };
        if self.fresh {
            return true;
        }
        let (lo, hi) = if prev <= price { (prev, price) } else { (price, prev) };
        let first = self.levels.partition_point(|l| *l < lo);
        self.levels.get(first).is_some_and(|l| *l <= hi)
    }
}

/// A socket's markets, by the exchange's name for each.
struct Markets(HashMap<String, Market>);

impl Markets {
    fn of(venue: Venue, ours: &HashMap<String, String>, list: &[Watched]) -> Self {
        let mut m = Markets(HashMap::new());
        m.refill(venue, ours, list);
        m
    }

    /// The alerts again, each under its market, keeping the prices heard.
    fn refill(&mut self, venue: Venue, ours: &HashMap<String, String>, list: &[Watched]) {
        let theirs: HashMap<&str, &str> = ours.iter().map(|(t, o)| (o.as_str(), t.as_str())).collect();
        for market in self.0.values_mut() {
            market.alerts.clear();
        }
        for a in list.iter().filter(|a| a.venue == venue) {
            let name = theirs.get(a.symbol.as_str()).copied().unwrap_or(a.symbol.as_str());
            self.0.entry(name.to_string()).or_insert_with(|| Market { alerts: Vec::new(), levels: Vec::new(), last: None, fresh: true }).alerts.push(a.clone());
        }
        self.0.retain(|_, m| !m.alerts.is_empty());
        for market in self.0.values_mut() {
            market.levels = market.alerts.iter().map(|a| a.price).collect();
            market.levels.sort_unstable_by(f64::total_cmp);
            market.fresh = true;
        }
    }

    fn get_mut(&mut self, theirs: &str) -> Option<&mut Market> {
        self.0.get_mut(theirs)
    }
}

async fn trigger(pool: &deadpool_postgres::Pool, telegram: Option<&Arc<Telegram>>, alert: &Watched, value: f64, approach: Option<f64>) -> anyhow::Result<()> {
    let client = pool.get().await?;
    let now = now_ms();
    let Some((fired, _)) = alerts::record_trigger(&client, &alert.owner, alert.id, value, now, approach).await? else { return Ok(()) };
    tracing::info!(alert = alert.id, market = %alert.market, condition = %alert.condition, level = alert.price, value, "alert fired");
    telegram::notify_fired(telegram, &alert.owner, &fired, value, now, approach).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_level_fires_the_way_the_page_fires_it() {
        assert!(fires("greater", 100.0, None, 101.0) && !fires("greater", 100.0, None, 100.0));
        assert!(fires("less", 100.0, Some(101.0), 99.0) && !fires("less", 100.0, None, 100.0));
        assert!(!fires("crossing_up", 100.0, None, 101.0), "the first price only arms a cross");
        assert!(fires("crossing_up", 100.0, Some(99.0), 100.0), "reaching the level counts");
        assert!(!fires("crossing_up", 100.0, Some(101.0), 102.0));
        assert!(fires("crossing_down", 100.0, Some(101.0), 100.0) && !fires("crossing_down", 100.0, Some(99.0), 98.0));
        assert!(fires("crossing", 100.0, Some(99.0), 101.0) && fires("crossing", 100.0, Some(101.0), 99.0));
        assert!(!fires("crossing", 100.0, Some(101.0), 102.0) && !fires("nonsense", 100.0, Some(1.0), 200.0));
    }

    /// Needs a Postgres at DATABASE_URL with the schema applied; run with
    /// `cargo test -p tradoor-server -- --ignored`.
    #[tokio::test]
    #[ignore = "needs a Postgres at DATABASE_URL"]
    async fn an_alert_fires_once_however_many_watchers_report_it() {
        let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
        let pool = deadpool_postgres::Config { url: Some(url), ..Default::default() }.create_pool(Some(deadpool_postgres::Runtime::Tokio1), tokio_postgres::NoTls).unwrap();
        const OWNER: &str = "zz-test-watcher";
        let client = pool.get().await.unwrap();
        client.execute("DELETE FROM alert_log WHERE owner = $1", &[&OWNER]).await.unwrap();
        client.execute("DELETE FROM alert WHERE owner = $1", &[&OWNER]).await.unwrap();

        let now = now_ms();
        let id: i64 = client
            .query_one("INSERT INTO alert (owner, market, condition, price, created_at) VALUES ($1, 'binance-perp:BTCUSDT', 'greater', 100, $2) RETURNING id", &[&OWNER, &now])
            .await
            .unwrap()
            .get(0);

        let first = alerts::record_trigger(&client, OWNER, id, 101.0, now, Some(99.0)).await.unwrap();
        assert!(first.is_some(), "the price met the level");
        let again = alerts::record_trigger(&client, OWNER, id, 102.0, now + 1, None).await.unwrap();
        assert!(again.is_none(), "the page reporting the same cross writes nothing");

        let row = client.query_one("SELECT active, trigger_price FROM alert WHERE id = $1", &[&id]).await.unwrap();
        assert_eq!((row.get::<_, bool>(0), row.get::<_, f64>(1)), (false, 101.0));
        let log = client.query_one("SELECT count(*), min(start_price) FROM alert_log WHERE owner = $1", &[&OWNER]).await.unwrap();
        assert_eq!(log.get::<_, i64>(0), 1, "one line, from the watcher that got there first");
        assert_eq!(log.get::<_, Option<f64>>(1), Some(99.0), "the price it came from, for an alert that kept none");

        client.execute("DELETE FROM alert_log WHERE owner = $1", &[&OWNER]).await.unwrap();
        client.execute("DELETE FROM alert WHERE owner = $1", &[&OWNER]).await.unwrap();
    }

    fn watched(id: i64, venue: Venue, symbol: &str, condition: &str, price: f64) -> Watched {
        Watched { id, owner: "o".into(), market: format!("{}:{symbol}", venue.id()), venue, symbol: symbol.into(), condition: condition.into(), price }
    }

    #[test]
    fn every_traded_venue_is_watched_bingx_and_blofin_too() {
        let all: Vec<Venue> = venues().collect();
        assert!(all.contains(&Venue::BingxPerp) && all.contains(&Venue::BingxSpot) && all.contains(&Venue::BlofinPerp));
        assert!(!all.contains(&Venue::Index), "nothing trades on an index");
    }

    #[test]
    fn a_trade_looks_at_its_markets_alerts_only_when_it_reaches_a_level() {
        let ours: HashMap<String, String> = [("BTC-USDT".to_string(), "BTCUSDT".to_string())].into();
        let list = [watched(1, Venue::BlofinPerp, "BTCUSDT", "crossing_up", 100.0), watched(2, Venue::BlofinPerp, "BTCUSDT", "less", 90.0), watched(3, Venue::BingxPerp, "BTCUSDT", "greater", 1.0)];
        let mut markets = Markets::of(Venue::BlofinPerp, &ours, &list);
        assert!(markets.get_mut("BTCUSDT").is_none(), "kept under BloFin's own name");
        let m = markets.get_mut("BTC-USDT").expect("the market");
        assert_eq!((m.alerts.len(), m.levels.as_slice()), (2, &[90.0, 100.0][..]), "another exchange's alert is not here");
        assert!(m.may_fire(None, 95.0), "a first price is looked at");
        assert!(m.may_fire(Some(95.0), 96.0), "fresh alerts are looked at once");
        m.fresh = false;
        assert!(!m.may_fire(Some(95.0), 96.0), "between the levels nothing can fire");
        assert!(m.may_fire(Some(99.0), 101.0) && m.may_fire(Some(91.0), 89.0) && m.may_fire(Some(99.0), 100.0), "reaching or passing a level is looked at");
        assert!(!m.may_fire(Some(101.0), 150.0), "above every level, moving away");
        markets.refill(Venue::BlofinPerp, &ours, &list[..1]);
        assert_eq!(markets.get_mut("BTC-USDT").map(|m| (m.levels.clone(), m.fresh)), Some((vec![100.0], true)));
        markets.refill(Venue::BlofinPerp, &ours, &[]);
        assert!(markets.get_mut("BTC-USDT").is_none(), "a market whose alerts are gone is dropped");
    }

    #[test]
    fn a_venue_is_asked_for_each_of_its_markets_once() {
        let alert = |id: i64, venue: Venue, symbol: &str| Watched {
            id,
            owner: "o".into(),
            market: format!("{}:{symbol}", venue.id()),
            venue,
            symbol: symbol.into(),
            condition: "crossing".into(),
            price: 1.0,
        };
        let list = [alert(1, Venue::BinancePerp, "BTCUSDT"), alert(2, Venue::BybitPerp, "SOLUSDT"), alert(3, Venue::BinancePerp, "BTCUSDT"), alert(4, Venue::BinancePerp, "ETHUSDT")];
        assert_eq!(symbols_of(Venue::BinancePerp, &list), ["BTCUSDT", "ETHUSDT"]);
        assert_eq!(symbols_of(Venue::BybitPerp, &list), ["SOLUSDT"]);
        assert!(symbols_of(Venue::BybitSpot, &list).is_empty());
    }
}
