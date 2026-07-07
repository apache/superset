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
"""Top-level orchestrator + query-param parsing + observability.

This is the public entry point for the activity-view read path. One
function — :func:`get_activity` — dispatches on the path entity's
model class to assemble the cross-entity activity stream:

1. ``resolve_path_entity`` (queries.py) — resolve UUID → live entity.
2. ``resolve_scope`` (scope.py) — build the related-entity window list.
3. ``fetch_change_records`` (queries.py) — pull rows from
   ``version_changes`` joined with ``version_transaction`` and ``ab_user``.
4. ``filter_records_by_visibility`` (visibility.py) — silent
   drop of records the requester can't read.
5. ``apply_entity_name_denormalization`` (queries.py) — resolve entity names
   from the shadow row valid at each record's transaction_id.
6. ``apply_record_decoration`` (render.py) — synthesize the ActivityRecord
   DTO fields and strip internal-only columns.
7. Paginate in Python over the post-filter list.

Parameter parsing for the REST endpoints lives here too —
:func:`parse_activity_query_params` is called by the three
``/activity/`` endpoint handlers before they call ``get_activity``.
Same for the observability instrumentation: ``_phase_timer`` and
``_emit_request_shape_attributes`` emit the per-phase timing and
request-shape metrics, on the same prefix the cross-coupling test pins.
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from flask import Response
from flask_appbuilder import Model

from superset.utils import json
from superset.versioning.activity.kinds import EntityWindows
from superset.versioning.activity.queries import (
    apply_entity_name_denormalization,
    fetch_change_records,
    mark_first_tracked_saves,
    resolve_path_entity,
)
from superset.versioning.activity.render import apply_record_decoration
from superset.versioning.activity.scope import resolve_scope
from superset.versioning.activity.visibility import filter_records_by_visibility
from superset.versioning.api_helpers import (
    PathEntityResponseError,
    resolve_endpoint_path_entity,
)

_DEFAULT_PAGE_SIZE = 25
_MAX_PAGE_SIZE = 200
_VALID_INCLUDE_VALUES: frozenset[str] = frozenset({"self", "related", "all"})


# Upper bound on the ``q`` search string. The search is a substring scan over
# the (already-capped) materialized record set, so this is a cheap-DoS guard,
# not a correctness limit.
_MAX_Q_LENGTH = 1024


class ActivityParamsError(ValueError):
    """Raised by :func:`parse_activity_query_params` when a query param is
    malformed. The endpoint catches this and maps to ``response_400``;
    no other callers should depend on the exception type."""


def parse_activity_query_params(args: Any) -> dict[str, Any]:
    """Parse the ``since`` / ``until`` / ``include`` / ``page`` / ``page_size``
    query parameters into the kwargs ``get_activity`` accepts.

    Raises :class:`ActivityParamsError` (subclass of ``ValueError``) when
    a parameter is malformed. Shared across the three endpoint families
    (dashboards, charts, datasets) so the parsing and 400-messaging stay
    consistent.
    """
    params: dict[str, Any] = {
        "include": _parse_include(args.get("include", "all")),
        "page": _parse_page(args.get("page", "0")),
        "page_size": _parse_page_size(args.get("page_size")),
    }
    if (since := _parse_optional_iso(args.get("since"), name="since")) is not None:
        params["since"] = since
    if (until := _parse_optional_iso(args.get("until"), name="until")) is not None:
        params["until"] = until
    if q := (args.get("q") or "").strip():
        if len(q) > _MAX_Q_LENGTH:
            raise ActivityParamsError(f"'q' must be at most {_MAX_Q_LENGTH} characters")
        params["q"] = q
    return params


def _parse_optional_iso(raw: str | None, *, name: str) -> datetime | None:
    """Parse a missing-or-ISO-datetime field; ``None`` for missing,
    ``ActivityParamsError`` for malformed."""
    if not raw:
        return None
    parsed = _parse_iso_datetime(raw)
    if parsed is None:
        raise ActivityParamsError(f"Invalid {name!r} datetime: {raw!r}")
    return parsed


def _parse_include(value: str) -> str:
    if value not in _VALID_INCLUDE_VALUES:
        raise ActivityParamsError(
            f"Invalid 'include' value: {value!r}; "
            f"must be one of {sorted(_VALID_INCLUDE_VALUES)}"
        )
    return value


def _parse_page(raw: str) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ActivityParamsError(f"Invalid 'page' value: {raw!r}") from exc
    if value < 0:
        raise ActivityParamsError("Invalid 'page' value: must be >= 0")
    return value


def _parse_page_size(raw: str | None) -> int:
    """``page_size`` honours the default when missing, raises when invalid,
    and silently clamps to ``_MAX_PAGE_SIZE`` (so ``?page_size=500``
    returns 200 records instead of a 400)."""
    if raw is None:
        return _DEFAULT_PAGE_SIZE
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ActivityParamsError(f"Invalid 'page_size' value: {raw!r}") from exc
    if value < 1:
        raise ActivityParamsError("Invalid 'page_size' value: must be >= 1")
    return min(value, _MAX_PAGE_SIZE)


def _parse_iso_datetime(value: str) -> datetime | None:
    """Parse an ISO-8601 datetime string. Tolerates the trailing ``Z``
    suffix that Python <3.11 ``fromisoformat`` rejects, and normalises any
    timezone-aware result to naive UTC.

    The ``since`` / ``until`` filters bind directly against
    ``version_transaction.issued_at``, which is ``sa.DateTime()`` — a
    timezone-*naive* column (UTC by convention). Binding a tz-aware value
    against it shifts the comparison by the session offset on PostgreSQL
    (and raises on some drivers), so collapse aware inputs to naive UTC
    here. Naive inputs pass through unchanged (already treated as UTC).
    """
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _record_matches(record: dict[str, Any], q: str) -> bool:
    """Case-insensitive substring match for the ``q`` search filter,
    over the human-meaningful surfaces of a decorated activity record:
    ``summary``, ``entity_name``, ``kind``, the joined ``path`` segments,
    and the JSON form of ``from_value`` / ``to_value`` (JSON, not Python
    ``str()``: the client searches the serialized text it renders, so
    ``false`` / ``null`` / double-quoted keys must match — and falsy
    values like ``False`` / ``0`` must not collapse to unsearchable
    empty strings).
    """

    def _value_text(value: Any) -> str:
        if value is None:
            return ""
        try:
            return json.dumps(value)
        except (TypeError, ValueError):
            return str(value)

    needle = q.lower()
    haystacks = (
        record.get("summary") or "",
        record.get("entity_name") or "",
        record.get("kind") or "",
        " ".join(str(seg) for seg in (record.get("path") or [])),
        _value_text(record.get("from_value")),
        _value_text(record.get("to_value")),
    )
    return any(needle in h.lower() for h in haystacks)


def get_activity(
    model_cls: type[Model],
    entity_uuid: UUID,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    include: str = "all",
    q: str | None = None,
    page: int = 0,
    page_size: int = _DEFAULT_PAGE_SIZE,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Cross-entity activity stream for one path entity.

    Single polymorphic entry point. Dispatches on *model_cls* to
    assemble the path entity's self records plus the transitive related-
    entity records (charts attached to a dashboard, datasets a chart
    pointed at, etc.).

    Returns ``(records, total_count, truncated)``. ``truncated`` is
    ``True`` when the per-request fetch ceiling
    (``queries._MAX_FETCHED_RECORDS``) bit — older records exist beyond
    what was materialized, so ``count`` is a floor, not the absolute
    total. The count is post-visibility (silent visibility filter),
    post-include-filter, and — when ``q`` is supplied — post-
    search-filter (``count`` reflects the matches, the contract the
    server-side search exists to provide), not just the size of the
    returned slice — clients paginate by passing ``page`` forward until
    ``page * page_size >= count``.

    Raises ``DashboardNotFoundError`` / ``ChartNotFoundError`` /
    ``DatasetNotFoundError`` when the path entity doesn't exist.
    """
    _path_entity, path_id = resolve_path_entity(model_cls, entity_uuid)
    path_kind = model_cls.__name__
    kind_key = path_kind.lower()  # "dashboard" / "slice" / "sqlatable"

    with _phase_timer(kind_key, "relationship_resolution_ms"):
        entity_windows = resolve_scope(path_kind, path_id, include)
    if not entity_windows:
        _emit_request_shape_attributes(
            kind_key,
            include=include,
            has_since_filter=since is not None,
            page_size=page_size,
            record_count=0,
            entity_windows=[],
            path_kind=path_kind,
            path_id=path_id,
        )
        return [], 0, False

    # Visibility filter runs before decoration: it needs the raw
    # ``entity_id`` column (which decoration strips), and dropping
    # invisible records early means we don't pay for name lookup +
    # tombstone probes + impact counts on records the requester
    # can't see (the silent-filter contract).
    with _phase_timer(kind_key, "fetch_ms"):
        records, truncated = fetch_change_records(entity_windows, since, until)
    with _phase_timer(kind_key, "visibility_filter_ms"):
        records = filter_records_by_visibility(records)
    with _phase_timer(kind_key, "denormalize_ms"):
        apply_entity_name_denormalization(records)
        # Runs post-visibility (fewer entities to probe) and pre-
        # decoration (needs the raw table-form entity_kind/entity_id
        # that decoration rewrites).
        mark_first_tracked_saves(records)
    with _phase_timer(kind_key, "decorate_ms"):
        apply_record_decoration(records, path_kind, path_id)

    # Server-side search (the panel's client-side
    # search only covers loaded pages). Applied post-decoration so the
    # synthesized ``summary`` / ``entity_name`` participate, and pre-
    # count so pagination paginates the MATCHES — the full record set
    # is already materialized in Python (the documented design),
    # so the filter adds no extra query.
    if q:
        records = [r for r in records if _record_matches(r, q)]

    total = len(records)
    bounded_size = max(1, min(page_size, _MAX_PAGE_SIZE))
    offset = max(0, page) * bounded_size

    _emit_request_shape_attributes(
        kind_key,
        include=include,
        has_since_filter=since is not None,
        page_size=bounded_size,
        record_count=total,
        entity_windows=entity_windows,
        path_kind=path_kind,
        path_id=path_id,
    )

    return records[offset : offset + bounded_size], total, truncated


def activity_endpoint(
    api: Any, model_cls: type[Model], uuid_str: str, request_args: Any
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/activity/``.

    Same shape as :func:`superset.versioning.api_helpers.list_versions_endpoint`
    for the ``/versions/`` endpoint family. Resolves the path entity,
    parses the request query params, runs :func:`get_activity`, and
    wraps the result through ``ActivityResponseSchema``.

    *api* is the FAB ``ModelRestApi`` instance (pass ``self`` from the
    endpoint method). *request_args* is ``request.args`` from
    ``flask.request`` — passed explicitly so the helper is testable
    without a live Flask context.
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.schemas import ActivityResponseSchema

    try:
        entity, _ = resolve_endpoint_path_entity(api, model_cls, uuid_str)
    except PathEntityResponseError as exc:
        return exc.response

    try:
        params = parse_activity_query_params(request_args)
    except ActivityParamsError as exc:
        return api.response_400(message=str(exc))

    records, count, truncated = get_activity(model_cls, entity.uuid, **params)
    payload = ActivityResponseSchema().dump(
        {"result": records, "count": count, "truncated": truncated}
    )
    return api.response(200, **payload)


# ---- Observability -------------------------------------------------------

#: Common prefix for every metric this module emits.
_METRIC_PREFIX = "superset.activity_view"


@contextlib.contextmanager
def _phase_timer(kind_key: str, phase: str) -> Iterator[None]:
    """Time the wrapped block and emit
    ``superset.activity_view.<kind>.<phase>`` to ``stats_logger_manager``.
    Wrapper around :func:`superset.utils.decorators.stats_timing` that
    centralises the key construction.
    """
    # pylint: disable=import-outside-toplevel
    from superset.extensions import stats_logger_manager
    from superset.utils.decorators import stats_timing

    with stats_timing(
        f"{_METRIC_PREFIX}.{kind_key}.{phase}",
        stats_logger_manager.instance,
    ):
        yield


def _emit_request_shape_attributes(
    kind_key: str,
    *,
    include: str,
    has_since_filter: bool,
    page_size: int,
    record_count: int,
    entity_windows: list[EntityWindows],
    path_kind: str,
    path_id: int,
) -> None:
    """Emit non-PII shape counters about the request and its result set.

    Emits: include_mode / has_since_filter / page_size / record_count
    + per-related-kind entity counts. **No PII**: entity names, diff
    content, user identifiers — none of those reach the metric layer.
    The counters use ``incr`` (counters) since they're tags, not
    latencies; the timing keys above carry the latency dimension.
    """
    # pylint: disable=import-outside-toplevel
    from superset.extensions import stats_logger_manager

    sl = stats_logger_manager.instance

    # Tag-style metrics: one counter per attribute value. The statsd
    # bridge accepts arbitrary strings; downstream dashboards filter by
    # the value segment.
    sl.incr(f"{_METRIC_PREFIX}.{kind_key}.requests.include_{include}")
    sl.incr(
        f"{_METRIC_PREFIX}.{kind_key}.requests."
        f"has_since_filter_{'true' if has_since_filter else 'false'}"
    )
    sl.gauge(f"{_METRIC_PREFIX}.{kind_key}.page_size", float(page_size))
    sl.gauge(f"{_METRIC_PREFIX}.{kind_key}.record_count", float(record_count))

    # Per-related-kind entity counts. The scope
    # list includes the path entity itself (the "self" window); exclude
    # it so the gauge reflects only the *related* entities the request
    # fanned out to, not "this request touched itself".
    by_kind: dict[str, int] = {"Slice": 0, "SqlaTable": 0, "Dashboard": 0}
    for api_kind, entity_id, _windows in entity_windows:
        if (api_kind, entity_id) == (path_kind, path_id):
            continue
        if api_kind in by_kind:
            by_kind[api_kind] += 1
    sl.gauge(
        f"{_METRIC_PREFIX}.{kind_key}.related_entity_count.charts",
        float(by_kind["Slice"]),
    )
    sl.gauge(
        f"{_METRIC_PREFIX}.{kind_key}.related_entity_count.datasets",
        float(by_kind["SqlaTable"]),
    )
