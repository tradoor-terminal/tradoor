//! Order flow read from candles: what market buyers took less what market sellers did.

/// One bar's delta: what market buyers took less the rest of its volume, exact
/// where the exchange reports its buyers. Elsewhere it is estimated from where
/// the bar closed in its range, the top all bought and the bottom all sold, and
/// the flag says so. A bar with neither its buyers nor a range is 0.
pub fn bar_delta(volume: f64, taker_buy: Option<f64>, high: f64, low: f64, close: f64) -> (f64, bool) {
    let range = high - low;
    match taker_buy {
        Some(buy) if buy.is_finite() => (2.0 * buy - volume, false),
        _ if range > 0.0 => (volume * (2.0 * (close - low) / range - 1.0), true),
        _ => (0.0, false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_where_buyers_are_reported_estimated_from_the_close_elsewhere() {
        assert_eq!(bar_delta(10.0, Some(7.0), 110.0, 90.0, 95.0), (4.0, false));
        assert_eq!(bar_delta(10.0, None, 110.0, 90.0, 110.0), (10.0, true));
        assert_eq!(bar_delta(10.0, None, 110.0, 90.0, 95.0), (-5.0, true));
        assert_eq!(bar_delta(10.0, Some(f64::NAN), 110.0, 90.0, 90.0), (-10.0, true), "a buyers' column with a gap in it");
        assert_eq!(bar_delta(10.0, None, 100.0, 100.0, 100.0), (0.0, false), "no range, nothing to say");
    }
}
