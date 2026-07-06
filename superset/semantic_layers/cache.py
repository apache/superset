# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""
Containment-aware cache for semantic view queries.

A broader cached result can satisfy a narrower new query: when the new query's
filters and limit are strictly more restrictive than a cached entry's, the cached
DataFrame is post-filtered and re-limited rather than re-executing the underlying
query.

See ``docs/`` and the plan file for the design rationale; the rules summary:

* Same metrics and dimensions (shape).
* Each cached filter must be implied by a new-query filter on the same column.
* New filters on columns with no cached constraint are applied post-fetch as
  "leftovers" — provided the column is in the projection.
* Cached ``limit`` must be at least the new ``limit``; if a cached ``limit`` is
  present, the orderings must match (otherwise the cached "top N" is not the
  true top of the new query).
* ``ADHOC`` and ``HAVING`` filters require exact-set equality.
* ``offset != 0`` and mismatching ``group_limit`` skip the cache.
"""

from __future__ import annotations

import logging
import math
import re
import time as _time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from enum import Enum
from typing import Any, Callable, Iterable

import pandas as pd
import pyarrow as pa
from flask import current_app
from flask_caching import Cache
from superset_core.semantic_layers.types import (
    AdhocExpression,
    AggregationType,
    Dimension,
    Filter,
    Metric,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)

from superset.extensions import cache_manager
from superset.utils import json
from superset.utils.hashing import hash_from_str
from superset.utils.pandas_postprocessing.aggregate import aggregate

logger = logging.getLogger(__name__)

INDEX_KEY_PREFIX = "sv:idx:"
VALUE_KEY_PREFIX = "sv:val:"
MAX_ENTRIES_PER_VIEW = 128

_AGGREGATION_TO_PANDAS: dict[AggregationType, str] = {
    AggregationType.SUM: "sum",
    AggregationType.COUNT: "sum",
    AggregationType.MIN: "min",
    AggregationType.MAX: "max",
}
ADDITIVE_AGGREGATIONS = frozenset(_AGGREGATION_TO_PANDAS)


@dataclass(frozen=True)
class ViewMeta:
    """Identity/freshness/TTL info pulled from the SemanticView ORM row."""

    uuid: str
    changed_on_iso: str
    cache_timeout: int | None


class ReuseMode(Enum):
    """How a cached entry maps onto the new query."""

    EXACT = "exact"  # same dims and metrics; only leftovers/limit/order to apply
    PROJECT = "project"  # same dims, cached metrics ⊃ new metrics; drop columns
    ROLLUP = "rollup"  # cached dims ⊃ new dims; re-aggregate


# Preference order when multiple cached entries satisfy a query: pick the one
# requiring the least post-processing.
_MODE_RANK: dict[ReuseMode, int] = {
    ReuseMode.EXACT: 0,
    ReuseMode.PROJECT: 1,
    ReuseMode.ROLLUP: 2,
}


@dataclass(frozen=True)
class CachedEntry:
    filters: frozenset[Filter]
    dimension_keys: frozenset[str]
    metric_ids: frozenset[str]
    limit: int | None
    offset: int
    order_key: str
    group_limit_key: str
    value_key: str
    timestamp: float = field(default_factory=_time.time)


# ---------------------------------------------------------------------------
# Public surface
# ---------------------------------------------------------------------------


_INDEX_LOCK_TIMEOUT = 2  # seconds; bounds a live holder's exclusion window
_INDEX_LOCK_ATTEMPTS = 50
# Sleep between acquisition attempts. The worst-case wait is the sleeps plus
# up to ``_INDEX_LOCK_ATTEMPTS`` ``add``/``get`` round-trips to the backend.
_INDEX_LOCK_WAIT = 0.01
# A lock whose embedded timestamp is older than this multiple of the TTL is
# considered abandoned and broken. Covers backends where ``add`` is
# SETNX-then-EXPIRE (cachelib RedisCache): a holder killed between the two
# calls leaves a lock with no TTL, which would otherwise freeze the bucket's
# index updates until the view's ``changed_on`` rotates the key.
# The threshold doubles as the tolerated wall-clock skew BETWEEN WORKERS
# (the timestamp is written with the holder's clock and aged with the
# waiter's): a waiter whose clock runs ahead by more than TTL x FACTOR
# would break live locks. 30 s tolerates realistic NTP drift while only
# modestly delaying recovery of a genuinely orphaned lock — the rarer event.
_INDEX_LOCK_STALE_FACTOR = 15


def _lock_is_stale(raw: Any) -> bool:
    """True when a lock value's embedded timestamp is past breakable age.

    Unparseable values (including non-strings) are treated as stale: lock
    values are always written by ``_acquire_index_lock`` in
    ``"<token>:<epoch>"`` form, so anything else is a leftover from a
    different format and should not wedge the bucket forever.
    """
    if not isinstance(raw, str):
        return True
    _, _, timestamp = raw.rpartition(":")
    try:
        parsed = float(timestamp)
    except ValueError:
        return True
    if not math.isfinite(parsed):
        # float() accepts "nan"/"inf"; nan compares False against any
        # threshold, which would make the lock fresh forever — an
        # unbreakable wedge, the exact outcome this rule exists to prevent.
        return True
    return _time.time() - parsed > _INDEX_LOCK_TIMEOUT * _INDEX_LOCK_STALE_FACTOR


def _mint_token() -> str:
    """A fresh lock value: random owner component plus the current time."""
    return f"{uuid.uuid4().hex}:{_time.time()}"


def _acquire_index_lock(cache: Cache, lock_key: str, attempts: int) -> str | None:
    """Try to acquire the per-bucket index lock; return the owner token.

    The token embeds a random component (fencing the release: only the owner
    deletes) and a timestamp (letting waiters break a lock abandoned by a
    holder that died before its TTL was applied). The token is minted fresh
    on every attempt so the timestamp reflects acquisition time — a token
    minted once before a slow retry loop could be stale at birth, making the
    just-acquired lock immediately breakable.

    The break path is best-effort fenced: the lock value is re-read and
    compared immediately before the delete, so a waiter that lost the break
    race does not delete the winner's fresh lock. Like the release fence,
    get-compare-delete is not atomic through the cache abstraction, so a
    narrow double-acquire window remains when several waiters break one
    abandoned lock together; the consequence degrades to the benign
    lost-index-entry, never wrong data.
    """
    for attempt in range(attempts):
        token = _mint_token()
        if cache.add(lock_key, token, timeout=_INDEX_LOCK_TIMEOUT):
            return token
        current = cache.get(lock_key)
        if current is not None and _lock_is_stale(current):
            logger.info(
                "Semantic view cache index lock %s appears abandoned; breaking it",
                lock_key,
            )
            if cache.get(lock_key) == current:
                cache.delete(lock_key)
            # Retry immediately (also on the final/only attempt, so a
            # single-attempt caller that breaks an orphan still gets its
            # own acquisition rather than donating the break).
            token = _mint_token()
            if cache.add(lock_key, token, timeout=_INDEX_LOCK_TIMEOUT):
                return token
        if attempt + 1 < attempts:
            _time.sleep(_INDEX_LOCK_WAIT)
    return None


def _release_index_lock(cache: Cache, lock_key: str, token: str) -> None:
    """Best-effort fenced release: delete the lock only if we still own it.

    If the critical section outlived the lock TTL, a successor may hold the
    lock; an unconditional delete would release the successor's lock and
    cascade the race. ``get``-compare-``delete`` is not atomic, so a narrow
    window remains, but the critical section is a constant get + filter +
    set (no per-entry backend calls), keeping it far under the TTL — and the
    consequence degrades to the pre-fix benign lost-entry, never wrong data.
    """
    try:
        if cache.get(lock_key) == token:
            cache.delete(lock_key)
    except Exception:  # pragma: no cover - defensive
        logger.debug("Semantic view cache lock release failed", exc_info=True)


def _update_index(
    cache: Cache,
    idx_key: str,
    timeout: int | None,
    mutate: Callable[[list[CachedEntry]], list[CachedEntry] | None],
    attempts: int | None = None,
) -> bool:
    """Read-modify-write the index bucket under a short cache-level lock.

    A bare ``get``/``set`` on the index is not atomic: two concurrent writers
    for one view can clobber each other's entries, and the eviction prune can
    drop an entry added between its read and write. The losses are benign by
    design (a dropped index entry is a future cache miss, never wrong data),
    but under concurrent dashboard load they silently discard cache benefit.

    A Redis ``WATCH``/Lua transaction can't be used here: the index value is
    a pickled Python list managed through the Flask-Caching abstraction, and
    the data cache is not guaranteed to be Redis-backed. ``cache.add`` is the
    portable set-if-absent primitive, so a short-lived lock key serialises
    index writers per bucket.

    Invariant, honestly scoped: on backends where ``add`` is atomic (Redis,
    memcached, the metastore cache's unique-key insert), the index is only
    written while holding the lock; on acquisition failure the update is
    SKIPPED (losing at most this write's cache benefit) rather than performed
    unlocked, which could clobber a concurrent writer. The release is fenced
    by an owner token, and locks abandoned without a TTL are broken after
    ``_INDEX_LOCK_STALE_FACTOR`` x the TTL. Three best-effort windows
    remain, all bounded to the benign lost-entry: the non-atomic
    get-compare-delete in the release and break fences; cross-worker clock
    skew beyond the stale threshold; and plain TTL expiry if the locked
    get + set itself stalls past the TTL (the critical section makes no
    per-entry backend calls, so its normal duration is milliseconds
    against a 2 s budget). Backends whose ``add`` is not
    atomic (``SimpleCache``'s check-then-act, ``NullCache``'s always-True
    no-op) degrade to best-effort locking — at worst the pre-fix benign
    clobber. Duck-typed caches without ``add`` at all (test doubles; every
    Flask-Caching backend has it) use the unlocked read-modify-write.

    ``mutate`` receives the freshly read entry list and returns the new list,
    or ``None`` to skip the write. Returns True when the update ran (locked
    or degraded), False when it was skipped because the lock stayed busy.
    """
    if attempts is None:
        attempts = _INDEX_LOCK_ATTEMPTS
    lock_key = f"{idx_key}:lock"
    if getattr(cache, "add", None) is None:
        entries: list[CachedEntry] = list(cache.get(idx_key) or [])
        new_entries = mutate(entries)
        if new_entries is not None:
            cache.set(idx_key, new_entries, timeout=timeout)
        return True
    token = _acquire_index_lock(cache, lock_key, attempts)
    if token is None:
        return False
    try:
        locked_entries: list[CachedEntry] = list(cache.get(idx_key) or [])
        new_locked = mutate(locked_entries)
        if new_locked is not None:
            cache.set(idx_key, new_locked, timeout=timeout)
        return True
    finally:
        _release_index_lock(cache, lock_key, token)


def try_serve_from_cache(
    view_meta: ViewMeta,
    query: SemanticQuery,
) -> SemanticResult | None:
    """Return a cached ``SemanticResult`` that satisfies ``query`` if any."""
    try:
        cache = cache_manager.data_cache
        idx_key = shape_key(view_meta, query)
        entries: list[CachedEntry] | None = cache.get(idx_key)
        if not entries:
            return None

        # Rank candidates so EXACT is preferred over PROJECT over ROLLUP. With
        # one bucket per view, multiple entries may satisfy a query; pick the
        # one needing the least post-processing.
        candidates: list[tuple[int, CachedEntry, set[Filter], ReuseMode]] = []
        for entry in entries:
            ok, leftovers, mode = can_satisfy(entry, query)
            if ok:
                candidates.append((_MODE_RANK[mode], entry, leftovers, mode))
        candidates.sort(key=lambda c: c[0])

        served: SemanticResult | None = None
        dead_entries: set[CachedEntry] = set()
        for _, entry, leftovers, mode in candidates:
            payload = cache.get(entry.value_key)
            if payload is None:
                dead_entries.add(entry)
                continue
            if mode == ReuseMode.ROLLUP and not _projection_input_complete(
                entry, payload
            ):
                continue
            served = _apply_post_processing(payload, query, leftovers, mode)
            break

        # Gated on having actually observed an evicted value above, so the
        # common clean-hit read stays lock-free.
        if dead_entries:
            _prune_evicted(cache, view_meta, idx_key, dead_entries)
        return served
    except Exception:  # pragma: no cover - defensive
        logger.warning("Semantic view cache lookup failed", exc_info=True)
        return None


def _prune_evicted(
    cache: Cache,
    view_meta: ViewMeta,
    idx_key: str,
    dead_entries: set[CachedEntry],
) -> None:
    """Drop the exact index entries whose values the caller observed evicted.

    Pruning is by ENTRY IDENTITY (the frozen dataclass, timestamp included),
    not by value key: a concurrent ``store_result`` re-executing the same
    query re-registers the SAME canonical value key with a fresh timestamp —
    a key-based prune would drop that fresh registration even though its
    value now exists. The evidence was gathered OUTSIDE the lock, so the
    critical section is a constant get + membership filter + set with zero
    per-entry backend calls, keeping it far under the lock TTL regardless
    of bucket size. Dead entries that never matched a query linger until
    the bucket's TTL or the MAX_ENTRIES trim — an accepted trade for
    lock-free clean hits.

    A single non-blocking lock attempt: the prune is purely opportunistic
    (a missed prune is retried by a future read that observes the same
    eviction). The entry list is re-read under the index lock so the prune
    cannot clobber an entry added by a concurrent ``store_result`` between
    the caller's read and this write. Isolated in its own try/except so
    housekeeping can never turn an already-computed cache hit into a miss.
    """
    try:

        def prune(current: list[CachedEntry]) -> list[CachedEntry] | None:
            pruned = [e for e in current if e not in dead_entries]
            return pruned if len(pruned) != len(current) else None

        _update_index(cache, idx_key, _timeout(view_meta), prune, attempts=1)
    except Exception:  # pragma: no cover - defensive
        logger.debug(
            "Semantic view cache prune failed; serving result anyway",
            exc_info=True,
        )


def store_result(
    view_meta: ViewMeta,
    query: SemanticQuery,
    result: SemanticResult,
) -> None:
    """Persist ``result`` under a fresh value key and register a descriptor."""
    try:
        cache = cache_manager.data_cache
        timeout = _timeout(view_meta)
        vkey = value_key(view_meta, query)
        cache.set(vkey, result, timeout=timeout)

        idx_key = shape_key(view_meta, query)
        entry = CachedEntry(
            filters=frozenset(query.filters or set()),
            dimension_keys=frozenset(_dimension_key(d) for d in query.dimensions),
            metric_ids=frozenset(m.id for m in query.metrics),
            limit=query.limit,
            offset=query.offset or 0,
            order_key=_order_key(query.order),
            group_limit_key=_group_limit_key(query.group_limit),
            value_key=vkey,
        )

        def register(entries: list[CachedEntry]) -> list[CachedEntry]:
            entries = [e for e in entries if e.value_key != vkey]
            entries.append(entry)
            if len(entries) > MAX_ENTRIES_PER_VIEW:
                entries = sorted(entries, key=lambda e: e.timestamp)[
                    -MAX_ENTRIES_PER_VIEW:
                ]
            return entries

        if not _update_index(cache, idx_key, timeout, register):
            # The value blob at ``vkey`` stays unindexed until its TTL
            # expires — deliberately NOT deleted here: an earlier index
            # entry may reference the same canonical value key, and the
            # documented trade-off is losing cache benefit, never data.
            logger.warning(
                "Semantic view cache index lock busy; skipping registration "
                "of %s (result cached; may be unreachable until re-stored)",
                idx_key,
            )
    except Exception:  # pragma: no cover - defensive
        logger.warning("Semantic view cache store failed", exc_info=True)


# ---------------------------------------------------------------------------
# Keys
# ---------------------------------------------------------------------------


def shape_key(view_meta: ViewMeta, query: SemanticQuery) -> str:
    # All entries for a view+changed_on share one bucket; dimension and metric
    # sets live on each ``CachedEntry`` so we can find broader (dim- or metric-
    # superset) entries via the projection/rollup paths.
    del query  # unused; kept for call-site symmetry with value_key
    return f"{INDEX_KEY_PREFIX}{view_meta.uuid}:{view_meta.changed_on_iso}"


def value_key(view_meta: ViewMeta, query: SemanticQuery) -> str:
    digest = hash_from_str(json.dumps(_canonicalize(query), sort_keys=True))[:32]
    return f"{VALUE_KEY_PREFIX}{view_meta.uuid}:{view_meta.changed_on_iso}:{digest}"


def _dimension_key(dim: Dimension) -> str:
    grain = dim.grain.representation if dim.grain else "_"
    return f"{dim.id}@{grain}"


def _canonicalize(query: SemanticQuery) -> dict[str, Any]:
    return {
        "m": sorted(m.id for m in query.metrics),
        "d": sorted(_dimension_key(d) for d in query.dimensions),
        "f": sorted(_filter_to_jsonable(f) for f in (query.filters or [])),
        "o": _order_key(query.order),
        "l": query.limit,
        "off": query.offset or 0,
        "gl": _group_limit_key(query.group_limit),
    }


def _filter_to_jsonable(f: Filter) -> str:
    return json.dumps(
        {
            "t": f.type.value,
            "c": f.column.id if f.column is not None else None,
            "o": f.operator.value,
            "v": _value_to_jsonable(f.value),
        },
        sort_keys=True,
    )


def _value_to_jsonable(value: Any) -> Any:
    if isinstance(value, frozenset):
        return sorted(_value_to_jsonable(v) for v in value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, timedelta):
        return value.total_seconds()
    return value


def _order_key(order: list[OrderTuple] | None) -> str:
    if not order:
        return ""
    return json.dumps(
        [(_orderable_id(element), direction.value) for element, direction in order]
    )


def _orderable_id(element: Metric | Dimension | AdhocExpression) -> str:
    return element.id


def _group_limit_key(group_limit: Any) -> str:
    if group_limit is None:
        return ""
    return json.dumps(
        {
            "dims": sorted(d.id for d in group_limit.dimensions),
            "top": group_limit.top,
            "metric": group_limit.metric.id if group_limit.metric else None,
            "direction": group_limit.direction.value,
            "group_others": group_limit.group_others,
            "filters": sorted(
                _filter_to_jsonable(f) for f in (group_limit.filters or [])
            ),
        },
        sort_keys=True,
    )


def _timeout(view_meta: ViewMeta) -> int | None:
    if view_meta.cache_timeout is not None:
        return view_meta.cache_timeout
    config = current_app.config.get("DATA_CACHE_CONFIG") or {}
    return config.get("CACHE_DEFAULT_TIMEOUT")


# ---------------------------------------------------------------------------
# Containment
# ---------------------------------------------------------------------------


def can_satisfy(  # noqa: C901
    entry: CachedEntry,
    query: SemanticQuery,
) -> tuple[bool, set[Filter], ReuseMode]:
    """
    Return ``(reusable, leftover_filters, mode)`` for ``entry`` vs ``query``.

    ``mode`` distinguishes exact reuse from two transformation paths:

    * ``PROJECT``: same dimensions, cached metrics ⊃ new metrics. Cached rows
      already match the new shape — we just drop the extra metric columns.
    * ``ROLLUP``: cached dimensions ⊃ new dimensions. The cached DataFrame must
      be re-aggregated; new metrics must use additive aggregations.

    In both transformation modes, cached metrics must be a (non-strict) superset
    of new metrics.
    """
    new_metric_ids = frozenset(m.id for m in query.metrics)
    if not entry.metric_ids >= new_metric_ids:
        return False, set(), ReuseMode.EXACT
    metrics_equal = entry.metric_ids == new_metric_ids

    new_dim_keys = frozenset(_dimension_key(d) for d in query.dimensions)
    cached_dim_keys = entry.dimension_keys

    if cached_dim_keys == new_dim_keys:
        mode = ReuseMode.EXACT if metrics_equal else ReuseMode.PROJECT
    elif cached_dim_keys > new_dim_keys:
        mode = ReuseMode.ROLLUP
        if not _projection_allowed(entry, query):
            return False, set(), ReuseMode.EXACT
    else:
        return False, set(), ReuseMode.EXACT

    new_filters = frozenset(query.filters or set())

    c_adhoc, c_having, c_where = _split(entry.filters)
    n_adhoc, n_having, n_where = _split(new_filters)

    if c_adhoc != n_adhoc:
        return False, set(), ReuseMode.EXACT
    if c_having != n_having:
        return False, set(), ReuseMode.EXACT

    c_by_col = _group_by_column(c_where)
    n_by_col = _group_by_column(n_where)

    for c_list in c_by_col.values():
        for c in c_list:
            n_list = n_by_col.get(_filter_col_id(c), [])
            if not any(_implies(n, c) for n in n_list):
                return False, set(), ReuseMode.EXACT

    leftovers: set[Filter] = set()
    for col_id, n_list in n_by_col.items():
        c_list = c_by_col.get(col_id, [])
        for n in n_list:
            if not any(_implies(c, n) for c in c_list):
                if n.column is None or n.operator == Operator.ADHOC:
                    return False, set(), ReuseMode.EXACT
                leftovers.add(n)

    # Leftover filters are applied to the cached DataFrame before the optional
    # rollup/projection, so their columns must be present in the cached projection.
    allowed_ids = _cached_column_ids(entry, query)
    for leftover in leftovers:
        if leftover.column is None or leftover.column.id not in allowed_ids:
            return False, set(), ReuseMode.EXACT

    if entry.offset != 0 or (query.offset or 0) != 0:
        return False, set(), ReuseMode.EXACT

    if mode == ReuseMode.ROLLUP:
        # Re-aggregation will re-order by ``query.order`` after rollup, so the
        # cached order is irrelevant. We do require the new order (if any) to
        # reference only surviving columns; otherwise sort would fail post-rollup.
        if not _order_uses_only(query.order, _projection_ids(query)):
            return False, set(), ReuseMode.EXACT
    else:
        # EXACT and PROJECT keep row granularity, so the cached top-N is valid
        # only when the new query asks for the same order and a tighter limit.
        if entry.limit is not None:
            if query.limit is None or query.limit > entry.limit:
                return False, set(), ReuseMode.EXACT
            if entry.order_key != _order_key(query.order):
                return False, set(), ReuseMode.EXACT

        if entry.group_limit_key != _group_limit_key(query.group_limit):
            return False, set(), ReuseMode.EXACT

    return True, leftovers, mode


def _projection_allowed(
    entry: CachedEntry,
    query: SemanticQuery,
) -> bool:
    """
    Gates for the projection path (above and beyond filter containment).
    """
    if any(m.aggregation not in ADDITIVE_AGGREGATIONS for m in query.metrics):
        return False
    if entry.group_limit_key:
        return False
    if query.group_limit is not None:
        return False
    # Cached HAVING dropped sub-aggregate rows; the rolled-up totals would be
    # off. Conservative: skip the projection path when cached has any HAVING.
    if any(f.type == PredicateType.HAVING for f in entry.filters):
        return False
    return True


def _projection_input_complete(entry: CachedEntry, payload: SemanticResult) -> bool:
    """
    True when a projection source is guaranteed not to be limit-truncated.

    If a cached query had ``limit=N`` and returned exactly ``N`` rows, there might
    be additional source rows that were cut off. We only reuse it for projection
    when the payload row count is strictly less than ``N``.
    """
    if entry.limit is None:
        return True
    return payload.results.num_rows < entry.limit


def _filter_col_id(f: Filter) -> str | None:
    return f.column.id if f.column is not None else None


def _order_uses_only(
    order: list[OrderTuple] | None,
    allowed_ids: set[str],
) -> bool:
    if not order:
        return True
    return all(_orderable_id(element) in allowed_ids for element, _ in order)


def _split(
    filters: Iterable[Filter],
) -> tuple[frozenset[Filter], frozenset[Filter], frozenset[Filter]]:
    adhoc: set[Filter] = set()
    having: set[Filter] = set()
    where: set[Filter] = set()
    for f in filters:
        if f.operator == Operator.ADHOC:
            adhoc.add(f)
        elif f.type == PredicateType.HAVING:
            having.add(f)
        else:
            where.add(f)
    return frozenset(adhoc), frozenset(having), frozenset(where)


def _group_by_column(filters: Iterable[Filter]) -> dict[str | None, list[Filter]]:
    out: dict[str | None, list[Filter]] = {}
    for f in filters:
        col_id = f.column.id if f.column is not None else None
        out.setdefault(col_id, []).append(f)
    return out


def _projection_ids(query: SemanticQuery) -> set[str]:
    return {d.id for d in query.dimensions} | {m.id for m in query.metrics}


def _cached_column_ids(entry: CachedEntry, query: SemanticQuery) -> set[str]:
    """Column ids available in the cached DataFrame (cached dims + shared metrics)."""
    cached_dim_ids = {key.rsplit("@", 1)[0] for key in entry.dimension_keys}
    return cached_dim_ids | {m.id for m in query.metrics}


# ---------------------------------------------------------------------------
# Pairwise implication
# ---------------------------------------------------------------------------


# pylint: disable=too-many-return-statements,too-many-branches
def _implies(new: Filter, cached: Filter) -> bool:  # noqa: C901
    """True iff every row matching ``new`` also matches ``cached``.

    Both filters are assumed to be on the same column (caller groups by column).
    """
    if new == cached:
        return True

    nop, nval = new.operator, new.value
    cop, cval = cached.operator, cached.value

    if cop == Operator.IS_NULL:
        if nop == Operator.IS_NULL:
            return True
        if nop == Operator.EQUALS and nval is None:
            return True
        return False

    if cop == Operator.IS_NOT_NULL:
        if nop == Operator.IS_NOT_NULL:
            return True
        if nop == Operator.EQUALS:
            return nval is not None
        if nop in _RANGE_OPS:
            return True
        if nop == Operator.IN:
            return isinstance(nval, frozenset) and all(v is not None for v in nval)
        return False

    if cop == Operator.EQUALS:
        if nop == Operator.EQUALS:
            return nval == cval
        if nop == Operator.IN and isinstance(nval, frozenset):
            return nval == frozenset({cval})
        return False

    if cop == Operator.NOT_EQUALS:
        if nop == Operator.NOT_EQUALS:
            return nval == cval
        if nop == Operator.EQUALS:
            return nval != cval
        if nop == Operator.IN and isinstance(nval, frozenset):
            return cval not in nval
        return False

    if cop == Operator.IN and isinstance(cval, frozenset):
        if nop == Operator.IN and isinstance(nval, frozenset):
            return nval.issubset(cval)
        if nop == Operator.EQUALS:
            return nval in cval
        return False

    if cop == Operator.NOT_IN and isinstance(cval, frozenset):
        if nop == Operator.NOT_IN and isinstance(nval, frozenset):
            return cval.issubset(nval)
        if nop == Operator.NOT_EQUALS:
            return cval.issubset({nval})
        if nop == Operator.EQUALS:
            return nval not in cval
        if nop == Operator.IN and isinstance(nval, frozenset):
            return cval.isdisjoint(nval)
        return False

    if cop in _RANGE_OPS:
        return _implies_range(nop, nval, cop, cval)

    # LIKE / NOT_LIKE / ADHOC: only the exact-match path at the top.
    return False


_RANGE_OPS = frozenset(
    {
        Operator.GREATER_THAN,
        Operator.GREATER_THAN_OR_EQUAL,
        Operator.LESS_THAN,
        Operator.LESS_THAN_OR_EQUAL,
    }
)


def _implies_range(  # noqa: C901
    nop: Operator,
    nval: Any,
    cop: Operator,
    cval: Any,
) -> bool:
    if isinstance(nval, frozenset):
        return nop == Operator.IN and all(_scalar_in_range(v, cop, cval) for v in nval)
    if nop == Operator.EQUALS:
        return _scalar_in_range(nval, cop, cval)
    if nop not in _RANGE_OPS:
        return False
    if not _comparable(nval, cval):
        return False

    # Same direction (both upper or both lower bounds) required.
    cached_is_lower = cop in (Operator.GREATER_THAN, Operator.GREATER_THAN_OR_EQUAL)
    new_is_lower = nop in (Operator.GREATER_THAN, Operator.GREATER_THAN_OR_EQUAL)
    if cached_is_lower != new_is_lower:
        return False

    if cached_is_lower:
        # cached: a > cval  or a >= cval
        # new:    a > nval  or a >= nval
        # need rows(new) ⊆ rows(cached)
        if cop == Operator.GREATER_THAN and nop == Operator.GREATER_THAN:
            return nval >= cval
        if cop == Operator.GREATER_THAN and nop == Operator.GREATER_THAN_OR_EQUAL:
            return nval > cval
        if cop == Operator.GREATER_THAN_OR_EQUAL and nop == Operator.GREATER_THAN:
            return nval >= cval
        if (
            cop == Operator.GREATER_THAN_OR_EQUAL
            and nop == Operator.GREATER_THAN_OR_EQUAL
        ):
            return nval >= cval
        return False
    else:
        if cop == Operator.LESS_THAN and nop == Operator.LESS_THAN:
            return nval <= cval
        if cop == Operator.LESS_THAN and nop == Operator.LESS_THAN_OR_EQUAL:
            return nval < cval
        if cop == Operator.LESS_THAN_OR_EQUAL and nop == Operator.LESS_THAN:
            return nval <= cval
        if cop == Operator.LESS_THAN_OR_EQUAL and nop == Operator.LESS_THAN_OR_EQUAL:
            return nval <= cval
        return False


def _scalar_in_range(value: Any, cop: Operator, cval: Any) -> bool:
    if not _comparable(value, cval):
        return False
    if cop == Operator.GREATER_THAN:
        return value > cval
    if cop == Operator.GREATER_THAN_OR_EQUAL:
        return value >= cval
    if cop == Operator.LESS_THAN:
        return value < cval
    if cop == Operator.LESS_THAN_OR_EQUAL:
        return value <= cval
    return False


def _comparable(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return True
    if isinstance(a, str) and isinstance(b, str):
        return True
    if isinstance(a, (datetime, date, time)) and isinstance(b, type(a)):
        return True
    if isinstance(a, type(b)) and isinstance(a, (datetime, date, time, timedelta)):
        return True
    return type(a) == type(b)  # noqa: E721


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def _apply_post_processing(
    cached: SemanticResult,
    query: SemanticQuery,
    leftovers: set[Filter],
    mode: ReuseMode,
) -> SemanticResult:
    """Apply leftover filters, projection/rollup, order, and limit."""
    if mode == ReuseMode.EXACT and not leftovers and query.limit is None:
        return cached

    df = cached.results.to_pandas()
    if leftovers:
        mask = pd.Series(True, index=df.index)
        for f in leftovers:
            mask &= _mask_for(df, f)
        df = df[mask]

    note_def = "Served from semantic view smart cache (post-processed locally)"
    if mode == ReuseMode.ROLLUP:
        groupby = [d.name for d in query.dimensions]
        aggregates: dict[str, dict[str, str]] = {}
        for m in query.metrics:
            if m.aggregation is None:
                continue
            aggregates[m.name] = {
                "column": m.name,
                "operator": _AGGREGATION_TO_PANDAS[m.aggregation],
            }
        df = aggregate(df, groupby=groupby, aggregates=aggregates)
        note_def = "Served from semantic view smart cache (re-aggregated locally)"
    elif mode == ReuseMode.PROJECT:
        keep = [d.name for d in query.dimensions] + [m.name for m in query.metrics]
        df = df[keep]
        note_def = "Served from semantic view smart cache (projected locally)"

    df = _apply_order(df, query.order)

    if query.limit is not None:
        df = df.head(query.limit)

    table = pa.Table.from_pandas(df, preserve_index=False)
    note = SemanticRequest(type="cache", definition=note_def)
    return SemanticResult(requests=list(cached.requests) + [note], results=table)


def _apply_order(
    df: pd.DataFrame,
    order: list[OrderTuple] | None,
) -> pd.DataFrame:
    if not order:
        return df
    available: list[tuple[str, bool]] = []
    for element, direction in order:
        col = _orderable_id_name(element)
        if col in df.columns:
            available.append((col, direction == OrderDirection.ASC))
    if not available:
        return df
    cols = [col for col, _ in available]
    asc = [a for _, a in available]
    return df.sort_values(by=cols, ascending=asc).reset_index(drop=True)


def _orderable_id_name(element: Metric | Dimension | AdhocExpression) -> str:
    return getattr(element, "name", element.id)


def _mask_for(df: pd.DataFrame, f: Filter) -> pd.Series:  # noqa: C901
    if f.column is None:
        return pd.Series(True, index=df.index)
    series = df[f.column.name]
    op = f.operator
    val = f.value
    if op == Operator.EQUALS:
        return series == val if val is not None else series.isna()
    if op == Operator.NOT_EQUALS:
        return series != val if val is not None else series.notna()
    if op == Operator.GREATER_THAN:
        return series > val
    if op == Operator.GREATER_THAN_OR_EQUAL:
        return series >= val
    if op == Operator.LESS_THAN:
        return series < val
    if op == Operator.LESS_THAN_OR_EQUAL:
        return series <= val
    if op == Operator.IN:
        return series.isin(list(val) if isinstance(val, frozenset) else [val])
    if op == Operator.NOT_IN:
        return ~series.isin(list(val) if isinstance(val, frozenset) else [val])
    if op == Operator.IS_NULL:
        return series.isna()
    if op == Operator.IS_NOT_NULL:
        return series.notna()
    if op == Operator.LIKE:
        return series.astype(str).str.match(_sql_like_to_regex(str(val)))
    if op == Operator.NOT_LIKE:
        return ~series.astype(str).str.match(_sql_like_to_regex(str(val)))
    return pd.Series(True, index=df.index)


def _sql_like_to_regex(pattern: str) -> str:
    out = []
    for ch in pattern:
        if ch == "%":
            out.append(".*")
        elif ch == "_":
            out.append(".")
        else:
            out.append(re.escape(ch))
    return f"^{''.join(out)}$"
