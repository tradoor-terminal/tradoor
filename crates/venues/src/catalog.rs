//! The list of markets a symbol search offers.

use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    /// `bybit-perp:BTCUSDT`.
    pub market: String,
    pub venue: &'static str,
    pub symbol: String,
    pub base: String,
    pub quote: String,
    pub kind: &'static str,
    /// The exchange's own name for the market, where it is not `symbol`:
    /// `BTC-USDT-SWAP`, `BTC/USD`, Hyperliquid's `kPEPE`, Lighter's market number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native: Option<String>,
    /// What it is, where its symbol does not say: an index's or a stock's name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Decimals of the exchange's tick size, when it publishes one.
    pub price_decimals: Option<u8>,
    pub quote_volume_24h: Option<f64>,
    pub last_price: Option<f64>,
    pub change_pct: Option<f64>,
    /// What it follows where that is not a coin: `stock`, `etf`, `index`,
    /// `commodity` or `forex`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class: Option<&'static str>,
}

/// Currencies a forex pair is made of.
const FIAT: [&str; 16] = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "KRW", "BRL", "MXN", "TRY", "CNH", "HKD", "SGD", "INR"];
/// Funds, whose exchanges list them as stocks.
const ETFS: [&str; 52] = [
    "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "GLD", "SLV", "TLT", "HYG", "LQD", "XLE", "XLF", "XLK", "XOP", "SMH", "SOXX", "SOXL", "SOXS", "TQQQ", "SQQQ", "UPRO", "SPXL", "TSLL", "NVDL", "CONL", "MSTU", "MSTX", "ARKK", "EWY",
    "EWJ", "EWZ", "EWT", "EWW", "FXI", "KWEB", "EEM", "EFA", "URA", "URNM", "XBI", "KORU", "MAGS", "USO", "UNG", "GDX", "GDXJ", "IBIT", "ETHA", "BITO", "KODEX200", "SNXX",
];
const INDICES: [&str; 24] = ["SP500", "SPX500", "US500", "XYZ100", "NAS100", "US100", "NDX", "USTEC", "US30", "DJI", "JP225", "KR200", "NIFTY", "IBOV", "HK50", "GER40", "DE40", "UK100", "FRA40", "EU50", "VIX", "DXY", "USDX", "BTCDOM"];
const COMMODITIES: [&str; 36] = [
    "XAU", "XAG", "XPT", "XPD", "XCU", "GOLD", "SILVER", "PLATINUM", "PALLADIUM", "COPPER", "ALUMINIUM", "ALUMINUM", "CL", "BZ", "WTI", "OIL", "USOIL", "UKOIL", "BRENTOIL", "NG", "NATGAS", "TTF", "HO", "URANIUM", "CORN", "WHEAT",
    "SOYBEAN", "COCOA", "COFFEE", "SUGAR", "COTTON", "LUMBER", "H100", "PAXG", "XAUT", "KAU",
];

/// A pair of currencies, `EUR`/`USD` or `EURUSD`/`USDT`; the dollar's
/// stablecoins count as the dollar.
pub fn forex_pair(base: &str, quote: &str) -> bool {
    let quote = if matches!(quote, "USDT" | "USDC") { "USD" } else { quote };
    let fiat = |c: &str| FIAT.contains(&c);
    if base.len() == 6 && base.is_char_boundary(3) && fiat(&base[..3]) && fiat(&base[3..]) {
        return true;
    }
    fiat(base) && fiat(quote) && base != quote
}

/// What a market an exchange marks as not a coin follows: a fund, index,
/// commodity or currency known by its name, else `hint`, the exchange's own word.
pub fn tradfi_class(base: &str, quote: &str, hint: &'static str) -> &'static str {
    if forex_pair(base, quote) {
        "forex"
    } else if ETFS.contains(&base) {
        "etf"
    } else if INDICES.contains(&base) {
        "index"
    } else if COMMODITIES.contains(&base) {
        "commodity"
    } else {
        hint
    }
}

/// Classes carried from the exchanges that say what a market follows to those
/// that list the same name without saying: Aster's AAPL is Binance's. Only at
/// a price within a quarter of the marked one, so the coin BB is not BlackBerry.
/// Pairs of currencies are forex wherever listed.
pub fn spread_classes(products: &mut [&mut Product]) {
    let mut known: std::collections::HashMap<String, (&'static str, f64, f64)> = std::collections::HashMap::new();
    for p in products.iter() {
        // A currency is forex only in a pair of currencies: EUR/EURI is a stablecoin's.
        if let (Some(class), Some(price)) = (p.class.filter(|c| *c != "forex"), p.last_price.filter(|x| *x > 0.0)) {
            let volume = p.quote_volume_24h.unwrap_or(0.0);
            let held = known.entry(p.base.clone()).or_insert((class, price, volume));
            if volume > held.2 {
                *held = (class, price, volume);
            }
        }
    }
    for p in products.iter_mut() {
        if p.class.is_some() {
            continue;
        }
        if forex_pair(&p.base, &p.quote) {
            p.class = Some("forex");
        } else if let (Some((class, price, _)), Some(last)) = (known.get(&p.base), p.last_price) {
            let ratio = last / price;
            if (0.8..1.25).contains(&ratio) {
                p.class = Some(class);
            }
        }
    }
}

/// A number sent as a string, as most exchanges do, or as a number.
pub(crate) fn num(v: Option<&serde_json::Value>) -> Option<f64> {
    let v = v?;
    v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()).filter(|x| x.is_finite())
}

pub(crate) fn tick_decimals(tick: Option<&str>) -> Option<u8> {
    tradoor_codec::decimal::parse_decimal(tick?).map(|(_, scale)| scale)
}

/// This app's spelling of a market: letters and digits only, upper case.
pub(crate) fn canonical(base: &str, quote: &str) -> String {
    format!("{base}{quote}").chars().filter(char::is_ascii_alphanumeric).collect::<String>().to_ascii_uppercase()
}

/// Decimals of a tick given as a number, such as Kraken Futures' `0.5`.
pub(crate) fn decimals_of(tick: f64) -> Option<u8> {
    (tick > 0.0 && tick.is_finite()).then(|| (0..=12u8).find(|d| (tick * 10f64.powi(i32::from(*d))).fract().abs() < 1e-9).unwrap_or(12))
}

/// A percent change from an open and a last price.
pub(crate) fn change(open: Option<f64>, last: Option<f64>) -> Option<f64> {
    match (open, last) {
        (Some(o), Some(l)) if o > 0.0 => Some((l - o) / o * 100.0),
        _ => None,
    }
}

/// A product in this app's spelling, or none when the name cannot be one.
#[allow(clippy::too_many_arguments)]
pub(crate) fn product(venue: crate::Venue, base: &str, quote: &str, native: &str, price_decimals: Option<u8>, quote_volume_24h: Option<f64>, last_price: Option<f64>, change_pct: Option<f64>) -> Option<Product> {
    let symbol = canonical(base, quote);
    let market = crate::MarketRef::new(venue, &symbol)?;
    Some(Product {
        market: market.to_string(),
        venue: venue.id(),
        native: (native != symbol).then(|| native.to_string()),
        name: None,
        symbol,
        base: base.to_ascii_uppercase(),
        quote: quote.to_ascii_uppercase(),
        kind: venue.kind().as_str(),
        price_decimals,
        quote_volume_24h,
        last_price,
        change_pct,
        class: None,
    })
}

/// Keep the first of each symbol: two exchange names that spell alike here
/// would be one market to the chart.
pub(crate) fn unique(mut products: Vec<Product>) -> Vec<Product> {
    let mut seen = std::collections::HashSet::new();
    products.retain(|p| seen.insert(p.market.clone()));
    products
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Venue;

    fn at(venue: Venue, base: &str, quote: &str, price: f64, class: Option<&'static str>) -> Product {
        let mut p = product(venue, base, quote, base, None, Some(1.0), Some(price), None).unwrap();
        p.class = class;
        p
    }

    #[test]
    fn currencies_funds_and_metals_by_name() {
        assert!(forex_pair("EUR", "USD") && forex_pair("USD", "CHF") && forex_pair("EURUSD", "USDT") && forex_pair("EUR", "USDT"));
        assert!(!forex_pair("BTC", "USD") && !forex_pair("EURC", "USDT") && !forex_pair("USD", "USDT"));
        assert_eq!(tradfi_class("QQQ", "USDT", "stock"), "etf");
        assert_eq!(tradfi_class("SP500", "USD", "stock"), "index");
        assert_eq!(tradfi_class("GOLD", "USD", "stock"), "commodity");
        assert_eq!(tradfi_class("JPY", "USD", "stock"), "forex");
        assert_eq!(tradfi_class("NVDA", "USDT", "stock"), "stock");
    }

    #[test]
    fn a_class_spreads_to_the_same_name_at_the_same_price() {
        let mut list = [
            at(Venue::BinancePerp, "AAPL", "USDT", 356.0, Some("stock")),
            at(Venue::BinancePerp, "BB", "USDT", 9.0, Some("stock")),
            at(Venue::AsterPerp, "AAPL", "USDT", 357.0, None),
            at(Venue::GatePerp, "BB", "USDT", 0.08, None),
            at(Venue::LighterPerp, "EURUSD", "USD", 1.09, None),
            at(Venue::KrakenSpot, "EUR", "USD", 1.09, Some("forex")),
            at(Venue::BinanceSpot, "EUR", "EURI", 1.0, None),
            at(Venue::GatePerp, "BTC", "USDT", 86000.0, None),
        ];
        spread_classes(&mut list.iter_mut().collect::<Vec<_>>());
        assert_eq!(list.iter().map(|p| p.class).collect::<Vec<_>>(), [Some("stock"), Some("stock"), Some("stock"), None, Some("forex"), Some("forex"), None, None]);
    }
}
