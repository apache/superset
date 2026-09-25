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

from sqlalchemy.orm import Session

from superset.versioning.changes.normalization import (
    consume_normalization_context,
    filter_normalization_records,
    matching_normalization_context,
    MAX_NORMALIZATION_TRANSITIONS,
    NormalizationContext,
    NormalizationTransition,
    sanitize_normalization_changes,
    store_normalization_context,
)
from superset.versioning.diff import ChangeRecord


def _transition(
    control: str = "row_limit", from_value: object = None, to_value: object = 10000
) -> dict[str, object]:
    return {
        "control": control,
        "from_present": True,
        "from_value": from_value,
        "to_present": True,
        "to_value": to_value,
    }


def test_sanitizer_preserves_missing_and_null_as_distinct_states() -> None:
    missing: dict[str, object] = {
        "control": "show_legend",
        "from_present": False,
        "to_present": True,
        "to_value": True,
    }
    null: dict[str, object] = _transition("row_limit")

    transitions: tuple[NormalizationTransition, ...] = sanitize_normalization_changes(
        [missing, null]
    )

    assert len(transitions) == 2
    assert not transitions[0].from_present
    assert transitions[1].from_present
    assert transitions[1].from_value is None


def test_sanitizer_ignores_bad_entries_but_rejects_duplicate_envelope() -> None:
    assert len(sanitize_normalization_changes([{"bad": True}, _transition()])) == 1
    assert sanitize_normalization_changes([_transition(), _transition()]) == ()
    assert sanitize_normalization_changes({"not": "a list"}) == ()


def test_sanitizer_rejects_bounded_envelope_failures() -> None:
    too_many: list[dict[str, object]] = [
        _transition(control=f"control_{index}")
        for index in range(MAX_NORMALIZATION_TRANSITIONS + 1)
    ]
    deep_value: object = None
    for _index in range(22):
        deep_value = [deep_value]

    assert sanitize_normalization_changes(too_many) == ()
    assert sanitize_normalization_changes([_transition(control="x" * 257)]) == ()
    assert sanitize_normalization_changes([_transition(from_value=deep_value)]) == ()
    assert sanitize_normalization_changes([object()]) == ()


def test_matching_requires_exact_presence_and_json_value_types() -> None:
    raw: list[dict[str, object]] = [
        {
            "control": "show_legend",
            "from_present": False,
            "to_present": True,
            "to_value": True,
        },
        _transition(),
    ]

    context: NormalizationContext | None = matching_normalization_context(
        7, raw, {"row_limit": None}, {"show_legend": True, "row_limit": 10000}
    )

    assert context is not None
    assert {item.control for item in context.transitions} == {
        "show_legend",
        "row_limit",
    }
    assert (
        matching_normalization_context(
            7,
            [_transition(from_value=True, to_value=2)],
            {"row_limit": 1},
            {"row_limit": 2},
        )
        is None
    )


def test_filter_returns_fresh_records_without_matching_params_control() -> None:
    records: list[ChangeRecord] = [
        ChangeRecord("field", "edit", ["params", "row_limit"], None, 10000),
        ChangeRecord("field", "edit", ["slice_name"], "Old", "New"),
    ]
    context: NormalizationContext | None = matching_normalization_context(
        7, [_transition()], {"row_limit": None}, {"row_limit": 10000}
    )

    filtered: list[ChangeRecord] = filter_normalization_records(records, context)

    assert filtered == [records[1]]
    assert filtered is not records


def test_context_is_consumed_once_and_same_chart_ambiguity_fails_open() -> None:
    session: Session = Session()
    context: NormalizationContext | None = matching_normalization_context(
        7, [_transition()], {"row_limit": None}, {"row_limit": 10000}
    )
    assert context is not None
    store_normalization_context(session, context)
    assert consume_normalization_context(session, 7) == context
    assert consume_normalization_context(session, 7) is None

    store_normalization_context(session, context)
    store_normalization_context(session, context)
    assert consume_normalization_context(session, 7) is None


def test_drop_transition_matches_and_filters_a_remove_record() -> None:
    """A stash-time drop (present -> absent) suppresses its remove record."""
    raw: list[dict[str, object]] = [
        {
            "control": "order_desc",
            "from_present": True,
            "from_value": True,
            "to_present": False,
        },
    ]

    context: NormalizationContext | None = matching_normalization_context(
        7, raw, {"order_desc": True, "row_limit": 100}, {"row_limit": 100}
    )

    assert context is not None
    assert [item.control for item in context.transitions] == ["order_desc"]

    records: list[ChangeRecord] = [
        ChangeRecord("field", "remove", ["params", "order_desc"], True, None),
        ChangeRecord("field", "edit", ["params", "row_limit"], 100, 50),
    ]
    assert filter_normalization_records(records, context) == [records[1]]


def test_drop_transition_requires_the_key_to_be_absent_after() -> None:
    """A drop advisory does not match when the key survived the save."""
    raw: list[dict[str, object]] = [
        {
            "control": "order_desc",
            "from_present": True,
            "from_value": True,
            "to_present": False,
        },
    ]
    assert (
        matching_normalization_context(
            7, raw, {"order_desc": True}, {"order_desc": False}
        )
        is None
    )
