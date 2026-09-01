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
"""Unit tests for ``superset.connectors.sqla.partition_mapping``."""

from __future__ import annotations

from typing import Any

import pytest

from superset.connectors.sqla.partition_mapping import (
    contains_jinja,
    contains_value_placeholder,
    find_non_deterministic_functions,
    MappingValidationIssue,
    validate_partition_mapping,
)

# ---------------------------------------------------------------------------
# §5 — transform inspection helpers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "transform,expected",
    [
        ("unix_timestamp(:value)", True),
        ("lower(:value)", True),
        ("CAST(:value AS BIGINT)", True),
        ("unix_timestamp(event_time)", False),
        (":values", False),
        ("", False),
        (None, False),
    ],
)
def test_contains_value_placeholder(transform: str | None, expected: bool) -> None:
    assert contains_value_placeholder(transform) is expected


@pytest.mark.parametrize(
    "transform,expected",
    [
        ("unix_timestamp(:value)", False),
        ("{{ current_username() }}", True),
        ("lower({% if x %}:value{% endif %})", True),
        ("lower(:value) -- {# comment #}", True),
    ],
)
def test_contains_jinja(transform: str, expected: bool) -> None:
    assert contains_jinja(transform) is expected


@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value)",
        "lower(:value)",
        "CAST(:value AS BIGINT)",
        "date_format(:value, 'yyyyMMdd')",
    ],
)
def test_pure_transforms_report_no_non_deterministic_functions(
    transform: str,
) -> None:
    assert find_non_deterministic_functions(transform, "hive") == set()


@pytest.mark.parametrize(
    "transform,expected_name",
    [
        ("date_diff(:value, now())", "NOW"),
        ("CAST(:value AS BIGINT) + rand()", "RAND"),
        ("CAST(:value AS DATE) - current_date", "CURRENT_DATE"),
    ],
)
def test_non_deterministic_functions_are_reported(
    transform: str, expected_name: str
) -> None:
    """
    The probe runs at a different moment and in a different session from the
    chart query, and its result is cached, so anything time- or
    randomness-dependent freezes a snapshot of probe time into the predicate.
    """
    assert expected_name in find_non_deterministic_functions(transform, "hive")


def test_niladic_unix_timestamp_is_rejected_but_the_unary_form_is_not() -> None:
    """
    On Hive/Impala ``unix_timestamp()`` means "now" while ``unix_timestamp(x)``
    -- the canonical temporal transform -- is pure. The distinction is the whole
    reason this check inspects arity rather than just the name.
    """
    assert find_non_deterministic_functions("unix_timestamp(:value)", "hive") == set()
    assert find_non_deterministic_functions(
        "unix_timestamp(:value) - unix_timestamp()", "hive"
    )


# ---------------------------------------------------------------------------
# §5 — save-time validation, in two tiers
# ---------------------------------------------------------------------------


def _issues(**kwargs: Any) -> list[MappingValidationIssue]:
    defaults: dict[str, Any] = {
        "column_names": {"event_time", "dt_epoch", "country", "region_key"},
        "partition_column": "dt_epoch",
        "partition_mapped_column": None,
        "main_dttm_col": "event_time",
        "transform": "unix_timestamp(:value)",
        "engine": "hive",
    }
    defaults.update(kwargs)
    return validate_partition_mapping(**defaults)


def _blocking(issues: list[MappingValidationIssue]) -> list[MappingValidationIssue]:
    return [issue for issue in issues if issue.blocking]


def _warnings(issues: list[MappingValidationIssue]) -> list[MappingValidationIssue]:
    return [issue for issue in issues if not issue.blocking]


def test_a_well_formed_mapping_raises_nothing() -> None:
    assert _issues() == []


def test_no_partition_column_means_nothing_to_validate() -> None:
    assert _issues(partition_column=None, transform=None) == []


# Tier 1 — blocks the save


def test_an_unknown_partition_column_blocks_the_save() -> None:
    issues = _issues(partition_column="nope")
    assert len(_blocking(issues)) == 1
    assert issues[0].field == "partition_column"


def test_an_unknown_mapped_column_override_blocks_the_save() -> None:
    issues = _issues(partition_mapped_column="nope")
    assert len(_blocking(issues)) == 1
    assert issues[0].field == "partition_mapped_column"


def test_an_explicit_self_mapping_blocks_the_save() -> None:
    issues = _blocking(_issues(partition_mapped_column="dt_epoch"))
    assert len(issues) == 1
    assert "itself" in issues[0].message


def test_an_implicit_self_mapping_blocks_the_save() -> None:
    """
    Checking only the explicit override misses the case an owner actually hits:
    setting ``partition_column`` to the column that is *already* the default
    datetime column, with no override in play.
    """
    issues = _blocking(
        _issues(partition_column="event_time", main_dttm_col="event_time")
    )
    assert len(issues) == 1
    assert "itself" in issues[0].message


def test_jinja_in_the_transform_blocks_the_save() -> None:
    """
    The probe would render the template in a different context at a different
    time from the chart query, so v1 disallows it outright.
    """
    issues = _blocking(_issues(transform="unix_timestamp('{{ ds }}' , :value)"))
    assert len(issues) == 1
    assert "Jinja" in issues[0].message


@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value) - unix_timestamp()",
        "date_diff(:value, now())",
        "CAST(:value AS BIGINT) + rand()",
    ],
)
def test_a_non_deterministic_transform_blocks_the_save(transform: str) -> None:
    issues = _blocking(_issues(transform=transform))
    assert len(issues) == 1
    assert issues[0].field == "partition_value_transform"


# Tier 2 — saves, but the mapping stays inactive


def test_an_unparseable_transform_saves_with_a_warning() -> None:
    """The PRD is explicit: a bad transform still saves, it just stays inactive."""
    issues = _issues(transform="unix_timestamp(:value")
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_a_transform_without_the_placeholder_saves_with_a_warning() -> None:
    issues = _issues(transform="unix_timestamp(event_time)")
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_a_missing_transform_saves_with_a_warning() -> None:
    issues = _issues(transform=None)
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_an_unparseable_transform_skips_the_checks_that_need_a_parse() -> None:
    """
    The Jinja and non-determinism checks require a successful parse. When there
    is nothing to inspect, fall through to a warning rather than reporting a
    blocking error the owner cannot act on.
    """
    issues = _issues(transform="now(:value")
    assert _blocking(issues) == []
