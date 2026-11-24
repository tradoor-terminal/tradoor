//! Drawing tools: what each kind is, how it is styled, and how it is painted.

use tradoor_core::num::Within;
use tradoor_core::format::fixed;
use tradoor_core::format::format_price;
use tradoor_core::studies::Group;
use tradoor_core::ChartTimeframe;

use crate::color::Color;
use crate::geometry::{distance_to_drawing, distance_to_segment};
use crate::paint::{Align, Baseline, Frame, Rect};
use crate::scale::PriceScale;
use crate::theme::Theme;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DrawingKind {
    Path,
    Brush,
    Trendline,
    Horizontal,
    /// A time, top to bottom of the pane.
    Vertical,
    /// A horizontal and a vertical through one point.
    Cross,
    Ray,
    Rect,
    Fib,
    Text,
    Measure,
    Long,
    Short,
    Channel,
    /// A ring around one point, its label inside: a swing marked, as the
    /// Signal panel marks a pattern's drives.
    Circle,
    /// A circle from its centre out to a point on it.
    Disk,
    /// An ellipse in the box of two opposite corners.
    Ellipse,
    Triangle,
    /// A rectangle along any slope: one side's two ends, then how far it reaches.
    RotRect,
    /// From one end to the other through a third point.
    Arc,
    /// From one end to the other, bent towards a third point.
    Curve,
    /// From one end to the other, bent towards a third point and then a fourth.
    DCurve,
    /// The closes between two times fitted to a line, with bands two standard deviations out.
    Regression,
    /// A trendline and a level, the band between them.
    Flat,
    /// A trendline and a second line from a third point, its slope mirrored.
    Disjoint,
    /// A median line from a pivot through the middle of two swings, and a parallel through each.
    Pitchfork,
    /// A pitchfork from halfway up the pivot's swing.
    Schiff,
    /// A pitchfork from halfway along the pivot's swing.
    ModSchiff,
    /// A thick arrow from one point to another.
    Marker,
    /// An arrow under a bar, pointing up at it.
    MarkUp,
    /// An arrow over a bar, pointing down at it.
    MarkDown,
    /// The price at a point, in a tag pointing at it.
    PriceLabel,
    /// A line from a price out to a tag that reads it.
    PriceNote,
    /// A note in a box, with a line to what it is about.
    Callout,
    Flag,
    Pin,
    /// Fib levels of one move projected from a third point: where a trend may run to.
    FibExt,
    /// Vertical lines a Fibonacci number of the first span's bars on.
    FibTime,
    /// Rings round a point at the fib ratios of the distance to a second.
    FibCircles,
    /// Lines out from a point at the fib ratios of a move's rise and of its run.
    FibFan,
    /// A box cut at the Gann ratios both ways.
    GannBox,
    /// Lines out from a point at the Gann angles of a move: 1×1, 1×2, 2×1 and on.
    GannFan,
    /// A post with a note on it.
    Signpost,
    /// A note in a bubble.
    Comment,
    /// The volume-weighted average price from one bar on.
    AnchoredVwap,
    /// The volume traded at each price between two times.
    VolumeProfile,
    /// The bars between two times, copied faintly to a third point: a past move laid where it might repeat.
    BarsPattern,
}

impl DrawingKind {
    pub const ALL: [DrawingKind; 47] = [
        Self::Path,
        Self::Brush,
        Self::Trendline,
        Self::Horizontal,
        Self::Vertical,
        Self::Cross,
        Self::Ray,
        Self::Rect,
        Self::Fib,
        Self::Text,
        Self::Measure,
        Self::Long,
        Self::Short,
        Self::Channel,
        Self::Circle,
        Self::Disk,
        Self::Ellipse,
        Self::Triangle,
        Self::RotRect,
        Self::Arc,
        Self::Curve,
        Self::DCurve,
        Self::Regression,
        Self::Flat,
        Self::Disjoint,
        Self::Pitchfork,
        Self::Schiff,
        Self::ModSchiff,
        Self::Marker,
        Self::MarkUp,
        Self::MarkDown,
        Self::PriceLabel,
        Self::PriceNote,
        Self::Callout,
        Self::Flag,
        Self::Pin,
        Self::FibExt,
        Self::FibTime,
        Self::FibCircles,
        Self::FibFan,
        Self::GannBox,
        Self::GannFan,
        Self::Signpost,
        Self::Comment,
        Self::AnchoredVwap,
        Self::VolumeProfile,
        Self::BarsPattern,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Path => "path",
            Self::Brush => "brush",
            Self::Trendline => "trendline",
            Self::Horizontal => "horizontal",
            Self::Vertical => "vertical",
            Self::Cross => "cross",
            Self::Ray => "ray",
            Self::Rect => "rect",
            Self::Fib => "fib",
            Self::Text => "text",
            Self::Measure => "measure",
            Self::Long => "long",
            Self::Short => "short",
            Self::Channel => "channel",
            Self::Circle => "circle",
            Self::Disk => "disk",
            Self::Ellipse => "ellipse",
            Self::Triangle => "triangle",
            Self::RotRect => "rotrect",
            Self::Arc => "arc",
            Self::Curve => "curve",
            Self::DCurve => "dcurve",
            Self::Regression => "regression",
            Self::Flat => "flat",
            Self::Disjoint => "disjoint",
            Self::Pitchfork => "pitchfork",
            Self::Schiff => "schiff",
            Self::ModSchiff => "mschiff",
            Self::Marker => "marker",
            Self::MarkUp => "markup",
            Self::MarkDown => "markdown",
            Self::PriceLabel => "pricelabel",
            Self::PriceNote => "pricenote",
            Self::Callout => "callout",
            Self::Flag => "flag",
            Self::Pin => "pin",
            Self::FibExt => "fibext",
            Self::FibTime => "fibtime",
            Self::FibCircles => "fibcircles",
            Self::FibFan => "fibfan",
            Self::GannBox => "gannbox",
            Self::GannFan => "gannfan",
            Self::Signpost => "signpost",
            Self::Comment => "comment",
            Self::AnchoredVwap => "avwap",
            Self::VolumeProfile => "vprofile",
            Self::BarsPattern => "barspattern",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|k| k.as_str() == s)
    }

    /// Anchors the kind takes — the minimum for a path or brush.
    pub fn arity(self) -> usize {
        match self {
            Self::Horizontal | Self::Vertical | Self::Cross | Self::Ray | Self::Text | Self::Circle | Self::MarkUp | Self::MarkDown | Self::PriceLabel | Self::Flag | Self::Pin | Self::Signpost | Self::Comment | Self::AnchoredVwap => 1,
            Self::Long | Self::Short | Self::Channel | Self::Triangle | Self::RotRect | Self::Arc | Self::Curve | Self::Flat | Self::Disjoint | Self::Pitchfork | Self::Schiff | Self::ModSchiff | Self::FibExt | Self::BarsPattern => 3,
            Self::DCurve => 4,
            _ => 2,
        }
    }

    pub fn open_ended(self) -> bool {
        matches!(self, Self::Path | Self::Brush)
    }

    pub fn is_position(self) -> bool {
        matches!(self, Self::Long | Self::Short)
    }
}

pub const FIB_LEVELS: [f64; 7] = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
pub const MAX_POINTS: usize = 2000;
/// A circle's radius on screen, whatever the zoom: it marks a bar, not a range.
const CIRCLE_PX: f32 = 11.0;
/// The narrowest a position box is drawn, so a fresh one is never a sliver.
const MIN_POSITION_WIDTH: f32 = 40.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Anchor {
    /// Epoch ms, on the candles' time axis.
    pub time: f64,
    pub price: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Dash {
    #[default]
    Solid,
    Dashed,
    Dotted,
}

impl Dash {
    pub fn parse(s: &str) -> Self {
        match s {
            "dashed" => Self::Dashed,
            "dotted" => Self::Dotted,
            _ => Self::Solid,
        }
    }
}

/// One line of a fib or a channel: where it sits between the two main lines.
#[derive(Clone, Debug, PartialEq)]
pub struct Level {
    pub value: f64,
    pub on: bool,
    pub color: Option<Color>,
    pub dash: Dash,
}

impl Level {
    /// `value,on,color,dash` lines joined by `|` — `0.5,1,#ff6d00,dashed|…`.
    pub fn parse_list(s: &str) -> Vec<Level> {
        s.split('|')
            .filter_map(|item| {
                let mut parts = item.split(',');
                let value = tradoor_core::format::parse_number(parts.next()?.trim()).filter(|v| v.is_finite())?;
                let on = parts.next().is_none_or(|p| p.trim() != "0");
                let color = parts.next().and_then(Color::parse);
                let dash = parts.next().map_or(Dash::Solid, |d| Dash::parse(d.trim()));
                Some(Level { value, on, color, dash })
            })
            .collect()
    }
}

/// How a drawing looks — every field optional, falling back to the theme and to
/// what suits its kind. Keys and values come from the page as strings.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct DrawingStyle {
    pub color: Option<Color>,
    pub width: Option<f32>,
    pub dash: Dash,
    pub fill: Option<Color>,
    pub fill_on: Option<bool>,
    pub extend_left: Option<bool>,
    pub extend_right: Option<bool>,
    pub left_arrow: bool,
    pub right_arrow: bool,
    pub text_color: Option<Color>,
    pub text_size: Option<f32>,
    pub text_bg: Option<Color>,
    pub middle: bool,
    pub price_labels: bool,
    /// A level's name at its right end, before its price, not at its left: the trading lines'.
    pub label_right: bool,
    pub stats: bool,
    /// A trendline's angle on screen, from a level line at its first end.
    pub angle: bool,
    pub levels: Option<Vec<Level>>,
    pub level_labels: Option<bool>,
    /// A measure of the price only (`p`) or the time only (`t`); both when unset.
    pub axis: Option<u8>,
    /// An arrow mark drawn at its bar rather than its price: under the low pointing up, over the high pointing down.
    pub at_bar: bool,
    // Positions.
    pub profit_fill: Option<Color>,
    pub stop_fill: Option<Color>,
    pub profit_line: Option<Color>,
    pub stop_line: Option<Color>,
    pub account: Option<f64>,
    pub risk: Option<f64>,
    pub risk_cash: bool,
    pub lot: Option<f64>,
    pub leverage: Option<f64>,
    /// Sized by its margin: moving the stop changes what it risks, not its size.
    pub by_margin: bool,
    pub margin: Option<f64>,
    pub qty_decimals: Option<usize>,
    /// A position's partial takes (`t`), partial cuts (`c`) and adds (`a`):
    /// each a price and a percent of the entry's size.
    pub legs: Vec<(u8, f64, f64)>,
    pub compact: bool,
    /// A position's figures stay up; otherwise they show on hover or selection.
    pub always_stats: bool,
    /// Shown but not picked up: the pointer passes through it.
    pub locked: bool,
    /// The lower pane it is drawn in, by its group (`pct` for RSI and Stoch
    /// RSI, `oi`…), on that pane's values; `None` in the price pane.
    pub pane: Option<Group>,
}

impl DrawingStyle {
    /// Read `(key, value)` pairs; unknown keys and unreadable values are skipped.
    pub fn from_pairs<'a>(pairs: impl IntoIterator<Item = (&'a str, &'a str)>) -> Self {
        let mut s = Self::default();
        for (key, value) in pairs {
            s.set(key, value);
        }
        s
    }

    pub fn set(&mut self, key: &str, value: &str) {
        let flag = || matches!(value, "1" | "true");
        let color = || Color::parse(value);
        let num = || tradoor_core::format::parse_number(value.trim()).filter(|v| v.is_finite());
        let size = || num().map(|v| v as f32).filter(|v| *v > 0.0);
        match key {
            "color" => self.color = color(),
            "width" => self.width = size().map(|w| w.min(8.0)),
            "dash" => self.dash = Dash::parse(value),
            "fill" => self.fill = color(),
            "fillOn" => self.fill_on = Some(flag()),
            "extendLeft" => self.extend_left = Some(flag()),
            "extendRight" => self.extend_right = Some(flag()),
            "leftArrow" => self.left_arrow = flag(),
            "rightArrow" => self.right_arrow = flag(),
            "textColor" => self.text_color = color(),
            "textSize" => self.text_size = size().map(|s| s.within(6.0, 40.0)),
            "textBg" => self.text_bg = color(),
            "middle" => self.middle = flag(),
            "priceLabels" => self.price_labels = flag(),
            "labelRight" => self.label_right = flag(),
            "stats" => self.stats = flag(),
            "angle" => self.angle = flag(),
            "levels" => self.levels = Some(Level::parse_list(value)),
            "levelLabels" => self.level_labels = Some(flag()),
            "axis" => self.axis = value.bytes().next(),
            "atBar" => self.at_bar = flag(),
            "profitFill" => self.profit_fill = color(),
            "stopFill" => self.stop_fill = color(),
            "profitLine" => self.profit_line = color(),
            "stopLine" => self.stop_line = color(),
            "account" => self.account = num().filter(|v| *v > 0.0),
            "risk" => self.risk = num().filter(|v| *v > 0.0),
            "riskUnit" => self.risk_cash = value != "%",
            "lot" => self.lot = num().filter(|v| *v > 0.0),
            "leverage" => self.leverage = num().filter(|v| *v > 0.0),
            "sizeBy" => self.by_margin = value == "margin",
            "margin" => self.margin = num().filter(|v| *v > 0.0),
            "qtyDecimals" => self.qty_decimals = num().map(|v| v.within(0.0, 10.0) as usize),
            "legs" => {
                self.legs = value
                    .split('|')
                    .filter_map(|part| {
                        let mut f = part.split(',').map(str::trim);
                        let kind = *f.next()?.as_bytes().first()?;
                        let price = tradoor_core::format::parse_number(f.next()?)?;
                        let percent = tradoor_core::format::parse_number(f.next()?)?;
                        (matches!(kind, b't' | b'c' | b'a') && price.is_finite() && percent > 0.0 && percent <= 1000.0).then_some((kind, price, percent))
                    })
                    .take(12)
                    .collect()
            }
            "compact" => self.compact = flag(),
            "alwaysStats" => self.always_stats = flag(),
            "locked" => self.locked = flag(),
            "pane" => self.pane = [Group::Pct, Group::Stoch, Group::Macd, Group::Atr, Group::Oi, Group::Delta, Group::Cvd, Group::Volume].into_iter().find(|g| g.as_str() == value),
            _ => {}
        }
    }

    fn levels_for(&self, kind: DrawingKind) -> Vec<Level> {
        if let Some(levels) = &self.levels {
            return levels.clone();
        }
        // TradingView's defaults: a channel's quarter lines hidden and its middle
        // dashed; a fib's levels each in their own colour.
        let blue = Some(Color::hex(0x2962ff));
        let lvl = |value: f64, on: bool, color: Option<Color>, dash: Dash| Level { value, on, color, dash };
        match kind {
            DrawingKind::Channel => vec![
                lvl(-0.25, false, blue, Dash::Solid),
                lvl(0.0, true, None, Dash::Solid),
                lvl(0.25, false, blue, Dash::Solid),
                lvl(0.5, true, Some(Color::hex(0xff6d00)), Dash::Dashed),
                lvl(0.75, false, blue, Dash::Solid),
                lvl(1.0, true, None, Dash::Solid),
                lvl(1.25, false, blue, Dash::Solid),
            ],
            _ => [
                (0.0, true, 0x787b86),
                (0.236, true, 0xf23645),
                (0.382, true, 0xff9800),
                (0.5, true, 0x4caf50),
                (0.618, true, 0x089981),
                (0.786, true, 0x00bcd4),
                (1.0, true, 0x787b86),
                (1.618, false, 0x2962ff),
                (2.618, false, 0xf23645),
                (3.618, false, 0x9c27b0),
                (4.236, false, 0xe91e63),
            ]
            .into_iter()
            .map(|(v, on, c)| lvl(v, on, Some(Color::hex(c)), Dash::Solid))
            .collect(),
        }
    }

    fn extends(&self, kind: DrawingKind) -> (bool, bool) {
        (self.extend_left.unwrap_or(false), self.extend_right.unwrap_or(matches!(kind, DrawingKind::Fib | DrawingKind::FibExt)))
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct DrawingShape {
    /// `None` while it is still being placed.
    pub id: Option<i64>,
    pub kind: DrawingKind,
    pub points: Vec<Anchor>,
    pub label: Option<String>,
    pub style: DrawingStyle,
    /// The timeframe it was drawn at: on a longer one its points stand on the
    /// bars holding their times. `None`: the chart's own.
    pub timeframe: Option<ChartTimeframe>,
}

impl DrawingShape {
    pub fn new(id: Option<i64>, kind: DrawingKind, points: Vec<Anchor>) -> Self {
        Self { id, kind, points, label: None, style: DrawingStyle::default(), timeframe: None }
    }
}

/// A drawing's own numbers use significant digits rather than the instrument's
/// precision: a measure's delta is derived, and seven decimals of it help nobody.
pub fn significant(value: f64) -> String {
    let abs = value.abs();
    if abs >= 1000.0 {
        fixed(value, 0)
    } else if abs >= 1.0 {
        fixed(value, 2)
    } else if abs == 0.0 {
        "0".into()
    } else {
        let decimals = (2 - abs.log10().floor() as i32).max(0) as usize;
        fixed(value, decimals)
    }
}

pub struct Placed<'a> {
    pub shape: &'a DrawingShape,
    pub points: Vec<(f32, f32)>,
    pub selected: bool,
    pub draft: bool,
    /// The pointer is over it.
    pub hovered: bool,
    /// Bars between the first two anchors, for the measure readout.
    pub bars: i64,
    pub scale: PriceScale,
    /// The instrument's price decimals: one tick is `10^-precision`.
    pub precision: usize,
    /// The last close, for a position's open P&L.
    pub last: Option<f64>,
    /// The plot of the pane it stands in.
    pub plot: Rect,
    /// A regression's fitted line and its bands, on screen: centre, upper and lower, each from its first time to its second.
    pub fit: Option<[(f32, f32); 6]>,
    /// What a drawing reads off the bars: an anchored VWAP's line, or a volume
    /// profile's rows as (top, bottom, length) with the point of control first.
    pub series: Vec<(f32, f32, f32)>,
    /// One bar's width on screen, for what draws bars.
    pub bar_px: f32,
}

impl Placed<'_> {
    fn y(&self, price: f64) -> f32 {
        self.scale.y(price) as f32
    }

    fn price(&self, i: usize) -> f64 {
        self.shape.points.get(i).map_or(f64::NAN, |p| p.price)
    }

    /// A channel's offset from its first line to its second, in price, and the
    /// price of level `f` at each end of the first line.
    /// The channel line `f` of the way from the main line to the third point's.
    /// Offset on screen, not in price, so the lines stay parallel as drawn on a
    /// log scale too — as TradingView keeps them.
    fn channel_line(&self, f: f64) -> Option<((f32, f32), (f32, f32))> {
        let (a, b, c) = (self.points.first()?, self.points.get(1)?, self.points.get(2)?);
        let t = if (b.0 - a.0).abs() > f32::EPSILON { (c.0 - a.0) / (b.0 - a.0) } else { 0.0 };
        let offset = (c.1 - (a.1 + (b.1 - a.1) * t)) * f as f32;
        Some(((a.0, a.1 + offset), (b.0, b.1 + offset)))
    }

    /// A position box: left and right edges, and the entry, stop and target rows.
    fn position_box(&self) -> Option<(f32, f32, f32, f32, f32)> {
        let (a, b, c) = (self.points.first()?, self.points.get(1)?, self.points.get(2)?);
        let left = a.0.min(b.0).min(c.0);
        let right = a.0.max(b.0).max(c.0).max(left + MIN_POSITION_WIDTH);
        Some((left, right, a.1, b.1, c.1))
    }
}

/// Where the grab handles sit. For most kinds these are the anchors; a position
/// has handles on its left edge for the three prices and one on the right for
/// its width. A zone has eight: its corners, then the middle of each side, left,
/// right, top and bottom as drawn from its two anchors. A channel has six: the
/// ends of its first line, the ends of its second, then the middle of each line.
pub fn handles(d: &Placed<'_>) -> Vec<(f32, f32)> {
    match d.shape.kind {
        DrawingKind::Brush => Vec::new(),
        DrawingKind::Long | DrawingKind::Short => match d.position_box() {
            Some((left, right, entry, stop, target)) => vec![(left, entry), (left, stop), (left, target), (right, entry)],
            None => d.points.clone(),
        },
        DrawingKind::Channel => match d.channel_line(1.0) {
            Some((p, q)) => {
                let (a, b) = (d.points[0], d.points[1]);
                vec![a, b, p, q, mid(a, b), mid(p, q)]
            }
            None => d.points.clone(),
        },
        DrawingKind::Rect if d.points.len() >= 2 => {
            let (a, b) = (d.points[0], d.points[1]);
            let (mx, my) = ((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0);
            vec![a, b, (a.0, b.1), (b.0, a.1), (a.0, my), (b.0, my), (mx, a.1), (mx, b.1)]
        }
        _ => d.points.clone(),
    }
}

/// Steps around a circle: the turn of one step, as its cosine and sine, so a
/// round shape is traced by rotating rather than by the library's sin and cos.
const ROUND_STEPS: usize = 48;
const STEP_COS: f32 = 0.991_444_86;
const STEP_SIN: f32 = 0.130_526_19;

/// The points a shape is drawn through on screen, and whether it closes back on
/// its first: a circle and an ellipse traced around, a triangle and a turned
/// rectangle by their corners, an arc and the curves sampled along.
pub fn outline(kind: DrawingKind, p: &[(f32, f32)]) -> Option<(Vec<(f32, f32)>, bool)> {
    let (a, b) = (*p.first()?, *p.get(1)?);
    let round = |c: (f32, f32), rx: f32, ry: f32| {
        let (mut x, mut y) = (1.0f32, 0.0f32);
        let mut pts = Vec::with_capacity(ROUND_STEPS);
        for _ in 0..ROUND_STEPS {
            pts.push((c.0 + x * rx, c.1 + y * ry));
            (x, y) = (x * STEP_COS - y * STEP_SIN, x * STEP_SIN + y * STEP_COS);
        }
        pts
    };
    let sample = |f: &dyn Fn(f32) -> (f32, f32)| (0..=32).map(|i| f(i as f32 / 32.0)).collect::<Vec<_>>();
    Some(match kind {
        DrawingKind::Disk => {
            let r = (b.0 - a.0).hypot(b.1 - a.1);
            (round(a, r, r), true)
        }
        DrawingKind::Ellipse => (round(mid(a, b), (b.0 - a.0).abs() / 2.0, (b.1 - a.1).abs() / 2.0), true),
        DrawingKind::Triangle => (vec![a, b, *p.get(2)?], true),
        DrawingKind::RotRect => {
            let c = *p.get(2)?;
            let len = (b.0 - a.0).hypot(b.1 - a.1);
            if len < f32::EPSILON {
                return None;
            }
            let n = (-(b.1 - a.1) / len, (b.0 - a.0) / len);
            let h = (c.0 - a.0) * n.0 + (c.1 - a.1) * n.1;
            (vec![a, b, (b.0 + n.0 * h, b.1 + n.1 * h), (a.0 + n.0 * h, a.1 + n.1 * h)], true)
        }
        DrawingKind::Arc | DrawingKind::Curve | DrawingKind::DCurve => {
            let c = *p.get(2)?;
            // An arc passes through its third point halfway; a curve only leans towards it.
            let k = if kind == DrawingKind::Arc { (2.0 * c.0 - (a.0 + b.0) / 2.0, 2.0 * c.1 - (a.1 + b.1) / 2.0) } else { c };
            let pts = match p.get(3) {
                Some(&k2) if kind == DrawingKind::DCurve => sample(&|t| {
                    let u = 1.0 - t;
                    let (w0, w1, w2, w3) = (u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t);
                    (w0 * a.0 + w1 * k.0 + w2 * k2.0 + w3 * b.0, w0 * a.1 + w1 * k.1 + w2 * k2.1 + w3 * b.1)
                }),
                _ => sample(&|t| {
                    let u = 1.0 - t;
                    (u * u * a.0 + 2.0 * u * t * k.0 + t * t * b.0, u * u * a.1 + 2.0 * u * t * k.1 + t * t * b.1)
                }),
            };
            (pts, false)
        }
        _ => return None,
    })
}

/// A channel's or a pitchfork's lines on screen, the main one first, and the
/// band filled between its outer lines as four corners.
pub type Figure = (Vec<((f32, f32), (f32, f32))>, Option<[(f32, f32); 4]>);

pub fn figure(d: &Placed<'_>) -> Option<Figure> {
    let p = &d.points;
    let (a, b) = (*p.first()?, *p.get(1)?);
    let kind = d.shape.kind;
    if kind == DrawingKind::Regression {
        let f = d.fit?;
        return Some((vec![(f[0], f[1]), (f[2], f[3]), (f[4], f[5])], Some([f[2], f[3], f[5], f[4]])));
    }
    // Out from `a` through `to`, as far as the plot's edge the way it runs.
    let ray = |to: (f32, f32)| {
        let (dx, dy) = (to.0 - a.0, to.1 - a.1);
        let edge = if dx >= 0.0 { d.plot.right() } else { d.plot.x };
        let t = if dx.abs() > 0.5 { ((edge - a.0) / dx).max(1.0) } else { 1.0 };
        (a, (a.0 + dx * t, a.1 + dy * t))
    };
    match kind {
        DrawingKind::FibFan => {
            let mut lines: Vec<_> = FAN_RATIOS.iter().map(|r| ray((b.0, a.1 + (b.1 - a.1) * r))).collect();
            lines.extend(FAN_RATIOS.iter().map(|r| ray((a.0 + (b.0 - a.0) * r, b.1))));
            lines.insert(0, ray(b));
            return Some((lines, None));
        }
        DrawingKind::GannFan => {
            let (dx, dy) = (b.0 - a.0, b.1 - a.1);
            let mut lines = vec![ray(b)];
            for r in [2.0f32, 3.0, 4.0, 8.0] {
                lines.push(ray((a.0 + dx, a.1 + dy * r)));
                lines.push(ray((a.0 + dx * r, a.1 + dy)));
            }
            return Some((lines, None));
        }
        DrawingKind::GannBox => {
            let corners = [a, (b.0, a.1), b, (a.0, b.1)];
            let mut lines = vec![(a, b), (corners[1], corners[3])];
            for r in [0.0f32, 0.25, 0.382, 0.5, 0.618, 0.75, 1.0] {
                let (x, y) = (a.0 + (b.0 - a.0) * r, a.1 + (b.1 - a.1) * r);
                lines.push(((x, a.1), (x, b.1)));
                lines.push(((a.0, y), (b.0, y)));
            }
            return Some((lines, Some(corners)));
        }
        _ => {}
    }
    let c = *p.get(2)?;
    Some(match kind {
        DrawingKind::Flat => (vec![(a, b), ((a.0, c.1), (b.0, c.1))], Some([a, b, (b.0, c.1), (a.0, c.1)])),
        DrawingKind::Disjoint => {
            let end = (c.0 + (b.0 - a.0), c.1 - (b.1 - a.1));
            (vec![(a, b), (c, end)], Some([a, b, end, c]))
        }
        _ => {
            // Where the median starts: the pivot, or halfway up or along its swing.
            let pivot = match kind {
                DrawingKind::Schiff => (a.0, (a.1 + b.1) / 2.0),
                DrawingKind::ModSchiff => mid(a, b),
                _ => a,
            };
            let m = mid(b, c);
            let (dx, dy) = (m.0 - pivot.0, m.1 - pivot.1);
            // Out to the plot's right edge, or as far again as it came where it runs left.
            let reach = |from: (f32, f32)| {
                let t = if dx > 0.5 { ((d.plot.right() - from.0) / dx).max(1.0) } else { 2.0 };
                (from.0 + dx * t, from.1 + dy * t)
            };
            let (eb, ec) = (reach(b), reach(c));
            (vec![(pivot, reach(pivot)), (b, eb), (c, ec), (b, c)], Some([b, eb, ec, c]))
        }
    })
}

/// A fib fan's cuts of its move's rise and of its run.
const FAN_RATIOS: [f32; 4] = [0.382, 0.5, 0.618, 0.786];
/// A fib circle's rings, as parts of the distance to its second point.
const RING_RATIOS: [f32; 6] = [0.382, 0.5, 0.618, 1.0, 1.618, 2.618];

/// A fib time zone's lines: the Fibonacci numbers of its first span on from
/// its start, as far as the plot reaches.
fn fib_times(x0: f32, span: f32, plot: Rect) -> impl Iterator<Item = (u32, f32)> {
    [0u32, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233].into_iter().map(move |n| (n, x0 + span * n as f32)).take_while(move |(n, x)| *n == 0 || (span.abs() > 0.5 && *x >= plot.x && *x <= plot.right()))
}

fn centre(pts: &[(f32, f32)]) -> (f32, f32) {
    let n = pts.len().max(1) as f32;
    (pts.iter().map(|p| p.0).sum::<f32>() / n, pts.iter().map(|p| p.1).sum::<f32>() / n)
}

/// Inside a convex outline: on the same side of every edge.
fn inside_convex(pts: &[(f32, f32)], q: (f32, f32)) -> bool {
    let n = pts.len();
    let (mut pos, mut neg) = (false, false);
    for i in 0..n {
        let (p, r) = (pts[i], pts[(i + 1) % n]);
        let cross = (r.0 - p.0) * (q.1 - p.1) - (r.1 - p.1) * (q.0 - p.0);
        pos |= cross > 0.0;
        neg |= cross < 0.0;
    }
    !(pos && neg)
}

/// The angle of a rise over a run, in degrees, -90 to 90: a few multiplies
/// rather than the library's arctangent, which costs the engine more than its
/// worth here; within 0.1° of it.
fn angle_degrees(rise: f32, run: f32) -> f32 {
    if run.abs() < f32::EPSILON {
        return if rise >= 0.0 { 90.0 } else { -90.0 };
    }
    let z = rise / run;
    let atan = |z: f32| core::f32::consts::FRAC_PI_4 * z - z * (z.abs() - 1.0) * (0.2447 + 0.0663 * z.abs());
    let r = if z.abs() <= 1.0 { atan(z) } else { z.signum() * core::f32::consts::FRAC_PI_2 - atan(1.0 / z) };
    r * (180.0 / core::f32::consts::PI)
}

/// The handles drawn as squares: those that move a side or a whole line rather than a corner or an end.
fn square_handle(kind: DrawingKind, i: usize) -> bool {
    match kind {
        DrawingKind::Rect => i >= 4,
        DrawingKind::Channel => i >= 4,
        _ => false,
    }
}

fn mid(a: (f32, f32), b: (f32, f32)) -> (f32, f32) {
    ((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0)
}

/// A segment carried out to the plot's edges on the sides asked for.
fn extend(a: (f32, f32), b: (f32, f32), plot: Rect, left: bool, right: bool) -> ((f32, f32), (f32, f32)) {
    let dx = b.0 - a.0;
    if dx.abs() < f32::EPSILON {
        return (a, b);
    }
    let slope = (b.1 - a.1) / dx;
    let at = |x: f32| (x, a.1 + (x - a.0) * slope);
    let (l, r) = if a.0 <= b.0 { (a, b) } else { (b, a) };
    (if left { at(plot.x) } else { l }, if right { at(plot.right()) } else { r })
}

fn stroke(frame: &mut Frame, a: (f32, f32), b: (f32, f32), width: f32, color: Color, dash: Dash) {
    match dash {
        Dash::Dashed => frame.smooth_dashed_line(a.0, a.1, b.0, b.1, width, color, 6.0, 4.0),
        Dash::Dotted => frame.smooth_dashed_line(a.0, a.1, b.0, b.1, width, color, width.max(1.5), 3.0),
        Dash::Solid if a.1 == b.1 => frame.hline(a.0, b.0, a.1, width, color),
        Dash::Solid => frame.smooth_line(a.0, a.1, b.0, b.1, width, color),
    }
}

fn arrow(frame: &mut Frame, from: (f32, f32), tip: (f32, f32), width: f32, color: Color) {
    let (dx, dy) = (tip.0 - from.0, tip.1 - from.1);
    let len = dx.hypot(dy);
    if len < 1.0 {
        return;
    }
    let (ux, uy) = (dx / len, dy / len);
    let size = 7.0 + width * 1.5;
    let back = (tip.0 - ux * size, tip.1 - uy * size);
    frame.smooth_line(tip.0, tip.1, back.0 - uy * size * 0.5, back.1 + ux * size * 0.5, width, color);
    frame.smooth_line(tip.0, tip.1, back.0 + uy * size * 0.5, back.1 - ux * size * 0.5, width, color);
}

fn pct(from: f64, to: f64) -> f64 {
    if from == 0.0 {
        0.0
    } else {
        (to - from) / from * 100.0
    }
}

fn qty_text(qty: f64, decimals: Option<usize>) -> String {
    match decimals {
        Some(d) => fixed(qty, d),
        None => significant(qty),
    }
}

pub fn paint(frame: &mut Frame, d: &Placed<'_>, plot: Rect, theme: &Theme) {
    let Some(&a) = d.points.first() else { return };
    let style = &d.shape.style;
    let kind = d.shape.kind;
    let base = style.color.unwrap_or(theme.drawing);
    let color = if d.selected && style.color.is_none() { theme.drawing_selected } else { base };
    let width = style.width.unwrap_or(1.5) + if d.selected { 0.5 } else { 0.0 };
    let dash = if d.draft && style.dash == Dash::Solid { Dash::Dashed } else { style.dash };
    let font = style.text_size.unwrap_or(theme.font_px - 1.0);
    let text_color = style.text_color.unwrap_or(color);
    let fill = if style.fill_on.unwrap_or(true) { Some(style.fill.unwrap_or(base.with_alpha(26))) } else { None };
    let prices: Vec<f64> = d.shape.points.iter().map(|p| p.price).collect();
    let digits = Some(d.precision);
    let label = |frame: &mut Frame, x: f32, y: f32, text: String, align: Align, baseline: Baseline| {
        frame.text(x, y, text, text_color, align, baseline, font, style.text_bg, Some(plot));
    };
    let (b, c) = (d.points.get(1).copied(), d.points.get(2).copied());
    let (ext_left, ext_right) = style.extends(kind);

    match (kind, b, c) {
        (DrawingKind::Path | DrawingKind::Brush, _, _) => {
            let w = if kind == DrawingKind::Brush { width + 0.5 } else { width };
            if kind == DrawingKind::Brush && dash == Dash::Solid {
                // Solid while it is drawn too: a dashed brush stroke reads as broken.
                frame.ribbon(&d.points, w, color);
            } else if d.draft || dash != Dash::Solid {
                for pair in d.points.windows(2) {
                    stroke(frame, pair[0], pair[1], w, color, dash);
                }
            } else {
                frame.polyline(&d.points, w, color);
            }
            if let (Some(pair), true) = (d.points.windows(2).last(), style.right_arrow) {
                arrow(frame, pair[0], pair[1], w, color);
            }
        }
        // Marks at one point: an arrow at a bar, a flag, a pin, a price's tag.
        (DrawingKind::MarkUp | DrawingKind::MarkDown | DrawingKind::Flag | DrawingKind::Pin | DrawingKind::PriceLabel, _, _) => {
            let (x, y) = a;
            match kind {
                // A fill's arrow at its bar: slim, a fine stem under a small head, out of the candles' way.
                DrawingKind::MarkUp | DrawingKind::MarkDown if style.at_bar => {
                    let c = style.color.unwrap_or(if kind == DrawingKind::MarkUp { theme.bull } else { theme.bear });
                    let s = if kind == DrawingKind::MarkUp { 1.0 } else { -1.0 };
                    frame.triangle((x, y), (x - 4.5, y + 7.0 * s), (x + 4.5, y + 7.0 * s), c);
                    stroke(frame, (x, y + 6.0 * s), (x, y + 16.0 * s), 1.5, c, Dash::Solid);
                }
                DrawingKind::MarkUp | DrawingKind::MarkDown => {
                    let c = style.color.unwrap_or(if kind == DrawingKind::MarkUp { theme.bull } else { theme.bear });
                    let s = if kind == DrawingKind::MarkUp { 1.0 } else { -1.0 };
                    frame.triangle((x, y), (x - 8.0, y + 10.0 * s), (x + 8.0, y + 10.0 * s), c);
                    frame.rect(x - 3.0, if s > 0.0 { y + 10.0 } else { y - 22.0 }, 6.0, 12.0, c);
                }
                DrawingKind::Flag => {
                    stroke(frame, (x, y), (x, y - 26.0), 1.5, color, Dash::Solid);
                    frame.triangle((x, y - 26.0), (x + 16.0, y - 21.0), (x, y - 16.0), color);
                }
                DrawingKind::Pin => {
                    frame.triangle((x - 5.5, y - 13.0), (x + 5.5, y - 13.0), (x, y), color);
                    frame.circle(x, y - 16.0, 7.0, color);
                    frame.circle(x, y - 16.0, 2.5, theme.background);
                }
                _ => {
                    frame.triangle((x - 5.0, y - 9.0), (x + 5.0, y - 9.0), (x, y - 2.0), color);
                    frame.text(x, y - 9.0, format_price(prices[0], digits), color.contrast_text(), Align::Center, Baseline::Bottom, font, Some(color), Some(plot));
                }
            }
            if let (Some(text), false) = (&d.shape.label, kind == DrawingKind::PriceLabel) {
                label(frame, x + 12.0, y - 16.0, text.clone(), Align::Left, Baseline::Middle);
            }
        }
        // A level, a time, or both through one point.
        (DrawingKind::Horizontal | DrawingKind::Cross | DrawingKind::Vertical, _, _) => {
            if kind != DrawingKind::Vertical {
                stroke(frame, (plot.x, a.1), (plot.right(), a.1), width, color, dash);
            }
            if kind != DrawingKind::Horizontal {
                stroke(frame, (a.0, plot.y), (a.0, plot.bottom()), width, color, dash);
            }
            if style.label_right && kind == DrawingKind::Horizontal {
                // Name and price as one, at the right end, by the price axis.
                let text = match (&d.shape.label, style.price_labels) {
                    (Some(t), true) if !t.is_empty() => format!("{t}  {}", format_price(prices[0], digits)),
                    (Some(t), false) => t.clone(),
                    (_, true) => format_price(prices[0], digits),
                    _ => String::new(),
                };
                if !text.is_empty() {
                    label(frame, plot.right() - 6.0, a.1 - 3.0, text, Align::Right, Baseline::Bottom);
                }
            } else {
                if let Some(text) = &d.shape.label {
                    label(frame, plot.x + 6.0, a.1 - 3.0, text.clone(), Align::Left, Baseline::Bottom);
                }
                if style.price_labels {
                    frame.text(plot.right() - 4.0, a.1 - 2.0, format_price(prices[0], digits), text_color, Align::Right, Baseline::Bottom, font, None, Some(plot));
                }
            }
        }
        (DrawingKind::Ray, _, _) => {
            stroke(frame, a, (plot.right(), a.1), width, color, dash);
            if let Some(text) = &d.shape.label {
                label(frame, a.0 + 6.0, a.1 - 3.0, text.clone(), Align::Left, Baseline::Bottom);
            }
            if style.price_labels {
                frame.text(a.0 + 6.0, a.1 + 2.0, format_price(prices[0], digits), text_color, Align::Left, Baseline::Top, font, None, Some(plot));
            }
        }
        (DrawingKind::Circle, _, _) => {
            if let Some(fill) = fill {
                frame.circle(a.0, a.1, CIRCLE_PX, fill);
            }
            frame.ring(a.0, a.1, CIRCLE_PX, width, color);
            if let Some(text) = &d.shape.label {
                frame.text(a.0, a.1, text.clone(), text_color, Align::Center, Baseline::Middle, font, None, Some(plot));
            }
        }
        (DrawingKind::Text, _, _) => {
            if d.selected || d.draft {
                frame.vline(a.0, a.1 - 4.0, a.1 + 4.0, width, color);
            }
            let text = d.shape.label.clone().unwrap_or_default();
            let size = style.text_size.unwrap_or(theme.font_px + 1.0);
            let lines: Vec<&str> = text.lines().collect();
            for (i, line) in lines.iter().enumerate() {
                let y = a.1 - 2.0 - (lines.len() - 1 - i) as f32 * (size + 4.0);
                frame.text(a.0 + 6.0, y, *line, style.text_color.unwrap_or(color), Align::Left, Baseline::Bottom, size, style.text_bg, Some(plot));
            }
        }
        (DrawingKind::Rect, Some(b), _) => {
            if let Some(fill) = fill {
                frame.rect(a.0.min(b.0), a.1.min(b.1), (b.0 - a.0).abs(), (b.1 - a.1).abs(), fill);
            }
            let (l, r, t, btm) = (a.0.min(b.0), a.0.max(b.0), a.1.min(b.1), a.1.max(b.1));
            let (l2, r2) = (if ext_left { plot.x } else { l }, if ext_right { plot.right() } else { r });
            stroke(frame, (l2, t), (r2, t), width, color, dash);
            stroke(frame, (l2, btm), (r2, btm), width, color, dash);
            stroke(frame, (l, t), (l, btm), width, color, dash);
            stroke(frame, (r, t), (r, btm), width, color, dash);
            if style.middle {
                stroke(frame, (l2, (t + btm) / 2.0), (r2, (t + btm) / 2.0), width.min(1.0), color, Dash::Dashed);
            }
            if let Some(text) = &d.shape.label {
                label(frame, l + 4.0, t + 3.0, text.clone(), Align::Left, Baseline::Top);
            }
        }
        (DrawingKind::Fib | DrawingKind::FibExt, Some(b), _) => {
            // An extension measures its first move and lays it off from its third point.
            let (o, op) = match (kind, c) {
                (DrawingKind::FibExt, Some(c)) => (c, prices[2]),
                _ => (a, prices[0]),
            };
            let (left, right) = (a.0.min(b.0).min(o.0), a.0.max(b.0).max(o.0));
            let (x0, x1) = (if ext_left { plot.x } else { left }, if ext_right { plot.right() } else { right });
            let levels = style.levels_for(kind);
            let mut on: Vec<&Level> = levels.iter().filter(|l| l.on).collect();
            tradoor_core::sort::insertion_sort_by(&mut on, |p, q| p.value < q.value);
            if let Some(fill) = fill.filter(|_| style.fill_on == Some(true)) {
                for pair in on.windows(2) {
                    let y0 = o.1 + (b.1 - a.1) * pair[0].value as f32;
                    let y1 = o.1 + (b.1 - a.1) * pair[1].value as f32;
                    frame.rect(x0, y0.min(y1), x1 - x0, (y1 - y0).abs(), pair[0].color.unwrap_or(fill).with_alpha(fill.a));
                }
            }
            if !d.draft {
                stroke(frame, a, b, 1.0, color.with_alpha(110), Dash::Dashed);
                if kind == DrawingKind::FibExt {
                    stroke(frame, b, o, 1.0, color.with_alpha(110), Dash::Dashed);
                }
            }
            for level in on {
                let y = o.1 + (b.1 - a.1) * level.value as f32;
                let price = op + (prices[1] - prices[0]) * level.value;
                let c = level.color.unwrap_or(if level.value == 0.0 || level.value == 1.0 { color } else { color.with_alpha(180) });
                stroke(frame, (x0, y), (x1, y), width, c, if d.draft { Dash::Dashed } else { level.dash });
                if style.level_labels.unwrap_or(true) {
                    frame.text(x0 + 4.0, y - 2.0, format!("{}  ({})", trim_level(level.value), format_price(price, digits)), style.text_color.unwrap_or(c), Align::Left, Baseline::Bottom, font, None, Some(plot));
                }
            }
        }
        (DrawingKind::FibTime, Some(b), _) => {
            let span = b.0 - a.0;
            for (n, x) in fib_times(a.0, span, plot) {
                stroke(frame, (x, plot.y), (x, plot.bottom()), width.min(1.5), color, if n == 0 { Dash::Solid } else { dash });
                frame.text(x + 3.0, plot.y + 3.0, fixed(f64::from(n), 0), text_color, Align::Left, Baseline::Top, font, None, Some(plot));
            }
        }
        (DrawingKind::Measure, Some(b), _) => {
            let up = prices[1] >= prices[0];
            let tone = style.color.unwrap_or(if up { theme.reward } else { theme.risk });
            frame.rect(a.0.min(b.0), a.1.min(b.1), (b.0 - a.0).abs(), (b.1 - a.1).abs(), style.fill.unwrap_or(tone.with_alpha(40)));
            let mid_y = (a.1 + b.1) / 2.0;
            let mid_x = (a.0 + b.0) / 2.0;
            // A price range has only its rise, a date range only its run.
            let (time, price) = (style.axis != Some(b'p'), style.axis != Some(b't'));
            if time {
                stroke(frame, (a.0, mid_y), (b.0, mid_y), 1.0, tone, Dash::Solid);
                arrow(frame, (a.0, mid_y), (b.0, mid_y), 1.0, tone);
            }
            if price {
                stroke(frame, (mid_x, a.1), (mid_x, b.1), 1.0, tone, Dash::Solid);
                arrow(frame, (mid_x, a.1), (mid_x, b.1), 1.0, tone);
            }
            let (from, to) = (prices[0], prices[1]);
            let sign = if up { "+" } else { "" };
            let bars = d.bars.abs();
            let ticks = ((to - from) / 10f64.powi(-(d.precision as i32))).round();
            let bar_text = format!("{bars} bar{}", if bars == 1 { "" } else { "s" });
            let text = match (time, price) {
                (false, _) => format!("{sign}{} ({sign}{}%) {sign}{}", format_price(to - from, digits), fixed(pct(from, to), 2), fixed(ticks, 0)),
                (_, false) => bar_text,
                _ => format!("{sign}{} ({sign}{}%) {sign}{}, {bar_text}", format_price(to - from, digits), fixed(pct(from, to), 2), fixed(ticks, 0)),
            };
            let y = if up { a.1.min(b.1) - 6.0 } else { a.1.max(b.1) + 6.0 };
            frame.text(mid_x, y, text, tone.contrast_text(), Align::Center, if up { Baseline::Bottom } else { Baseline::Top }, font, Some(tone), Some(plot));
        }
        (DrawingKind::Long | DrawingKind::Short, Some(_), Some(_)) => paint_position(frame, d, plot, theme, font),
        (DrawingKind::Channel, Some(b), None) => stroke(frame, a, b, width, color, dash),
        (DrawingKind::Channel, Some(_), Some(_)) => {
            let levels = style.levels_for(kind);
            let line = |f: f64| d.channel_line(f).map(|(p, q)| extend(p, q, plot, ext_left, ext_right));
            if let (Some(fill), Some((p0, q0)), Some((p1, q1))) = (fill, line(0.0), line(1.0)) {
                // Two triangles: the band between the main lines.
                frame.triangle(p0, q0, q1, fill);
                frame.triangle(p0, q1, p1, fill);
            }
            for level in levels.iter().filter(|l| l.on || l.value == 0.0 || l.value == 1.0) {
                let Some((p, q)) = line(level.value) else { continue };
                let main = level.value == 0.0 || level.value == 1.0;
                let c = level.color.unwrap_or(if main { color } else { theme.drawing_selected.with_alpha(200) });
                stroke(frame, p, q, if main { width } else { width.min(1.5) }, c, if d.draft { Dash::Dashed } else { level.dash });
            }
            if let (Some(text), Some((p, q))) = (&d.shape.label, line(1.0)) {
                label(frame, (p.0 + q.0) / 2.0, (p.1 + q.1) / 2.0 - 4.0, text.clone(), Align::Center, Baseline::Bottom);
            }
        }
        (DrawingKind::Marker, Some(b), _) => {
            let (dx, dy) = (b.0 - a.0, b.1 - a.1);
            let len = dx.hypot(dy);
            if len > 1.0 {
                let (ux, uy) = (dx / len, dy / len);
                let head = (10.0 + width * 2.0).min(len);
                let half = 2.0 + width;
                let base = (b.0 - ux * head, b.1 - uy * head);
                let (nx, ny) = (-uy, ux);
                let q = |p: (f32, f32), w: f32| ((p.0 + nx * w, p.1 + ny * w), (p.0 - nx * w, p.1 - ny * w));
                let ((a1, a2), (b1, b2), (h1, h2)) = (q(a, half), q(base, half), q(base, head * 0.6));
                frame.triangle(a1, a2, b1, color);
                frame.triangle(b1, a2, b2, color);
                frame.triangle(b, h1, h2, color);
            }
        }
        (DrawingKind::PriceNote | DrawingKind::Callout, Some(b), _) => {
            stroke(frame, a, b, width.min(1.5), color, dash);
            frame.circle(a.0, a.1, 2.5, color);
            if kind == DrawingKind::PriceNote {
                frame.text(b.0, b.1, format_price(prices[0], digits), color.contrast_text(), Align::Center, Baseline::Middle, font, Some(color), Some(plot));
            } else if let Some(text) = &d.shape.label {
                // A line of the note each, stacked down from where the box was put.
                let size = style.text_size.unwrap_or(font);
                for (i, line) in text.split('\n').enumerate() {
                    frame.text(b.0, b.1 + i as f32 * (size + 4.0), line, style.text_color.unwrap_or(color.contrast_text()), Align::Left, Baseline::Middle, size, Some(style.text_bg.unwrap_or(color)), Some(plot));
                }
            }
        }
        (DrawingKind::AnchoredVwap, _, _) => {
            let line: Vec<(f32, f32)> = d.series.iter().map(|p| (p.0, p.1)).collect();
            frame.polyline(&line, width, color);
            if let Some(end) = line.last() {
                frame.text(end.0 + 4.0, end.1, "VWAP", text_color, Align::Left, Baseline::Middle, font, None, Some(plot));
            }
            // The anchor on the line itself: the VWAP of its own bar.
            let at = line.first().copied().unwrap_or(a);
            frame.circle(at.0, at.1, 3.0, color);
        }
        (DrawingKind::BarsPattern, Some(b), _) => {
            // The copied range marked where it was taken from; the copy, a wick and a body a bar, where it was put.
            let (x0, x1) = (a.0.min(b.0), a.0.max(b.0));
            stroke(frame, (x0, a.1), (x1, a.1), 1.0, color.with_alpha(110), Dash::Dotted);
            let body = (d.bar_px * 0.6).max(1.0);
            for pair in d.series.chunks(2) {
                if let [(x, high, low), (_, open, close)] = pair {
                    let up = close <= open;
                    let tone = if up { theme.bull } else { theme.bear }.with_alpha(120);
                    frame.rect(x - 0.5, *high, 1.0, (low - high).max(1.0), tone);
                    frame.rect(x - body / 2.0, open.min(*close), body, (open - close).abs().max(1.0), tone);
                }
            }
        }
        (DrawingKind::VolumeProfile, Some(b), _) => {
            let (x0, x1) = (a.0.min(b.0), a.0.max(b.0));
            for (i, &(top, bottom, len)) in d.series.iter().enumerate() {
                let poc = i == 0;
                frame.rect(x0, top, len, (bottom - top - 1.0).max(1.0), if poc { color.with_alpha(200) } else { fill.unwrap_or(color.with_alpha(70)) });
                if poc {
                    stroke(frame, (x0, (top + bottom) / 2.0), (x1, (top + bottom) / 2.0), 1.0, color, Dash::Dashed);
                }
            }
            if let (Some(t), Some(btm)) = (d.series.iter().map(|r| r.0).reduce(f32::min), d.series.iter().map(|r| r.1).reduce(f32::max)) {
                for (p, q) in [((x0, t), (x1, t)), ((x1, t), (x1, btm)), ((x1, btm), (x0, btm)), ((x0, btm), (x0, t))] {
                    stroke(frame, p, q, 1.0, color.with_alpha(120), Dash::Dotted);
                }
            }
        }
        (DrawingKind::FibCircles, Some(b), _) => {
            let r = (b.0 - a.0).hypot(b.1 - a.1);
            stroke(frame, a, b, 1.0, color.with_alpha(110), Dash::Dashed);
            for k in RING_RATIOS {
                if let Some((mut ring, _)) = outline(DrawingKind::Disk, &[a, (a.0 + r * k, a.1)]) {
                    ring.push(ring[0]);
                    frame.polyline(&ring, width.min(1.5), if k == 1.0 { color } else { color.with_alpha(170) });
                }
                frame.text(a.0 + r * k + 3.0, a.1 - 2.0, trim_level(f64::from(k)), text_color, Align::Left, Baseline::Bottom, font, None, Some(plot));
            }
        }
        (DrawingKind::Signpost | DrawingKind::Comment, _, _) => {
            let (x, y) = a;
            let text = d.shape.label.clone().unwrap_or_default();
            let (bg, fg) = (style.text_bg.unwrap_or(color), style.text_color.unwrap_or(color.contrast_text()));
            if kind == DrawingKind::Signpost {
                stroke(frame, (x, y), (x, y - 30.0), 1.5, color, Dash::Solid);
                frame.circle(x, y, 3.0, color);
                frame.text(x, y - 30.0, text, fg, Align::Center, Baseline::Bottom, font, Some(bg), Some(plot));
            } else {
                frame.triangle((x, y), (x + 4.0, y - 10.0), (x + 12.0, y - 10.0), bg);
                frame.text(x, y - 10.0, text, fg, Align::Left, Baseline::Bottom, font, Some(bg), Some(plot));
            }
        }
        (DrawingKind::Regression | DrawingKind::Flat | DrawingKind::Disjoint | DrawingKind::Pitchfork | DrawingKind::Schiff | DrawingKind::ModSchiff | DrawingKind::FibFan | DrawingKind::GannBox | DrawingKind::GannFan, Some(_), _) if figure(d).is_some() => {
            let Some((lines, band)) = figure(d) else { return };
            if let (Some(q), Some(fill)) = (band, fill) {
                frame.triangle(q[0], q[1], q[2], fill);
                frame.triangle(q[0], q[2], q[3], fill);
            }
            for (i, (p, q)) in lines.iter().enumerate() {
                // The first is the main line; the rest are its guides, a touch lighter.
                stroke(frame, *p, *q, if i == 0 { width } else { width.min(1.5) }, color, dash);
            }
            if let (Some(text), Some((p, q))) = (&d.shape.label, lines.first()) {
                label(frame, (p.0 + q.0) / 2.0, (p.1 + q.1) / 2.0 - 4.0, text.clone(), Align::Center, Baseline::Bottom);
            }
        }
        (DrawingKind::Disk | DrawingKind::Ellipse | DrawingKind::Triangle | DrawingKind::RotRect | DrawingKind::Arc | DrawingKind::Curve | DrawingKind::DCurve, Some(b), _) if outline(kind, &d.points).is_some() => {
            let Some((pts, closed)) = outline(kind, &d.points) else { return };
            if let (true, Some(fill)) = (closed, fill) {
                // Every closed shape here is convex: a fan from its middle fills it.
                let m = centre(&pts);
                for i in 0..pts.len() {
                    frame.triangle(m, pts[i], pts[(i + 1) % pts.len()], fill);
                }
            }
            let mut line = pts.clone();
            if closed {
                line.push(pts[0]);
            }
            if d.draft || dash != Dash::Solid {
                for w in line.windows(2) {
                    stroke(frame, w[0], w[1], width, color, dash);
                }
            } else {
                frame.polyline(&line, width, color);
            }
            if let Some(text) = &d.shape.label {
                let at = if closed { centre(&pts) } else { mid(a, b) };
                label(frame, at.0, at.1, text.clone(), Align::Center, Baseline::Middle);
            }
        }
        (_, Some(b), _) => {
            // Trendline.
            let (p, q) = extend(a, b, plot, ext_left, ext_right);
            stroke(frame, p, q, width, color, dash);
            if style.left_arrow {
                arrow(frame, b, a, width, color);
            }
            if style.right_arrow {
                arrow(frame, a, b, width, color);
            }
            if style.middle {
                let m = ((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0);
                frame.circle(m.0, m.1, 3.0 + width / 2.0, color);
            }
            if style.angle && (b.0 - a.0).hypot(b.1 - a.1) > 1.0 {
                // A level line out from the first end, the side the line runs, and the angle between them.
                let side = if b.0 >= a.0 { 1.0 } else { -1.0 };
                stroke(frame, a, (a.0 + 48.0 * side, a.1), width.min(1.0), color, Dash::Dashed);
                let deg = angle_degrees(a.1 - b.1, (b.0 - a.0) * side);
                let at = (a.0 + 54.0 * side, a.1 + if deg >= 0.0 { -2.0 } else { 2.0 });
                frame.text(at.0, at.1, format!("{}°", fixed(f64::from(deg), 1)), text_color, if side > 0.0 { Align::Left } else { Align::Right }, if deg >= 0.0 { Baseline::Bottom } else { Baseline::Top }, font, None, Some(plot));
            }
            if style.price_labels {
                for (i, pt) in [a, b].iter().enumerate() {
                    let above = pt.1 <= [a, b][1 - i].1;
                    frame.text(pt.0, pt.1 + if above { -6.0 } else { 6.0 }, format_price(prices[i], digits), color.contrast_text(), Align::Center, if above { Baseline::Bottom } else { Baseline::Top }, font, Some(color), Some(plot));
                }
            }
            if let Some(text) = &d.shape.label {
                label(frame, (a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0 - 4.0, text.clone(), Align::Center, Baseline::Bottom);
            }
            if style.stats && !d.draft {
                let (from, to) = (prices[0], prices[1]);
                let sign = if to >= from { "+" } else { "" };
                let bars = d.bars.abs();
                let text = format!("{sign}{} ({sign}{}%), {bars} bar{}", format_price(to - from, digits), fixed(pct(from, to), 2), if bars == 1 { "" } else { "s" });
                let right = if b.0 >= a.0 { b } else { a };
                frame.text(right.0 + 8.0, right.1, text, text_color, Align::Left, Baseline::Middle, font, Some(theme.background.with_alpha(210)), Some(plot));
            }
        }
        _ => {}
    }

    if d.selected {
        for (i, p) in handles(d).into_iter().enumerate() {
            if square_handle(d.shape.kind, i) {
                frame.rect(p.0 - 4.5, p.1 - 4.5, 9.0, 9.0, theme.drawing_selected);
                frame.rect(p.0 - 3.0, p.1 - 3.0, 6.0, 6.0, theme.handle);
            } else {
                frame.circle(p.0, p.1, 5.0, theme.drawing_selected);
                frame.circle(p.0, p.1, 3.5, theme.handle);
            }
        }
    }
}

/// `0.618` rather than `0.6180000`, `1` rather than `1.0`.
fn trim_level(v: f64) -> String {
    let s = fixed(v, 3);
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// The coins a position's entry buys (bins/server journal, `coins_of`): what its
/// margin buys at its leverage, or what its risk buys over its stop.
fn position_coins(style: &DrawingStyle, entry: f64, stop: f64) -> f64 {
    let risk_per = (entry - stop).abs();
    if style.by_margin {
        if entry > 0.0 { style.margin.unwrap_or(100.0) * style.leverage.unwrap_or(1.0) / entry } else { 0.0 }
    } else if risk_per > 0.0 {
        let risk = if style.risk_cash { style.risk.unwrap_or(10.0) } else { style.account.unwrap_or(1000.0) * style.risk.unwrap_or(1.0) / 100.0 };
        risk / risk_per
    } else {
        0.0
    }
}

/// TradingView's long and short position: a target box and a stop box either
/// side of the entry, with the quantity it holds and what that makes.
fn paint_position(frame: &mut Frame, d: &Placed<'_>, plot: Rect, theme: &Theme, font: f32) {
    let Some((left, right, entry_y, stop_y, target_y)) = d.position_box() else { return };
    let style = &d.shape.style;
    let long = d.shape.kind == DrawingKind::Long;
    let (entry, stop, target) = (d.price(0), d.price(1), d.price(2));
    let profit_line = style.profit_line.unwrap_or(theme.reward);
    let stop_line = style.stop_line.unwrap_or(theme.risk);
    let profit_fill = style.profit_fill.unwrap_or(profit_line.with_alpha(56));
    let stop_fill = style.stop_fill.unwrap_or(stop_line.with_alpha(56));
    let w = right - left;

    frame.rect(left, target_y.min(entry_y), w, (target_y - entry_y).abs(), profit_fill);
    frame.rect(left, stop_y.min(entry_y), w, (stop_y - entry_y).abs(), stop_fill);
    let entry_line = style.color.unwrap_or(Color::hex(0x9598a1));
    frame.hline(left, right, entry_y, 1.0, entry_line);
    if d.selected {
        frame.hline(left, right, target_y, 1.0, profit_line);
        frame.hline(left, right, stop_y, 1.0, stop_line);
    }
    // Its name over the box, or under it where the top is off the plot: a journal
    // trade drawn where it went says which and how it did (web journal/picture.ts).
    if let Some(text) = &d.shape.label {
        let (top, bottom) = (target_y.min(stop_y), target_y.max(stop_y));
        let (y, baseline) = if top - font - 6.0 < plot.y { (bottom + 4.0, Baseline::Top) } else { (top - 4.0, Baseline::Bottom) };
        frame.text(left, y, text.clone(), theme.text, Align::Left, baseline, font, None, Some(plot));
    }
    // Its legs, those its prices allow (bins/server journal, `legs_of`): a
    // dashed line each across the box, named once the figures are up.
    let between = |p: f64, a: f64, b: f64| p > a.min(b) && p < a.max(b);
    let legs: Vec<(u8, f64, f64)> = style
        .legs
        .iter()
        .copied()
        .filter(|&(k, p, _)| match k {
            b't' => between(p, entry, target),
            b'c' => between(p, entry, stop),
            _ => between(p, stop, target) && p != entry,
        })
        .collect();
    let figures = style.always_stats || d.selected || d.hovered || d.draft;
    for &(k, p, percent) in &legs {
        let (color, name) = match k {
            b't' => (profit_line, "TP"),
            b'c' => (stop_line, "SL"),
            _ => (entry_line, "Add"),
        };
        let y = d.y(p);
        frame.dashed_line(left, y, right, y, 1.0, color, 4.0, 3.0);
        if figures {
            frame.text(right - 4.0, y - 2.0, format!("{name} {}%", trim_level(percent)), color, Align::Right, Baseline::Bottom, font, None, Some(plot));
        }
    }
    // As on TradingView: the figures come up under the pointer, or once selected.
    if !figures {
        return;
    }

    let tick = 10f64.powi(-(d.precision as i32));
    let risk_per = (entry - stop).abs();
    let reward_per = (target - entry).abs();
    let lot = style.lot.unwrap_or(1.0);
    let qty = position_coins(style, entry, stop) / lot;
    let rr = if risk_per > 0.0 { reward_per / risk_per } else { 0.0 };
    let digits = Some(d.precision);
    let cx = left + w / 2.0;
    let text = style.text_color;
    let tag = |frame: &mut Frame, y: f32, s: String, bg: Color, baseline: Baseline| {
        frame.text(cx, y, s, text.unwrap_or(bg.contrast_text()), Align::Center, baseline, font, Some(bg), Some(plot));
    };
    let line = |name: &str, price: f64, amount: f64| {
        let move_pct = pct(entry, price).abs();
        let ticks = ((price - entry).abs() / tick).round();
        if style.compact {
            format!("{} ({}%) {}", format_price(price, digits), fixed(move_pct, 2), significant(amount))
        } else {
            format!("{name}: {} ({}%) {}, Amount: {}", format_price(price, digits), fixed(move_pct, 2), fixed(ticks, 0), significant(amount))
        }
    };
    let target_above = target_y <= entry_y;
    // What running to the target makes and to the stop loses, the legs on the way filled.
    let dir = if long { 1.0 } else { -1.0 };
    let made = |end: f64| run_to(entry, end, qty * lot, &legs, dir).abs();
    tag(frame, target_y + if target_above { -5.0 } else { 5.0 }, line("Target", target, made(target)), profit_line, if target_above { Baseline::Bottom } else { Baseline::Top });
    tag(frame, stop_y + if target_above { 5.0 } else { -5.0 }, line("Stop", stop, made(stop)), stop_line, if target_above { Baseline::Top } else { Baseline::Bottom });

    let qty = qty_text(qty, style.qty_decimals);
    let (first, second) = match d.last.filter(|_| !d.draft) {
        Some(last) if !style.compact => {
            let pnl = (last - entry) * if long { 1.0 } else { -1.0 } * lot;
            let q = tradoor_core::format::parse_number(&qty).unwrap_or(0.0);
            (format!("Open P&L: {}, Qty: {qty}", significant(pnl * q)), format!("Risk/Reward Ratio: {}", fixed(rr, 2)))
        }
        _ if style.compact => (qty.clone(), fixed(rr, 2)),
        _ => (format!("Qty: {qty}"), format!("Risk/Reward Ratio: {}", fixed(rr, 2))),
    };
    let grey = Color::hex(0x9598a1);
    let (up, down) = if target_above { (Baseline::Top, Baseline::Top) } else { (Baseline::Bottom, Baseline::Bottom) };
    let row = font + 5.0;
    if target_above {
        tag(frame, entry_y + 4.0, first, grey, up);
        tag(frame, entry_y + 4.0 + row, second, grey, up);
    } else {
        tag(frame, entry_y - 4.0 - row, first, grey, down);
        tag(frame, entry_y - 4.0, second, grey, down);
    }
}

/// What a position of `qty` coins makes running from its entry to `end`, the
/// legs on the way filled, against their average entry: all of it closed by
/// then, so the order they fill in does not count — but for takes and cuts
/// asking more than was bought, scaled down to it. (Unsorted: a sort here is
/// kilobytes of engine.)
fn run_to(entry: f64, end: f64, qty: f64, legs: &[(u8, f64, f64)], dir: f64) -> f64 {
    let (mut bought, mut cost, mut out, mut proceeds) = (qty, entry * qty, 0.0, 0.0);
    for &(kind, price, percent) in legs.iter().filter(|l| (l.1 - entry) * (end - entry) > 0.0) {
        let q = percent / 100.0 * qty;
        if kind == b'a' {
            bought += q;
            cost += price * q;
        } else {
            out += q;
            proceeds += price * q;
        }
    }
    if out > bought {
        proceeds *= bought / out;
        out = bought;
    }
    proceeds += end * (bought - out);
    (proceeds - cost) * dir
}

/// How far the pointer is from a drawing, in pixels — zero inside a filled
/// shape that is picked by its body.
pub fn distance(d: &Placed<'_>, cursor: (f32, f32), plot: Rect) -> f32 {
    let style = &d.shape.style;
    let kind = d.shape.kind;
    let (ext_left, ext_right) = style.extends(kind);
    match kind {
        DrawingKind::Long | DrawingKind::Short => match d.position_box() {
            Some((left, right, _, stop, target)) => {
                let (top, bottom) = (stop.min(target), stop.max(target));
                if cursor.0 >= left && cursor.0 <= right && cursor.1 >= top && cursor.1 <= bottom {
                    0.0
                } else {
                    let dx = (left - cursor.0).max(cursor.0 - right).max(0.0);
                    let dy = (top - cursor.1).max(cursor.1 - bottom).max(0.0);
                    dx.hypot(dy)
                }
            }
            None => f32::INFINITY,
        },
        DrawingKind::Channel if d.points.len() >= 3 => {
            let levels = style.levels_for(kind);
            let line = |f: f64| d.channel_line(f).map(|(p, q)| extend(p, q, plot, ext_left, ext_right));
            let mut best = levels
                .iter()
                .filter(|l| l.on || l.value == 0.0 || l.value == 1.0)
                .filter_map(|l| line(l.value))
                .map(|(p, q)| distance_to_segment(cursor, p, q))
                .fold(f32::INFINITY, f32::min);
            if let (true, Some((p0, q0)), Some((p1, _))) = (style.fill_on.unwrap_or(true), line(0.0), line(1.0)) {
                let span = q0.0 - p0.0;
                if span.abs() > f32::EPSILON && (cursor.0 - p0.0) / span >= 0.0 && (cursor.0 - p0.0) / span <= 1.0 {
                    let t = (cursor.0 - p0.0) / span;
                    let y0 = p0.1 + (q0.1 - p0.1) * t;
                    let y1 = y0 + (p1.1 - p0.1);
                    if cursor.1 >= y0.min(y1) && cursor.1 <= y0.max(y1) {
                        best = 0.0;
                    }
                }
            }
            best
        }
        DrawingKind::FibTime if d.points.len() >= 2 => {
            let (a, b) = (d.points[0], d.points[1]);
            fib_times(a.0, b.0 - a.0, plot).map(|(_, x)| (cursor.0 - x).abs()).fold(f32::INFINITY, f32::min)
        }
        DrawingKind::Fib | DrawingKind::FibExt if d.points.len() >= 2 => {
            let (a, b) = (d.points[0], d.points[1]);
            let o = if kind == DrawingKind::FibExt { d.points.get(2).copied().unwrap_or(a) } else { a };
            let (left, right) = (a.0.min(b.0).min(o.0), a.0.max(b.0).max(o.0));
            let (x0, x1) = (if ext_left { plot.x } else { left }, if ext_right { plot.right() } else { right });
            if cursor.0 < x0 - 4.0 || cursor.0 > x1 + 4.0 {
                return f32::INFINITY;
            }
            style.levels_for(kind).iter().filter(|l| l.on).map(|l| (cursor.1 - (o.1 + (b.1 - a.1) * l.value as f32)).abs()).fold(f32::INFINITY, f32::min)
        }
        DrawingKind::Trendline if d.points.len() >= 2 => {
            let (p, q) = extend(d.points[0], d.points[1], plot, ext_left, ext_right);
            distance_to_segment(cursor, p, q)
        }
        DrawingKind::Disk | DrawingKind::Ellipse | DrawingKind::Triangle | DrawingKind::RotRect | DrawingKind::Arc | DrawingKind::Curve | DrawingKind::DCurve => match outline(kind, &d.points) {
            Some((pts, closed)) => {
                let n = pts.len();
                let edges = if closed { n } else { n - 1 };
                let near = (0..edges).map(|i| distance_to_segment(cursor, pts[i], pts[(i + 1) % n])).fold(f32::INFINITY, f32::min);
                if closed && style.fill_on.unwrap_or(true) && inside_convex(&pts, cursor) { 0.0 } else { near }
            }
            None => f32::INFINITY,
        },
        DrawingKind::BarsPattern => d.series.chunks(2).filter_map(|p| p.first()).map(|&(x, h, l)| if cursor.1 >= h && cursor.1 <= l { (cursor.0 - x).abs() } else { f32::INFINITY }).fold(f32::INFINITY, f32::min).min(d.points.iter().map(|p| (cursor.0 - p.0).hypot(cursor.1 - p.1)).fold(f32::INFINITY, f32::min)),
        DrawingKind::AnchoredVwap => d.series.windows(2).map(|w| distance_to_segment(cursor, (w[0].0, w[0].1), (w[1].0, w[1].1))).fold(((cursor.0 - d.points[0].0).hypot(cursor.1 - d.points[0].1) - 4.0).max(0.0), f32::min),
        DrawingKind::VolumeProfile if d.points.len() >= 2 => {
            let (x0, x1) = (d.points[0].0.min(d.points[1].0), d.points[0].0.max(d.points[1].0));
            match (d.series.iter().map(|r| r.0).reduce(f32::min), d.series.iter().map(|r| r.1).reduce(f32::max)) {
                (Some(t), Some(b)) if cursor.0 >= x0 && cursor.0 <= x1 && cursor.1 >= t && cursor.1 <= b => 0.0,
                (Some(t), Some(b)) => distance_to_segment(cursor, (x0, t), (x0, b)).min(distance_to_segment(cursor, (x1, t), (x1, b))),
                _ => f32::INFINITY,
            }
        }
        DrawingKind::FibCircles if d.points.len() >= 2 => {
            let (a, b) = (d.points[0], d.points[1]);
            let (r, at) = ((b.0 - a.0).hypot(b.1 - a.1), (cursor.0 - a.0).hypot(cursor.1 - a.1));
            RING_RATIOS.iter().map(|k| (at - r * k).abs()).fold(f32::INFINITY, f32::min)
        }
        DrawingKind::Signpost | DrawingKind::Comment => {
            let (x, y) = d.points[0];
            ((cursor.0 - x).hypot(cursor.1 - (y - 22.0)) - 18.0).max(0.0)
        }
        DrawingKind::Regression | DrawingKind::Flat | DrawingKind::Disjoint | DrawingKind::Pitchfork | DrawingKind::Schiff | DrawingKind::ModSchiff | DrawingKind::FibFan | DrawingKind::GannBox | DrawingKind::GannFan => match figure(d) {
            Some((lines, band)) => {
                let near = lines.iter().map(|(p, q)| distance_to_segment(cursor, *p, *q)).fold(f32::INFINITY, f32::min);
                match band {
                    Some(q) if style.fill_on.unwrap_or(true) && (inside_convex(&[q[0], q[1], q[2]], cursor) || inside_convex(&[q[0], q[2], q[3]], cursor)) => 0.0,
                    _ => near,
                }
            }
            None => f32::INFINITY,
        },
        DrawingKind::MarkUp | DrawingKind::MarkDown | DrawingKind::Flag | DrawingKind::Pin | DrawingKind::PriceLabel => {
            let (x, y) = d.points[0];
            let at = match kind {
                DrawingKind::MarkUp => (x, y + 11.0),
                DrawingKind::MarkDown => (x, y - 11.0),
                DrawingKind::Flag => (x + 6.0, y - 18.0),
                _ => (x, y - 14.0),
            };
            ((cursor.0 - at.0).hypot(cursor.1 - at.1) - 12.0).max(0.0)
        }
        DrawingKind::Marker | DrawingKind::PriceNote | DrawingKind::Callout if d.points.len() >= 2 => {
            let (a, b) = (d.points[0], d.points[1]);
            let tag = if kind == DrawingKind::Marker { f32::INFINITY } else { ((cursor.0 - b.0).hypot(cursor.1 - b.1) - 16.0).max(0.0) };
            distance_to_segment(cursor, a, b).min(tag)
        }
        DrawingKind::Vertical => (cursor.0 - d.points[0].0).abs(),
        DrawingKind::Cross => (cursor.0 - d.points[0].0).abs().min((cursor.1 - d.points[0].1).abs()),
        DrawingKind::Circle => ((cursor.0 - d.points[0].0).hypot(cursor.1 - d.points[0].1) - CIRCLE_PX).max(0.0),
        _ => distance_to_drawing(kind, &d.points, cursor, &FIB_LEVELS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_positions_legs_change_what_its_target_and_stop_come_to() {
        let s = DrawingStyle::from_pairs([("legs", "t,110,50|a,95,100|x,1,1|c,96")]);
        assert_eq!(s.legs, vec![(b't', 110.0, 50.0), (b'a', 95.0, 100.0)]);
        assert_eq!(run_to(100.0, 120.0, 2.0, &[], 1.0), 40.0);
        assert_eq!(run_to(100.0, 120.0, 2.0, &s.legs, 1.0), 30.0, "half taken at 110, half run to 120; the add is not on the way");
        assert_eq!(run_to(100.0, 90.0, 2.0, &s.legs, 1.0), -30.0, "two more coins at 95, all four stopped at 90");
        assert_eq!(run_to(100.0, 90.0, 1.0, &[(b'c', 95.0, 50.0)], -1.0), 7.5, "a short gains as it falls");
    }

    #[test]
    fn an_angle_is_near_the_library_s() {
        for (rise, run) in [(1.0, 1.0), (1.0, 3.0), (-2.0, 1.0), (5.0, 0.2), (0.0, 1.0), (-0.3, 4.0)] {
            let exact = (rise as f32).atan2(run).to_degrees();
            assert!((angle_degrees(rise, run) - exact).abs() < 0.1, "{rise}/{run}: {} vs {exact}", angle_degrees(rise, run));
        }
        assert_eq!(angle_degrees(3.0, 0.0), 90.0);
    }

    #[test]
    fn shapes_are_traced_where_they_are_drawn() {
        let (pts, closed) = outline(DrawingKind::Disk, &[(100.0, 100.0), (150.0, 100.0)]).unwrap();
        assert!(closed && pts.len() == ROUND_STEPS);
        assert!(pts.iter().all(|p| ((p.0 - 100.0).hypot(p.1 - 100.0) - 50.0).abs() < 0.05), "every point 50px out, after 48 turns too");
        let (pts, _) = outline(DrawingKind::Ellipse, &[(0.0, 0.0), (200.0, 100.0)]).unwrap();
        assert!((pts[0].0 - 200.0).abs() < 0.01 && (pts[0].1 - 50.0).abs() < 0.01, "{:?}", pts[0]);
        assert!((pts[12].0 - 100.0).abs() < 0.05 && (pts[12].1 - 100.0).abs() < 0.05, "a quarter round: {:?}", pts[12]);
        let (pts, _) = outline(DrawingKind::RotRect, &[(0.0, 0.0), (100.0, 0.0), (50.0, 30.0)]).unwrap();
        assert_eq!(pts[2], (100.0, 30.0));
        let (pts, closed) = outline(DrawingKind::Arc, &[(0.0, 0.0), (100.0, 0.0), (50.0, 40.0)]).unwrap();
        assert!(!closed && (pts[16].0 - 50.0).abs() < 0.01 && (pts[16].1 - 40.0).abs() < 0.01, "through its third point: {:?}", pts[16]);
        assert!(inside_convex(&[(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)], (5.0, 5.0)));
        assert!(!inside_convex(&[(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)], (15.0, 5.0)));
    }

    #[test]
    fn kinds_and_significant_digits() {
        for k in DrawingKind::ALL {
            assert_eq!(DrawingKind::parse(k.as_str()), Some(k));
            assert!(k.arity() >= 1);
        }
        assert_eq!(significant(77_123.4), "77123");
        assert_eq!(significant(12.345), "12.35");
        assert_eq!(significant(0.000012345), "0.0000123");
        assert_eq!(significant(-0.5), "-0.500");
    }

    #[test]
    fn styles_read_from_strings() {
        let margin = DrawingStyle::from_pairs([("sizeBy", "margin"), ("margin", "200"), ("leverage", "5")]);
        assert_eq!(position_coins(&margin, 100.0, 90.0), position_coins(&margin, 100.0, 50.0), "the stop moves what it risks, not its size");
        assert_eq!(position_coins(&margin, 100.0, 90.0), 10.0);
        assert_eq!(position_coins(&DrawingStyle::from_pairs([("riskUnit", "cash"), ("risk", "20")]), 100.0, 90.0), 2.0, "its risk over its stop");
        let s = DrawingStyle::from_pairs([("color", "#ff0000"), ("width", "3"), ("dash", "dotted"), ("extendRight", "1"), ("levels", "0,1|0.5,0,#00ff00,dashed|bad"), ("riskUnit", "cash"), ("nope", "x")]);
        assert_eq!(s.color, Some(Color::hex(0xff0000)));
        assert_eq!((s.width, s.dash, s.extend_right, s.risk_cash), (Some(3.0), Dash::Dotted, Some(true), true));
        let levels = s.levels.unwrap();
        assert_eq!(levels.len(), 2);
        assert_eq!(levels[1], Level { value: 0.5, on: false, color: Some(Color::hex(0x00ff00)), dash: Dash::Dashed });
        assert_eq!(trim_level(0.618), "0.618");
        assert_eq!(trim_level(1.0), "1");
    }
}
