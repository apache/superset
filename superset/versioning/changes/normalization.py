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
"""Types and bounds for chart normalization change summaries."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Final, NotRequired, TypeAlias, TypedDict, TypeGuard
from uuid import uuid4

from sqlalchemy.orm import Session

from superset.utils import json
from superset.versioning.diff import ChangeRecord

JsonScalar: TypeAlias = None | bool | int | float | str
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]

MAX_NORMALIZATION_TRANSITIONS: Final[int] = 256
MAX_CONTROL_NAME_BYTES: Final[int] = 256
MAX_NORMALIZATION_METADATA_BYTES: Final[int] = 256 * 1024
MAX_NORMALIZATION_VALUE_DEPTH: Final[int] = 20

NORMALIZATION_CONTEXT_KEY: Final[str] = "_versioning_chart_normalization_context"

logger: logging.Logger = logging.getLogger(__name__)


class NormalizationTransitionPayload(TypedDict):
    """Presence-aware transition received as advisory request metadata."""

    control: str
    from_present: bool
    from_value: NotRequired[JsonValue]
    to_present: bool
    to_value: NotRequired[JsonValue]


@dataclass(frozen=True)
class NormalizationTransition:
    """Validated top-level chart params transition."""

    control: str
    from_present: bool
    from_value: JsonValue
    to_present: bool
    to_value: JsonValue


@dataclass(frozen=True)
class NormalizationContext:
    """Consume-once evidence scoped to one chart update operation."""

    chart_id: int
    operation_token: str
    transitions: tuple[NormalizationTransition, ...]


@dataclass
class NormalizationContextRegistry:
    """Operation-token registry retained for the active transaction."""

    contexts: dict[tuple[int, str], NormalizationContext]
    active_tokens: dict[int, str | None]


class _InvalidNormalizationEnvelopeError(ValueError):
    """Advisory metadata whose ambiguity requires rejecting all transitions."""


def _json_depth(value: JsonValue) -> int:
    if isinstance(value, list):
        return 1 + max((_json_depth(item) for item in value), default=0)
    if isinstance(value, dict):
        return 1 + max((_json_depth(item) for item in value.values()), default=0)
    return 0


def _is_json_value(value: object) -> TypeGuard[JsonValue]:
    if value is None or isinstance(value, (bool, int, float, str)):
        return True
    if isinstance(value, list):
        return all(_is_json_value(item) for item in value)
    if isinstance(value, dict):
        return all(
            isinstance(key, str) and _is_json_value(item) for key, item in value.items()
        )
    return False


def _json_equal(left: JsonValue, right: JsonValue) -> bool:
    """Compare JSON values without Python's ``True == 1`` coercion."""
    if type(left) is not type(right):
        return False
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(
            _json_equal(a, b) for a, b in zip(left, right, strict=False)
        )
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(
            _json_equal(left[key], right[key]) for key in left
        )
    return left == right


def _parse_normalization_transition(
    item: object,
) -> NormalizationTransition | None:
    """Parse one transition, skipping malformed entries without ambiguity."""
    if not isinstance(item, dict):
        return None
    control: object = item.get("control")
    from_present: object = item.get("from_present")
    to_present: object = item.get("to_present")
    if (
        not isinstance(control, str)
        or not control
        or len(control.encode()) > MAX_CONTROL_NAME_BYTES
        or not isinstance(from_present, bool)
        or not isinstance(to_present, bool)
    ):
        return None
    if (from_present != ("from_value" in item)) or (to_present != ("to_value" in item)):
        return None
    from_value: object = item.get("from_value")
    to_value: object = item.get("to_value")
    if not _is_json_value(from_value) or not _is_json_value(to_value):
        return None
    if (
        _json_depth(from_value) > MAX_NORMALIZATION_VALUE_DEPTH
        or _json_depth(to_value) > MAX_NORMALIZATION_VALUE_DEPTH
    ):
        raise _InvalidNormalizationEnvelopeError
    return NormalizationTransition(
        control=control,
        from_present=from_present,
        from_value=from_value,
        to_present=to_present,
        to_value=to_value,
    )


def sanitize_normalization_changes(
    raw: object,
) -> tuple[NormalizationTransition, ...]:
    """Return bounded valid entries, or no exclusions for an invalid envelope."""
    try:
        encoded: bytes = json.dumps(
            raw, ensure_ascii=False, separators=(",", ":")
        ).encode()
        if (
            not isinstance(raw, list)
            or len(raw) > MAX_NORMALIZATION_TRANSITIONS
            or len(encoded) > MAX_NORMALIZATION_METADATA_BYTES
        ):
            return ()
        transitions: list[NormalizationTransition] = []
        controls: set[str] = set()
        for item in raw:
            transition: NormalizationTransition | None = (
                _parse_normalization_transition(item)
            )
            if transition is None:
                continue
            if transition.control in controls:
                return ()
            controls.add(transition.control)
            transitions.append(transition)
        return tuple(transitions)
    except (
        _InvalidNormalizationEnvelopeError,
        TypeError,
        ValueError,
        UnicodeError,
        RecursionError,
    ):
        return ()


def matching_normalization_context(
    chart_id: int,
    raw: object,
    before_params: dict[str, JsonValue],
    after_params: dict[str, JsonValue],
) -> NormalizationContext | None:
    """Match sanitized advisory transitions against exact params states."""
    matching: list[NormalizationTransition] = []
    for transition in sanitize_normalization_changes(raw):
        before_present: bool = transition.control in before_params
        after_present: bool = transition.control in after_params
        if (
            before_present != transition.from_present
            or after_present != transition.to_present
        ):
            continue
        if before_present and not _json_equal(
            before_params[transition.control], transition.from_value
        ):
            continue
        if after_present and not _json_equal(
            after_params[transition.control], transition.to_value
        ):
            continue
        matching.append(transition)
    if not matching:
        return None
    return NormalizationContext(chart_id, str(uuid4()), tuple(matching))


def register_matching_normalization_context(
    session: Session,
    chart_id: int,
    raw: object,
    before_params_json: str | bytes | bytearray | None,
    after_params_json: str | bytes | bytearray | None,
) -> None:
    """Validate and register advisory evidence for one chart update."""
    if raw is None:
        return
    try:
        before_params: object = json.loads(before_params_json or "{}")
        after_params: object = json.loads(after_params_json or "{}")
        if not isinstance(before_params, dict) or not isinstance(after_params, dict):
            return
        context: NormalizationContext | None = matching_normalization_context(
            chart_id, raw, before_params, after_params
        )
        if context is not None:
            store_normalization_context(session, context)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Ignoring chart normalization metadata for chart id=%s", chart_id
        )


def store_normalization_context(
    session: Session, context: NormalizationContext
) -> None:
    """Store one operation's evidence, invalidating ambiguous same-chart evidence."""
    registry: NormalizationContextRegistry = session.info.setdefault(
        NORMALIZATION_CONTEXT_KEY,
        NormalizationContextRegistry(contexts={}, active_tokens={}),
    )
    existing_token: str | None = registry.active_tokens.get(context.chart_id)
    if existing_token is not None:
        registry.contexts.pop((context.chart_id, existing_token), None)
        registry.active_tokens[context.chart_id] = None
        return
    if context.chart_id in registry.active_tokens:
        return
    registry.contexts[(context.chart_id, context.operation_token)] = context
    registry.active_tokens[context.chart_id] = context.operation_token


def consume_normalization_context(
    session: Session, chart_id: int
) -> NormalizationContext | None:
    """Consume chart-scoped evidence at most once."""
    registry: NormalizationContextRegistry | None = session.info.get(
        NORMALIZATION_CONTEXT_KEY
    )
    if registry is None:
        return None
    operation_token: str | None = registry.active_tokens.pop(chart_id, None)
    if operation_token is None:
        return None
    return registry.contexts.pop((chart_id, operation_token), None)


def filter_normalization_records(
    records: list[ChangeRecord], context: NormalizationContext | None
) -> list[ChangeRecord]:
    """Return a fresh readable diff with exact normalization controls omitted."""
    if context is None:
        return list(records)
    controls: set[str] = {transition.control for transition in context.transitions}
    return [
        record
        for record in records
        if not (
            len(record.path) >= 2
            and record.path[0] == "params"
            and record.path[1] in controls
        )
    ]
