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
"""Tests for authoritative dataset purge-impact snapshots."""

from __future__ import annotations

from contextlib import nullcontext
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import UUID

from sqlalchemy.orm import Session

from superset.commands.deletion_retention.purge_impact import (
    _impact_token,
    collect_dataset_purge_impact,
    DatasetImpactObject,
    DatasetPurgeImpact,
)


def _object(kind_id: int, uuid: str, *, archived: bool = False) -> DatasetImpactObject:
    return DatasetImpactObject(
        id=kind_id,
        uuid=uuid,
        name=f"object-{kind_id}",
        archived=archived,
    )


def test_impact_token_canonicalizes_uuid_order() -> None:
    """Database ordering must not be part of the confirmation contract."""
    first: DatasetImpactObject = _object(1, "00000000-0000-0000-0000-000000000001")
    second: DatasetImpactObject = _object(2, "00000000-0000-0000-0000-000000000002")

    forward: str = _impact_token((first, second), ())
    reverse: str = _impact_token((second, first), ())

    assert forward == reverse
    assert forward.startswith("v1:")


def test_impact_token_namespaces_chart_and_dashboard_identities() -> None:
    """Moving the same UUID between object kinds changes the reviewed impact."""
    shared: DatasetImpactObject = _object(1, "00000000-0000-0000-0000-000000000001")

    assert _impact_token((shared,), ()) != _impact_token((), (shared,))


def test_impact_token_detects_same_count_identity_substitution() -> None:
    original: DatasetImpactObject = _object(1, "00000000-0000-0000-0000-000000000001")
    replacement: DatasetImpactObject = _object(
        2, "00000000-0000-0000-0000-000000000002"
    )

    assert _impact_token((original,), ()) != _impact_token((replacement,), ())


def test_collector_includes_archived_objects_and_deduplicates_dashboards() -> None:
    archived_at: datetime = datetime(2026, 8, 1, tzinfo=timezone.utc)
    chart_uuid: UUID = UUID("00000000-0000-0000-0000-000000000001")
    dashboard_uuid: UUID = UUID("00000000-0000-0000-0000-000000000002")
    chart_result: MagicMock = MagicMock()
    chart_result.tuples.return_value = [(10, chart_uuid, "Archived chart", archived_at)]
    dashboard_result: MagicMock = MagicMock()
    # A dashboard containing two affected charts is one impacted dashboard.
    dashboard_result.tuples.return_value = [
        (20, dashboard_uuid, "Archived dashboard", archived_at),
        (20, dashboard_uuid, "Archived dashboard", archived_at),
    ]
    session: MagicMock = MagicMock(spec=Session)
    session.execute.side_effect = [chart_result, dashboard_result]

    with patch(
        "superset.commands.deletion_retention.purge_impact.skip_visibility_filter",
        return_value=nullcontext(),
    ):
        impact: DatasetPurgeImpact = collect_dataset_purge_impact(session, dataset_id=7)

    assert [(item.uuid, item.archived) for item in impact.charts] == [
        (str(chart_uuid), True)
    ]
    assert [(item.uuid, item.archived) for item in impact.dashboards] == [
        (str(dashboard_uuid), True)
    ]
