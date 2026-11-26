//! A footprint chart's days of minutes, folded into its bars in the browser's
//! footprint worker (web/src/lib/fp-fold-worker.ts), the way
//! web/src/lib/fp-fold.ts folds them: the same bars, rows and delta swings.
//!
//! The page hands over the server's answers as they came, the JSON's bytes
//! (`/api/footprint`, a day of minutes each, some hundred thousand price levels),
//! and they are read here as they are: no object is made in the browser for a
//! level, which reading the JSON there and adding it up cost the most of.
//!
//! Like the Frost Script module, it imports nothing: bytes in, numbers out.
//!
//! ```text
//! fp_clear()                         start again
//! fp_alloc(len) -> ptr               room for an answer's bytes, then
//! fp_add(ptr, len) -> tick           read: its tick, 0 when it names none, -1 when it is not one
//! fp_add_minutes(ptr, count, tick)   or minutes as numbers, `count` of them (a browser's own
//!                                    recordings): time, levels, then price, bought, sold a level
//! fp_free(ptr, len)
//! fp_fold(bar_ms, usd, ticks, by) -> n   fold what was read, `by` ticks a row or 0 to work it
//!                                    out; -1 when it cannot
//! fp_out() -> ptr                    n numbers: grid, fitted, by, bars, then a bar each as
//!                                    time, rows, most delta, least delta, then price, bought, sold a row
//! ```
use std::cell::RefCell;

/// Rows a typical bar is sent at most when the chart fits them to its zoom (fp-fold.ts).
const MAX_FINE_ROWS: f64 = 200.0;
/// The widest bar, in ticks, that is added up here: past it, one bad print would ask
/// for a great deal of memory, and the page's own fold does it instead.
const MAX_SPAN: i64 = 1 << 22;

/// The minutes read so far: when each starts, and where its levels lie in `levels`.
#[derive(Default)]
pub struct Minutes {
    minutes: Vec<(f64, usize, usize)>,
    /// Price, bought, sold, a level after another.
    levels: Vec<f64>,
    tick: f64,
}

/// A JSON reader for the server's answers, skipping whatever it does not need.
struct Reader<'a> {
    b: &'a [u8],
    i: usize,
}

/// Exact powers of ten: a decimal of up to fifteen digits over one of these is the
/// same double the page's own parser gives.
const POWERS: [f64; 23] = [1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22];

fn power(e: i32) -> f64 {
    let mut a = e.unsigned_abs() as usize;
    let mut p = 1.0;
    while a > 22 {
        p *= 1e22;
        a -= 22;
    }
    p * POWERS[a]
}

impl<'a> Reader<'a> {
    fn space(&mut self) {
        while self.b.get(self.i).is_some_and(|c| matches!(c, b' ' | b'\n' | b'\r' | b'\t')) {
            self.i += 1;
        }
    }

    fn eat(&mut self, c: u8) -> bool {
        self.space();
        let here = self.b.get(self.i) == Some(&c);
        self.i += usize::from(here);
        here
    }

    fn number(&mut self) -> Option<f64> {
        self.space();
        let b = self.b;
        let negative = b.get(self.i) == Some(&b'-');
        self.i += usize::from(negative);
        // Digits as a whole number while it is exact, as a double past that: the same value either way.
        let (mut whole, mut mantissa, mut scale, mut digits, mut dot) = (0u64, 0.0f64, 0i32, 0u32, false);
        while let Some(&c) = b.get(self.i) {
            if c.is_ascii_digit() {
                let d = u64::from(c - b'0');
                if digits < 19 {
                    whole = whole * 10 + d;
                } else {
                    if digits == 19 {
                        mantissa = whole as f64;
                    }
                    mantissa = mantissa * 10.0 + d as f64;
                }
                digits += 1;
                scale -= i32::from(dot);
            } else if c == b'.' && !dot {
                dot = true;
            } else {
                break;
            }
            self.i += 1;
        }
        if digits == 0 {
            return None;
        }
        if digits < 20 {
            mantissa = whole as f64;
        }
        if matches!(b.get(self.i), Some(b'e' | b'E')) {
            self.i += 1;
            let minus = b.get(self.i) == Some(&b'-');
            self.i += usize::from(minus || b.get(self.i) == Some(&b'+'));
            let mut e = 0i32;
            while let Some(&c @ b'0'..=b'9') = b.get(self.i) {
                e = e.saturating_mul(10).saturating_add(i32::from(c - b'0'));
                self.i += 1;
            }
            scale += if minus { -e } else { e };
        }
        let v = if scale < 0 { mantissa / power(scale) } else if scale > 0 { mantissa * power(scale) } else { mantissa };
        Some(if negative { -v } else { v })
    }

    /// A minute's levels, `[[price, bought, sold], …]`, straight into `out`; a row of fewer is passed over.
    /// The one loop most of the bytes go through: kept to a local index and a plain number reader.
    fn rows(&mut self, out: &mut Vec<f64>) -> Option<()> {
        let b = self.b;
        let mut i = self.i;
        let skip = |i: &mut usize| {
            while *i < b.len() && matches!(b[*i], b' ' | b'\n' | b'\r' | b'\t') {
                *i += 1;
            }
        };
        let at = |i: &mut usize, c: u8| {
            skip(i);
            let here = *i < b.len() && b[*i] == c;
            *i += usize::from(here);
            here
        };
        if !at(&mut i, b'[') {
            return None;
        }
        if !at(&mut i, b']') {
            loop {
                if !at(&mut i, b'[') {
                    return None;
                }
                let mut row = [0.0; 3];
                let mut n = 0;
                if !at(&mut i, b']') {
                    loop {
                        skip(&mut i);
                        let v = plain(b, &mut i).or_else(|| {
                            // An exponent or a long figure: the full reader.
                            self.i = i;
                            let v = self.number();
                            i = self.i;
                            v
                        })?;
                        if n < 3 {
                            row[n] = v;
                        }
                        n += 1;
                        if at(&mut i, b']') {
                            break;
                        }
                        if !at(&mut i, b',') {
                            return None;
                        }
                    }
                }
                if n >= 3 {
                    out.extend_from_slice(&row);
                }
                if at(&mut i, b']') {
                    break;
                }
                if !at(&mut i, b',') {
                    return None;
                }
            }
        }
        self.i = i;
        Some(())
    }

    /// A string's text, escapes left as they are: only keys are read, and none has one.
    fn string(&mut self) -> Option<&'a [u8]> {
        if !self.eat(b'"') {
            return None;
        }
        let start = self.i;
        while let Some(&c) = self.b.get(self.i) {
            self.i += 1;
            match c {
                b'"' => return Some(&self.b[start..self.i - 1]),
                b'\\' => self.i += 1,
                _ => {}
            }
        }
        None
    }

    /// Any value, passed over.
    fn skip(&mut self) -> Option<()> {
        self.space();
        match *self.b.get(self.i)? {
            b'"' => self.string().map(|_| ()),
            b'{' | b'[' => {
                let mut depth = 0usize;
                while let Some(&c) = self.b.get(self.i) {
                    match c {
                        b'"' => {
                            self.string()?;
                            continue;
                        }
                        b'{' | b'[' => depth += 1,
                        b'}' | b']' => {
                            depth -= 1;
                            if depth == 0 {
                                self.i += 1;
                                return Some(());
                            }
                        }
                        _ => {}
                    }
                    self.i += 1;
                }
                None
            }
            _ => {
                while self.b.get(self.i).is_some_and(|c| !matches!(c, b',' | b'}' | b']')) {
                    self.i += 1;
                }
                Some(())
            }
        }
    }

    /// An object's members, each handed to `member` with its key, which reads or skips the value.
    fn object(&mut self, mut member: impl FnMut(&mut Self, &[u8]) -> Option<()>) -> Option<()> {
        if !self.eat(b'{') {
            return None;
        }
        if self.eat(b'}') {
            return Some(());
        }
        loop {
            let key = self.string()?;
            if !self.eat(b':') {
                return None;
            }
            member(self, key)?;
            if self.eat(b'}') {
                return Some(());
            }
            if !self.eat(b',') {
                return None;
            }
        }
    }

    /// An array's items, each read by `item`.
    fn array(&mut self, mut item: impl FnMut(&mut Self) -> Option<()>) -> Option<()> {
        if !self.eat(b'[') {
            return None;
        }
        if self.eat(b']') {
            return Some(());
        }
        loop {
            item(self)?;
            if self.eat(b']') {
                return Some(());
            }
            if !self.eat(b',') {
                return None;
            }
        }
    }
}

/// A plain decimal, `-12.345`, of at most fifteen digits: the most a double holds exactly, so it
/// is the same double as the page's parser gives. `None`, with `i` where it was, for anything else.
#[inline(always)]
fn plain(b: &[u8], i: &mut usize) -> Option<f64> {
    let mut j = *i;
    let negative = j < b.len() && b[j] == b'-';
    j += usize::from(negative);
    let (mut whole, mut digits, mut decimals, mut dot) = (0u64, 0u32, 0usize, false);
    while j < b.len() {
        let c = b[j];
        if c.is_ascii_digit() {
            whole = whole * 10 + u64::from(c - b'0');
            digits += 1;
            decimals += usize::from(dot);
        } else if c == b'.' && !dot {
            dot = true;
        } else {
            break;
        }
        j += 1;
    }
    if digits == 0 || digits > 15 || (j < b.len() && matches!(b[j], b'e' | b'E')) {
        return None;
    }
    *i = j;
    let v = whole as f64 / POWERS[decimals];
    Some(if negative { -v } else { v })
}

impl Minutes {
    /// One answer's minutes added to those held. Its tick, 0 when it names none; `None` when it is no answer.
    pub fn add(&mut self, bytes: &[u8]) -> Option<f64> {
        // Some twenty bytes a number: room for them all at once, not grown as they come.
        self.levels.reserve(bytes.len() / 20);
        self.minutes.reserve(bytes.len() / 1_500);
        let mut r = Reader { b: bytes, i: 0 };
        let mut tick = 0.0;
        let (minutes, levels) = (&mut self.minutes, &mut self.levels);
        let mark = (minutes.len(), levels.len());
        let read = r.object(|r, key| match key {
            b"tick" => r.number().map(|t| tick = t),
            b"bars" => r.array(|r| {
                let (mut at, start) = (f64::NAN, levels.len());
                r.object(|r, key| match key {
                    b"at" => r.number().map(|v| at = v),
                    b"levels" => r.rows(levels),
                    _ => r.skip(),
                })?;
                if at.is_finite() {
                    minutes.push((at, start / 3, (levels.len() - start) / 3));
                } else {
                    levels.truncate(start);
                }
                Some(())
            }),
            _ => r.skip(),
        });
        if read.is_none() {
            // Half an answer is none: what it added goes.
            self.minutes.truncate(mark.0);
            self.levels.truncate(mark.1);
            return None;
        }
        if tick > 0.0 && self.tick <= 0.0 {
            self.tick = tick;
        }
        Some(tick.max(0.0))
    }

    /// Minutes as numbers: a minute's time, its count of levels, then price, bought and sold a level.
    /// False, adding nothing, where they do not add up.
    pub fn add_numbers(&mut self, f: &[f64], tick: f64) -> bool {
        let mark = (self.minutes.len(), self.levels.len());
        let mut i = 0;
        while i + 2 <= f.len() {
            let n = f[i + 1];
            if !(n >= 0.0) || i + 2 + n as usize * 3 > f.len() {
                self.minutes.truncate(mark.0);
                self.levels.truncate(mark.1);
                return false;
            }
            let n = n as usize;
            self.minutes.push((f[i], self.levels.len() / 3, n));
            self.levels.extend_from_slice(&f[i + 2..i + 2 + n * 3]);
            i += 2 + n * 3;
        }
        if tick > 0.0 && self.tick <= 0.0 {
            self.tick = tick;
        }
        i == f.len()
    }

    /// Folded into bars of `bar_ms`, as fp-fold.ts `foldMinutes` does, `by` ticks a row where given:
    /// grid, fitted, by, bars, then each bar. `None` where a bar spans too many ticks.
    pub fn fold(&self, bar_ms: f64, usd: bool, ticks: f64, by: Option<i64>) -> Option<Vec<f64>> {
        let tick = if self.tick > 0.0 { self.tick } else { 1.0 };
        let bar_ms = bar_ms as i64;
        if bar_ms <= 0 {
            return None;
        }
        // The minutes in time order, as the page sorts them; the server's are in order already.
        let mut order: Vec<usize> = (0..self.minutes.len()).collect();
        if self.minutes.windows(2).any(|w| w[1].0 < w[0].0) {
            tradoor_core::sort::heap_sort_by(&mut order, |a, b| (self.minutes[*a].0, *a) < (self.minutes[*b].0, *b));
        }
        let step_of = |price: f64| (price / tick + 0.5).floor() as i64;

        // Each bar: its minutes, the span of its levels, its levels added up a step at a time.
        struct Bar {
            time: i64,
            steps: Vec<(i64, f64, f64)>,
            max: f64,
            min: f64,
        }
        let mut bars: Vec<Bar> = Vec::new();
        let (mut sums, mut seen): (Vec<(f64, f64)>, Vec<u32>) = (Vec::new(), Vec::new());
        let mut stamp = 0u32;
        let mut i = 0;
        while i < order.len() {
            let time = (self.minutes[order[i]].0 as i64).div_euclid(bar_ms) * bar_ms;
            let mut j = i;
            let (mut low, mut high) = (i64::MAX, i64::MIN);
            while j < order.len() && (self.minutes[order[j]].0 as i64).div_euclid(bar_ms) * bar_ms == time {
                let (_, start, n) = self.minutes[order[j]];
                for k in 0..n {
                    let s = step_of(self.levels[(start + k) * 3]);
                    low = low.min(s);
                    high = high.max(s);
                }
                j += 1;
            }
            let span = if high >= low { high - low + 1 } else { 0 };
            if span > MAX_SPAN {
                return None;
            }
            let span = span as usize;
            if sums.len() < span {
                sums.resize(span, (0.0, 0.0));
                seen.resize(span, 0);
            }
            stamp += 1;
            let (mut delta, mut max, mut min) = (0.0f64, 0.0f64, 0.0f64);
            for &m in &order[i..j] {
                let (_, start, n) = self.minutes[m];
                let mut net = 0.0;
                for k in 0..n {
                    let at = (start + k) * 3;
                    let (price, buy, sell) = (self.levels[at], self.levels[at + 1], self.levels[at + 2]);
                    let slot = (step_of(price) - low) as usize;
                    if seen[slot] == stamp {
                        sums[slot].0 += buy;
                        sums[slot].1 += sell;
                    } else {
                        seen[slot] = stamp;
                        sums[slot] = (buy, sell);
                    }
                    net += (buy - sell) * if usd { price } else { 1.0 };
                }
                delta += net;
                max = max.max(delta);
                min = min.min(delta);
            }
            let steps = (0..span).filter(|s| seen[*s] == stamp).map(|s| (low + s as i64, sums[s].0, sums[s].1)).collect();
            bars.push(Bar { time, steps, max, min });
            i = j;
        }

        // One grouping for the lot, from a bar in the middle of the pack rather than the wildest.
        let fitted = !(ticks > 0.0);
        let given = by.filter(|b| *b > 0);
        let mut by = given.unwrap_or(if fitted { 1 } else { (ticks + 0.5).floor().max(1.0) as i64 });
        if fitted && given.is_none() {
            let mut spans: Vec<i64> = bars.iter().map(|b| b.steps.last().map_or(0, |l| l.0 - b.steps[0].0 + 1)).collect();
            tradoor_core::sort::heap_sort_by(&mut spans, |a, b| a < b);
            let typical = spans.get(spans.len() * 4 / 5).copied().unwrap_or(0) as f64;
            while typical / by as f64 > MAX_FINE_ROWS {
                by = coarser(by);
            }
        }
        let mut out = vec![by as f64 * tick, f64::from(u8::from(fitted)), by as f64, bars.len() as f64];
        for bar in &bars {
            let head = out.len();
            out.extend_from_slice(&[bar.time as f64, 0.0, bar.max, bar.min]);
            let mut rows = 0;
            let mut held: Option<(i64, f64, f64)> = None;
            let mut put = |out: &mut Vec<f64>, (key, buy, sell): (i64, f64, f64)| {
                let price = key as f64 * tick;
                // In dollars, a coin at this level is worth what it traded at here.
                let worth = if usd { price } else { 1.0 };
                out.extend_from_slice(&[price, buy * worth, sell * worth]);
                rows += 1;
            };
            for &(step, buy, sell) in &bar.steps {
                let key = step.div_euclid(by) * by;
                match held.as_mut() {
                    Some(h) if h.0 == key => {
                        h.1 += buy;
                        h.2 += sell;
                    }
                    _ => {
                        if let Some(h) = held.replace((key, buy, sell)) {
                            put(&mut out, h);
                        }
                    }
                }
            }
            if let Some(h) = held {
                put(&mut out, h);
            }
            out[head + 1] = f64::from(rows);
        }
        Some(out)
    }
}

/// The next grouping up: 1, 2, 5, 10, 20, 50, and so on.
fn coarser(by: i64) -> i64 {
    let mut power = 1;
    while power * 10 <= by {
        power *= 10;
    }
    let head = by as f64 / power as f64;
    (if head < 2.0 { 2 } else if head < 5.0 { 5 } else { 10 }) * power
}

thread_local! {
    static HELD: RefCell<Minutes> = RefCell::new(Minutes::default());
    static OUT: RefCell<Vec<f64>> = const { RefCell::new(Vec::new()) };
}

#[unsafe(no_mangle)]
pub extern "C" fn fp_clear() {
    HELD.with_borrow_mut(|m| *m = Minutes::default());
    OUT.with_borrow_mut(Vec::clear);
}

/// Room for `len` bytes, on an eight-byte boundary; freed with `fp_free`.
#[unsafe(no_mangle)]
pub extern "C" fn fp_alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<f64>::with_capacity(len.div_ceil(8).max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p.cast()
}

/// # Safety
/// `ptr` and `len` are what `fp_alloc` gave and was asked for.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn fp_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(unsafe { Vec::<f64>::from_raw_parts(ptr.cast(), 0, len.div_ceil(8).max(1)) });
    }
}

/// # Safety
/// `ptr` holds `len` bytes the page wrote.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn fp_add(ptr: *const u8, len: usize) -> f64 {
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    HELD.with_borrow_mut(|m| m.add(bytes)).unwrap_or(-1.0)
}

/// # Safety
/// `ptr` holds `count` numbers the page wrote.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn fp_add_minutes(ptr: *const f64, count: usize, tick: f64) -> i32 {
    let f = unsafe { std::slice::from_raw_parts(ptr, count) };
    i32::from(HELD.with_borrow_mut(|m| m.add_numbers(f, tick)))
}

#[unsafe(no_mangle)]
pub extern "C" fn fp_fold(bar_ms: f64, usd: u32, ticks: f64, by: f64) -> i32 {
    match HELD.with_borrow(|m| m.fold(bar_ms, usd != 0, ticks, (by >= 1.0).then_some(by as i64))) {
        Some(out) => {
            let n = out.len() as i32;
            OUT.with_borrow_mut(|o| *o = out);
            n
        }
        None => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fp_out() -> *const f64 {
    OUT.with_borrow(|o| o.as_ptr())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bars(out: &[f64]) -> Vec<(f64, Vec<[f64; 3]>, f64, f64)> {
        let mut i = 4;
        let mut list = Vec::new();
        while i < out.len() {
            let n = out[i + 1] as usize;
            let rows = (0..n).map(|r| [out[i + 4 + r * 3], out[i + 5 + r * 3], out[i + 6 + r * 3]]).collect();
            list.push((out[i], rows, out[i + 2], out[i + 3]));
            i += 4 + n * 3;
        }
        list
    }

    #[test]
    fn minutes_fold_into_bars_with_their_rows_and_swings() {
        let mut m = Minutes::default();
        let tick = m.add(br#"{"bars":[{"at":60000,"levels":[[100.0,1.5,0.5],[101.0,0.25,1e-1]],"trades":3},{"at":0,"trades":1,"levels":[[100.0,1,0],[102.0,0,2.5]]}],"market":"x","tick":1.0}"#);
        assert_eq!(tick, Some(1.0));
        let out = m.fold(300_000.0, false, 0.0, None).unwrap();
        assert_eq!(&out[..4], &[1.0, 1.0, 1.0, 1.0], "grid, fitted, by, one bar");
        let b = bars(&out);
        // Minute 0 first (sorted): net 1 - 2.5 = -1.5; then +1.0 + 0.15 = -0.35.
        assert_eq!(b[0].0, 0.0);
        assert_eq!(b[0].1, vec![[100.0, 2.5, 0.5], [101.0, 0.25, 0.1], [102.0, 0.0, 2.5]]);
        assert!((b[0].2 - 0.0).abs() < 1e-12 && (b[0].3 + 1.5).abs() < 1e-12, "{:?}", (b[0].2, b[0].3));
    }

    #[test]
    fn rows_are_grouped_by_the_ticks_asked_for_and_dollars_weigh_the_row_price() {
        let mut m = Minutes::default();
        m.add(br#"{"tick":0.5,"bars":[{"at":0,"levels":[[10.0,1,0],[10.5,1,0],[11.0,0,1],[12.0,2,0]]}]}"#).unwrap();
        let out = m.fold(60_000.0, true, 4.0, None).unwrap();
        assert_eq!(&out[..4], &[2.0, 0.0, 4.0, 1.0]);
        // Steps 20, 21, 22, 24 by 4: rows 20 (10.0) and 24 (12.0).
        assert_eq!(bars(&out)[0].1, vec![[10.0, 20.0, 10.0], [12.0, 24.0, 0.0]]);
    }

    #[test]
    fn minutes_as_numbers_fold_as_the_json_does_and_a_given_grouping_is_kept() {
        let mut a = Minutes::default();
        a.add(br#"{"tick":1,"bars":[{"at":0,"levels":[[100.0,1,0],[103.0,0,2]]},{"at":60000,"levels":[[101.0,0.5,0.25]]}]}"#).unwrap();
        let mut b = Minutes::default();
        assert!(b.add_numbers(&[0.0, 2.0, 100.0, 1.0, 0.0, 103.0, 0.0, 2.0, 60_000.0, 1.0, 101.0, 0.5, 0.25], 1.0));
        assert_eq!(a.fold(300_000.0, false, 0.0, None), b.fold(300_000.0, false, 0.0, None));
        let out = b.fold(300_000.0, false, 0.0, Some(2)).unwrap();
        assert_eq!(&out[..3], &[2.0, 1.0, 2.0], "a grouping given is kept, the grid still fitted");
        assert_eq!(bars(&out)[0].1, vec![[100.0, 1.5, 0.25], [102.0, 0.0, 2.0]]);
        assert!(!b.add_numbers(&[0.0, 5.0, 1.0], 1.0), "five levels promised, none given");
        assert_eq!(b.minutes.len(), 2);
    }

    #[test]
    fn a_fitted_grid_joins_rows_past_two_hundred_and_bad_answers_add_nothing() {
        let mut m = Minutes::default();
        let levels: Vec<String> = (0..450).map(|i| format!("[{}.0,1,0]", 1000 + i)).collect();
        m.add(format!(r#"{{"tick":1,"bars":[{{"at":0,"levels":[{}]}}]}}"#, levels.join(",")).as_bytes()).unwrap();
        let out = m.fold(60_000.0, false, 0.0, None).unwrap();
        assert_eq!(out[2], 5.0, "450 rows: by 2 is 225, by 5 is 90");
        assert_eq!(m.add(br#"{"tick":1,"bars":[{"at":5,"levels":[[1,2"#), None);
        assert_eq!(m.minutes.len(), 1, "half an answer added nothing");
        assert_eq!(coarser(1), 2);
        assert_eq!(coarser(20), 50);
        assert_eq!(coarser(50), 100);
    }
}
