//! BloFin perpetuals, USDT and USDC margined. BloFin names a market `BTC-USDT`;
//! here it is `blofin-perp:BTCUSDT`, with BloFin's name as `native`. Sizes are
//! contracts of `contractValue` coins. Its REST answers a page itself.

use std::collections::HashMap;

use serde_json::Value;

use crate::catalog::{change, num, product, tick_decimals, tradfi_class, unique, Product};
use crate::{shape, Venue, VenueError};

pub const REST: &str = "https://openapi.blofin.com";

pub fn instruments_url() -> String {
    format!("{REST}/api/v1/market/instruments?instType=SWAP")
}

pub fn tickers_url() -> String {
    format!("{REST}/api/v1/market/tickers")
}

fn data(body: &str) -> Result<Vec<Value>, VenueError> {
    let v: Value = serde_json::from_str(body)?;
    if v["code"] != "0" {
        return Err(VenueError::Api { code: v["code"].as_str().and_then(|c| c.parse().ok()).unwrap_or(-1), message: v["msg"].as_str().unwrap_or_default().to_string() });
    }
    v["data"].as_array().cloned().ok_or_else(|| shape("blofin data"))
}

/// Live linear perpetuals in the dollar's stablecoins, with the ticker table's
/// last price, 24h change and turnover (`volCurrency24h` is coins). Shares,
/// commodities and indices are listed too, marked as such.
pub fn parse_perps(instruments: &str, tickers: Option<&str>) -> Result<Vec<Product>, VenueError> {
    let stats: HashMap<String, Value> = match tickers {
        Some(t) => data(t)?.into_iter().filter_map(|r| Some((r["instId"].as_str()?.to_string(), r))).collect(),
        None => HashMap::new(),
    };
    let list = data(instruments)?
        .iter()
        .filter(|i| i["state"] == "live" && i["contractType"] == "linear" && matches!(i["settleCurrency"].as_str(), Some("USDT" | "USDC")))
        .filter_map(|i| {
            let native = i["instId"].as_str()?;
            let (base, quote) = (i["baseCurrency"].as_str()?, i["quoteCurrency"].as_str()?);
            let t = stats.get(native);
            let last = t.and_then(|t| num(t.get("last")));
            let volume = t.and_then(|t| num(t.get("volCurrency24h"))).map(|v| v * last.unwrap_or(0.0));
            let mut p = product(Venue::BlofinPerp, base, quote, native, tick_decimals(i["tickSize"].as_str()), volume, last, change(t.and_then(|t| num(t.get("open24h"))), last))?;
            let hint = match i["assetClass"].as_str() {
                Some("Stocks") => Some("stock"),
                Some("Commodities") => Some("commodity"),
                Some("Indices") => Some("index"),
                _ => None,
            };
            p.class = hint.map(|h| tradfi_class(base, quote, h));
            Some(p)
        })
        .collect();
    Ok(unique(list))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Captured 2026-11-27, trimmed.
    #[test]
    fn perps_keep_live_linear_dollar_contracts() {
        let instruments = r#"{"code":"0","msg":"success","data":[
            {"instId":"BTC-USDT","baseCurrency":"BTC","quoteCurrency":"USDT","contractValue":"0.001","assetClass":"Crypto","tickSize":"0.1","instType":"SWAP","contractType":"linear","state":"live","settleCurrency":"USDT"},
            {"instId":"BTC-USDC","baseCurrency":"BTC","quoteCurrency":"USDC","contractValue":"0.0001","assetClass":"Crypto","tickSize":"0.1","instType":"SWAP","contractType":"linear","state":"live","settleCurrency":"USDC"},
            {"instId":"BTC-USD","baseCurrency":"BTC","quoteCurrency":"USD","contractValue":"1","assetClass":"Crypto","tickSize":"0.1","instType":"SWAP","contractType":"inverse","state":"live","settleCurrency":"BTC"},
            {"instId":"NKE-USDT","baseCurrency":"NKE","quoteCurrency":"USDT","contractValue":"0.01","assetClass":"Stocks","tickSize":"0.01","instType":"SWAP","contractType":"linear","state":"live","settleCurrency":"USDT"},
            {"instId":"OLD-USDT","baseCurrency":"OLD","quoteCurrency":"USDT","contractValue":"1","assetClass":"Crypto","tickSize":"0.0001","instType":"SWAP","contractType":"linear","state":"suspend","settleCurrency":"USDT"}]}"#;
        let tickers = r#"{"code":"0","msg":"success","data":[{"instId":"BTC-USDT","last":"60454.9","open24h":"59336.2","volCurrency24h":"3128.3714","vol24h":"3128371.4"}]}"#;
        let p = parse_perps(instruments, Some(tickers)).unwrap();
        assert_eq!(p.iter().map(|p| p.market.as_str()).collect::<Vec<_>>(), ["blofin-perp:BTCUSDT", "blofin-perp:BTCUSDC", "blofin-perp:NKEUSDT"], "the inverse contract and the suspended one stay out");
        assert_eq!((p[0].native.as_deref(), p[0].price_decimals, p[0].last_price), (Some("BTC-USDT"), Some(1), Some(60454.9)));
        assert!((p[0].quote_volume_24h.unwrap() - 3128.3714 * 60454.9).abs() < 1e-3, "coins times the price");
        assert!((p[0].change_pct.unwrap() - 1.885).abs() < 1e-3);
        assert_eq!((p[0].class, p[2].class), (None, Some("stock")));
    }
}
