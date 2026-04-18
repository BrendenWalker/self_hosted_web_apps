"""
Estimate biological potty hold time from event logs.

Frequent daytime trips produce short inter-event gaps even when the puppy was
not near capacity. Intervals that cross local sleep / calendar days better
reflect how long the animal can wait. Very long gaps usually mean a missed log.

Uses local timezone (SUMMARY_TZ) to classify rest-span vs daytime.
"""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import median
from typing import List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

try:
    ZoneInfo("America/Los_Angeles")
except Exception:  # pragma: no cover
    pass


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _local(dt: datetime, tz: ZoneInfo) -> datetime:
    return _utc(dt).astimezone(tz)


def is_rest_span_interval(
    t0: datetime,
    t1: datetime,
    tz_name: str,
    *,
    min_hours: float = 5.0,
) -> bool:
    """
    True when the gap plausibly includes a sleep / long unattended period.

    Heuristic: at least ~5h and either crosses a calendar day in local time,
    is very long, or touches typical quiet hours.
    """
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    dh = (t1 - t0).total_seconds() / 3600.0
    if dh < min_hours:
        return False

    s0 = _local(t0, tz)
    s1 = _local(t1, tz)

    def in_quiet(d: datetime) -> bool:
        return d.hour >= 22 or d.hour < 7

    return (
        s0.date() != s1.date()
        or dh > 8.0
        or in_quiet(s0)
        or in_quiet(s1)
    )


def intervals_between_events(
    times_asc: Sequence[datetime],
) -> List[Tuple[float, datetime, datetime]]:
    """Consecutive gaps in hours with endpoints (UTC-aware)."""
    out: List[Tuple[float, datetime, datetime]] = []
    if len(times_asc) < 2:
        return out
    t_prev = _utc(times_asc[0])
    for i in range(1, len(times_asc)):
        t_curr = _utc(times_asc[i])
        dh = (t_curr - t_prev).total_seconds() / 3600.0
        out.append((dh, t_prev, t_curr))
        t_prev = t_curr
    return out


def estimate_hold_hours(
    times_asc: Sequence[datetime],
    tz_name: str,
    *,
    is_poop: bool,
) -> Optional[float]:
    """
    Robust typical hold (hours) from ordered same-stream toilet timestamps.

    Prefer median of rest-span intervals (capped to plausible sleep lengths).
    Falls back to median of moderate-length gaps when rest data are sparse.
    """
    hard_cap = 72.0 if is_poop else 40.0
    # Within a true rest span, a gap longer than this is usually a missed log.
    rest_plausible_max = 48.0 if is_poop else 24.0

    ivs = intervals_between_events(times_asc)
    cleaned: List[Tuple[float, datetime, datetime]] = []
    for h, t0, t1 in ivs:
        if h < 0.02:
            continue
        if h > hard_cap:
            continue
        cleaned.append((h, t0, t1))

    if not cleaned:
        return None

    rest_gaps: List[float] = []
    for h, t0, t1 in cleaned:
        if not is_rest_span_interval(t0, t1, tz_name):
            continue
        if h > rest_plausible_max:
            continue
        rest_gaps.append(h)

    if len(rest_gaps) >= 2:
        return float(median(rest_gaps))
    if len(rest_gaps) == 1 and len(cleaned) >= 10:
        return float((rest_gaps[0] + median([h for h, _, _ in cleaned])) / 2.0)
    if len(rest_gaps) == 1:
        return float(rest_gaps[0])

    # Few or no rest spans (young puppy, incomplete history): use "longer daytime"
    # gaps — ignore very short convenience trips (<1.5h pee / <3h poop).
    min_day = 3.0 if is_poop else 1.5
    moderate = [h for h, _, _ in cleaned if h >= min_day]
    if len(moderate) >= 3:
        return float(median(moderate))
    if cleaned:
        return float(median([h for h, _, _ in cleaned]))
    return None


def split_toilet_times_by_subtype(
    rows: Sequence[Tuple[datetime, Optional[str]]],
) -> Tuple[List[datetime], List[datetime]]:
    """From (created_at, sub_type) rows, ordered asc — separate pee and poop streams."""
    pee: List[datetime] = []
    poop: List[datetime] = []
    for ts, sub in rows:
        st = (sub or "").lower()
        if st == "pee":
            pee.append(ts)
        elif st == "poop":
            poop.append(ts)
    return pee, poop
