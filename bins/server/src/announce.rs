//! What the site's owner tells every reader: one announcement at a time, set on
//! the status page with the admin key and shown as a banner atop the app. Held
//! in memory and answered from there, so a page asking costs no database work;
//! kept in `announcement` for the next start and as a record.
//!
//! It is text, an optional link and an optional picture, nothing else: the page
//! writes it as text, a link is an https address alone, and a picture an https
//! address or one of the site's own files (`/announce/…`). A `bar` is a strip
//! atop the app; a `centre` banner, a new feature shown off. Either may end by
//! itself, a week or a month on.
use std::sync::{Arc, RwLock};

use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tradoor_store::now_ms;

use crate::api::{ApiError, AppState};
use crate::presence::refused;

const MAX_TITLE: usize = 80;
const MAX_BODY: usize = 400;
const MAX_LINK: usize = 200;
/** The longest an announcement runs by itself: a quarter. */
const MAX_DAYS: i64 = 92;
const DAY_MS: i64 = 86_400_000;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Announcement {
    /// When it was put up: a new one has a new id, so a reader who closed the last sees it.
    pub id: i64,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    /// `info` or `warn`.
    pub tone: String,
    /// `bar`, atop the app, or `centre`, a banner in the middle.
    pub place: String,
    /// A picture in a banner.
    pub image: Option<String>,
    /// When it stops being shown by itself, if it does.
    pub ends: Option<i64>,
}

/// Not yet past its end, if it has one.
fn running(a: &Announcement, now: i64) -> bool {
    a.ends.is_none_or(|end| now < end)
}

pub struct Board {
    pool: deadpool_postgres::Pool,
    current: RwLock<Option<Announcement>>,
}

impl Board {
    /// The one up when the server last stopped, if any.
    pub async fn load(pool: deadpool_postgres::Pool) -> anyhow::Result<Arc<Self>> {
        let row = pool.get().await?.query_opt("SELECT id, title, body, link, tone, place, image, ends_at FROM announcement WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1", &[]).await?;
        let current = row.map(|r| Announcement { id: r.get(0), title: r.get(1), body: r.get(2), link: r.get(3), tone: r.get(4), place: r.get(5), image: r.get(6), ends: r.get(7) });
        Ok(Arc::new(Self { pool, current: RwLock::new(current) }))
    }

    fn now(&self) -> Option<Announcement> {
        self.current.read().ok().and_then(|c| c.clone())
    }

    /// The one up and not yet past its end: what readers are shown.
    fn shown(&self, now: i64) -> Option<Announcement> {
        self.now().filter(|a| running(a, now))
    }
}

#[derive(Deserialize)]
pub struct Draft {
    title: String,
    body: String,
    link: Option<String>,
    tone: Option<String>,
    place: Option<String>,
    image: Option<String>,
    /// Days it runs by itself; none, until taken down.
    days: Option<i64>,
}

/// What a draft is, held to its limits.
#[derive(Debug, PartialEq)]
struct Checked {
    title: String,
    body: String,
    link: Option<String>,
    tone: String,
    place: String,
    image: Option<String>,
    days: Option<i64>,
}

/// An address the page may open or load: https, or one of the site's own files.
fn address(raw: Option<&str>, own: bool) -> Result<Option<String>, ()> {
    let Some(a) = raw.map(str::trim).filter(|a| !a.is_empty()) else { return Ok(None) };
    let site = own && a.starts_with('/') && !a.starts_with("//") && !a.contains("..");
    if !(a.starts_with("https://") || site) || a.len() > MAX_LINK || a.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"' || c == '<' || c == '>' || c == '\\') {
        return Err(());
    }
    Ok(Some(a.to_string()))
}

fn plain(s: &str) -> String {
    s.trim().chars().map(|c| if c.is_control() { ' ' } else { c }).collect()
}

/// The draft held to its limits, or why not.
fn checked(d: &Draft) -> Result<Checked, String> {
    let (title, body) = (plain(&d.title), plain(&d.body));
    if title.is_empty() || title.chars().count() > MAX_TITLE {
        return Err(format!("a title is 1 to {MAX_TITLE} characters"));
    }
    if body.chars().count() > MAX_BODY {
        return Err(format!("the text is {MAX_BODY} characters at most"));
    }
    let link = address(d.link.as_deref(), false).map_err(|()| format!("a link is an https:// address of {MAX_LINK} characters at most"))?;
    let image = address(d.image.as_deref(), true).map_err(|()| format!("a picture is an https:// address or a /path on the site, {MAX_LINK} characters at most"))?;
    let tone = match d.tone.as_deref() {
        None | Some("info") => "info",
        Some("warn") => "warn",
        Some(_) => return Err("the tone is info or warn".into()),
    };
    let place = match d.place.as_deref() {
        None | Some("bar") => "bar",
        Some("centre") => "centre",
        Some(_) => return Err("it goes in the bar or the centre".into()),
    };
    if image.is_some() && place == "bar" {
        return Err("a picture goes in a banner in the centre".into());
    }
    let days = match d.days {
        None | Some(0) => None,
        Some(n) if (1..=MAX_DAYS).contains(&n) => Some(n),
        Some(_) => return Err(format!("it runs 1 to {MAX_DAYS} days, or until taken down")),
    };
    Ok(Checked { title, body, link, tone: tone.into(), place: place.into(), image, days })
}

/// `GET /api/announcement`: the one up, for every reader; a minute in caches.
pub async fn current(State(state): State<AppState>) -> Response {
    ([(header::CACHE_CONTROL, "public, max-age=60")], Json(json!({ "announcement": state.announcements.shown(now_ms()) }))).into_response()
}

/// `GET /api/admin/announcement`: the one up, and the last few, for the status page.
pub async fn read(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(answer) = refused(&state, &headers) {
        return answer;
    }
    let past = async {
        let rows = state.pool.get().await?.query("SELECT id, title, body, link, tone, ended_at, place, image, ends_at FROM announcement ORDER BY id DESC LIMIT 10", &[]).await?;
        anyhow::Ok(rows.iter().map(|r| json!({ "id": r.get::<_, i64>(0), "title": r.get::<_, String>(1), "body": r.get::<_, String>(2), "link": r.get::<_, Option<String>>(3), "tone": r.get::<_, String>(4), "ended": r.get::<_, Option<i64>>(5), "place": r.get::<_, String>(6), "image": r.get::<_, Option<String>>(7), "ends": r.get::<_, Option<i64>>(8) })).collect::<Vec<_>>())
    };
    let past = past.await.unwrap_or_default();
    ([(header::CACHE_CONTROL, "no-store")], Json(json!({ "current": state.announcements.now(), "past": past }))).into_response()
}

/// `PUT /api/admin/announcement`: a new one up, in place of the last.
pub async fn publish(State(state): State<AppState>, headers: HeaderMap, Json(draft): Json<Draft>) -> Response {
    if let Some(answer) = refused(&state, &headers) {
        return answer;
    }
    let Checked { title, body, link, tone, place, image, days } = match checked(&draft) {
        Ok(v) => v,
        Err(why) => return ApiError::bad_request(why).into_response(),
    };
    let id = now_ms();
    let ends = days.map(|d| id + d * DAY_MS);
    let put = async {
        let client = state.pool.get().await?;
        client.execute("UPDATE announcement SET ended_at = $1 WHERE ended_at IS NULL", &[&id]).await?;
        client.execute("INSERT INTO announcement (id, title, body, link, tone, created_at, place, image, ends_at) VALUES ($1, $2, $3, $4, $5, $1, $6, $7, $8)", &[&id, &title, &body, &link, &tone, &place, &image, &ends]).await?;
        anyhow::Ok(())
    };
    if let Err(e) = put.await {
        return ApiError::from(e).into_response();
    }
    let a = Announcement { id, title, body, link, tone, place, image, ends };
    if let Ok(mut c) = state.announcements.current.write() {
        *c = Some(a.clone());
    }
    tracing::info!(id, "announcement up");
    ([(header::CACHE_CONTROL, "no-store")], Json(json!({ "current": a }))).into_response()
}

/// `DELETE /api/admin/announcement`: none up.
pub async fn take_down(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(answer) = refused(&state, &headers) {
        return answer;
    }
    let ended = async { anyhow::Ok(state.announcements.pool.get().await?.execute("UPDATE announcement SET ended_at = $1 WHERE ended_at IS NULL", &[&now_ms()]).await?) };
    if let Err(e) = ended.await {
        return ApiError::from(e).into_response();
    }
    if let Ok(mut c) = state.announcements.current.write() {
        *c = None;
    }
    StatusCode::NO_CONTENT.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft(title: &str, body: &str, link: Option<&str>, tone: Option<&str>) -> Draft {
        Draft { title: title.into(), body: body.into(), link: link.map(str::to_string), tone: tone.map(str::to_string), place: None, image: None, days: None }
    }

    #[test]
    fn a_draft_is_text_and_an_https_link_alone() {
        let ok = checked(&draft(" tradoor moved ", "Bookmarks\nstill work.", Some("https://tradoorterminal.com/doc.html"), None)).unwrap();
        assert_eq!((ok.title.as_str(), ok.body.as_str(), ok.link.as_deref(), ok.tone.as_str(), ok.place.as_str()), ("tradoor moved", "Bookmarks still work.", Some("https://tradoorterminal.com/doc.html"), "info", "bar"));
        assert!(checked(&draft("", "x", None, None)).is_err());
        assert!(checked(&draft(&"t".repeat(81), "", None, None)).is_err());
        assert!(checked(&draft("t", &"b".repeat(401), None, None)).is_err());
        assert!(checked(&draft("t", "", Some("javascript:alert(1)"), None)).is_err(), "no script for an address");
        assert!(checked(&draft("t", "", Some("http://plain.example"), None)).is_err());
        assert!(checked(&draft("t", "", Some("https://a.example/\"><x"), None)).is_err());
        assert!(checked(&draft("t", "", Some("/doc.html"), None)).is_err(), "a link goes out by https");
        assert!(checked(&draft("t", "", None, Some("loud"))).is_err());
        assert_eq!(checked(&draft("t", "", Some("  "), Some("warn"))).unwrap().link, None, "an empty link is none");
    }

    #[test]
    fn a_banner_has_a_picture_of_the_site_or_https_and_may_end_by_itself() {
        let banner = |image: Option<&str>, days: Option<i64>| checked(&Draft { place: Some("centre".into()), image: image.map(str::to_string), days, ..draft("CVD Aggregated", "", None, None) });
        let ok = banner(Some("/announce/cvd-aggregated.webp"), Some(7)).unwrap();
        assert_eq!((ok.place.as_str(), ok.image.as_deref(), ok.days), ("centre", Some("/announce/cvd-aggregated.webp"), Some(7)));
        assert_eq!(banner(Some("https://cdn.example/a.png"), Some(0)).unwrap().days, None, "0 days: until taken down");
        for bad in ["//evil.example/a.png", "/../etc/passwd", "data:image/png;base64,AA", "/a b.png", "/a\\b.png"] {
            assert!(banner(Some(bad), None).is_err(), "{bad}");
        }
        assert!(banner(None, Some(93)).is_err(), "a quarter at most");
        assert!(checked(&Draft { image: Some("/a.png".into()), ..draft("t", "", None, None) }).is_err(), "a picture in the bar");
        assert!(checked(&Draft { place: Some("side".into()), ..draft("t", "", None, None) }).is_err());
    }

    #[test]
    fn one_past_its_end_is_not_shown() {
        let a = Announcement { id: 1, title: "t".into(), body: String::new(), link: None, tone: "info".into(), place: "centre".into(), image: None, ends: Some(100) };
        assert!(running(&a, 99) && !running(&a, 100));
        assert!(running(&Announcement { ends: None, ..a }, i64::MAX));
    }
}
