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
"""Golden-set tests pinning the purge-audit reason-code vocabulary."""

from __future__ import annotations

from dataclasses import replace
from unittest.mock import MagicMock

import pytest

from superset.commands.deletion_retention.purge_policy import (
    ALL_REASON_CODES,
    DependencyClassification,
    DependencyPolicy,
    get_purge_policy,
    purge_policy_registry,
    PurgeBlockedError,
    PurgeEntityPolicy,
    REASON_CASCADE_INTEGRITY_FAILURE,
    REASON_REPORT_SCHEDULE,
    REASON_USER_ATTRIBUTE,
    validate_deletion_allowed,
)


def test_reason_code_literals_are_frozen() -> None:
    """The persisted code values are frozen identifiers.

    Audit history and the suppression predicate compare these exact strings;
    a physical table rename or constant refactor must not re-mint them. If
    this test fails, the fix is to restore the literal, never to update the
    expectation.
    """
    assert REASON_REPORT_SCHEDULE == "report_schedule"
    assert REASON_USER_ATTRIBUTE == "user_attribute"
    assert REASON_CASCADE_INTEGRITY_FAILURE == "cascade_integrity_failure"
    assert ALL_REASON_CODES == {
        "report_schedule",
        "user_attribute",
        "cascade_integrity_failure",
    }


def test_reason_codes_are_distinct_and_column_sized() -> None:
    """Codes are mutually distinct and fit the String(64) audit column."""
    codes: list[str] = [
        REASON_REPORT_SCHEDULE,
        REASON_USER_ATTRIBUTE,
        REASON_CASCADE_INTEGRITY_FAILURE,
    ]
    assert len(set(codes)) == len(codes)
    assert all(0 < len(code) <= 64 for code in ALL_REASON_CODES)


def test_every_declared_blocker_code_is_in_the_closed_set() -> None:
    """Each blocker declared in the registry carries a code from ALL_REASON_CODES."""
    blocker_codes: set[str] = set()
    for policy in purge_policy_registry().values():
        for dependency in policy.dependencies:
            if dependency.classification is DependencyClassification.BLOCK:
                assert dependency.blocker is not None, (
                    f"blocker {dependency.key.describe()} has no reason code"
                )
                blocker_codes.add(dependency.blocker.code)
    assert blocker_codes <= ALL_REASON_CODES
    assert blocker_codes == {REASON_REPORT_SCHEDULE, REASON_USER_ATTRIBUTE}


def test_cascade_integrity_failure_code_is_reserved_for_the_cascade() -> None:
    """No declared policy blocker may claim the cascade-failure code."""
    for policy in purge_policy_registry().values():
        for dependency in policy.dependencies:
            assert (
                dependency.blocker is None
                or dependency.blocker.code != REASON_CASCADE_INTEGRITY_FAILURE
            )


def _session_matching_blockers(*matches: bool) -> MagicMock:
    """A mock session whose Nth blocker query reports a match iff matches[N].

    Deliberately positional: which blocker matches first is the audit
    contract under test, so these cases are coupled to the order (and the
    count) of the queries ``validate_deletion_allowed`` issues.
    """
    session: MagicMock = MagicMock()
    session.execute.side_effect = [
        MagicMock(first=MagicMock(return_value=(1,) if match else None))
        for match in matches
    ]
    return session


def test_report_block_raises_with_the_report_schedule_code() -> None:
    """A chart blocked by a report reference carries REASON_REPORT_SCHEDULE."""
    # avoid app-init regression: superset.models.* evaluates
    # encrypted_field_factory at class-definition time, which fails
    # in a partial-collection unit run with no Flask app active.
    from superset.models.slice import Slice

    info: pytest.ExceptionInfo[PurgeBlockedError]
    with pytest.raises(PurgeBlockedError) as info:
        validate_deletion_allowed(
            _session_matching_blockers(True), get_purge_policy(Slice), 1
        )
    assert info.value.reason_code == REASON_REPORT_SCHEDULE
    assert str(info.value) == "associated alerts or reports exist"


def test_welcome_dashboard_block_raises_with_the_user_attribute_code() -> None:
    """A welcome-page block carries a code distinct from the report code."""
    # avoid app-init regression: superset.models.* evaluates
    # encrypted_field_factory at class-definition time, which fails
    # in a partial-collection unit run with no Flask app active.
    from superset.models.dashboard import Dashboard

    info: pytest.ExceptionInfo[PurgeBlockedError]
    with pytest.raises(PurgeBlockedError) as info:
        validate_deletion_allowed(
            _session_matching_blockers(False, True), get_purge_policy(Dashboard), 1
        )
    assert info.value.reason_code == REASON_USER_ATTRIBUTE


def test_reason_code_survives_a_related_table_rename() -> None:
    """A renamed table keeps the blocker's declared code.

    The code is declared on the blocker, never derived from the physical
    table name, so a schema rename changes only which table the blocker
    looks at — persisted audit history and the suppression predicate keep
    comparing the same literal.
    """
    # avoid app-init regression: superset.models.* evaluates
    # encrypted_field_factory at class-definition time, which fails
    # in a partial-collection unit run with no Flask app active.
    from superset.models.slice import Slice

    policy: PurgeEntityPolicy = get_purge_policy(Slice)
    renamed: tuple[DependencyPolicy, ...] = tuple(
        replace(dependency, key=replace(dependency.key, related_table="reports_v2"))
        if dependency.classification is DependencyClassification.BLOCK
        else dependency
        for dependency in policy.dependencies
    )
    blocker: DependencyPolicy = next(
        dependency
        for dependency in renamed
        if dependency.classification is DependencyClassification.BLOCK
    )
    assert blocker.key.related_table == "reports_v2"
    assert blocker.blocker is not None
    assert blocker.blocker.code == REASON_REPORT_SCHEDULE


def test_first_declared_blocker_wins_when_several_match() -> None:
    """A dashboard matching both blockers records the first-declared code."""
    # avoid app-init regression: superset.models.* evaluates
    # encrypted_field_factory at class-definition time, which fails
    # in a partial-collection unit run with no Flask app active.
    from superset.models.dashboard import Dashboard

    info: pytest.ExceptionInfo[PurgeBlockedError]
    with pytest.raises(PurgeBlockedError) as info:
        validate_deletion_allowed(
            _session_matching_blockers(True, True), get_purge_policy(Dashboard), 1
        )
    assert info.value.reason_code == REASON_REPORT_SCHEDULE
