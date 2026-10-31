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

"""Restore membership warning counts."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.versioning.activity.kinds import Window


@pytest.mark.parametrize(("transaction_id", "expected"), [(5, 2), (10, 1), (20, 2)])
def test_restore_removal_count_uses_membership_windows(
    mocker: MockerFixture, transaction_id: int, expected: int
) -> None:
    """Count current members absent at the target, including detach/re-attach."""
    from superset.versioning.membership import dashboard_restore_removal_count

    session: MagicMock = mocker.patch("superset.versioning.membership.db.session")
    session.execute.return_value.scalars.return_value = [1, 2, 3]
    mocker.patch(
        "superset.versioning.membership.chart_attachment_windows_for_dashboard",
        return_value=[(1, Window(1, None)), (2, Window(10, 20)), (2, Window(30, None))],
    )
    assert dashboard_restore_removal_count(7, transaction_id) == expected


def test_restore_removal_count_excludes_nonmembers(mocker: MockerFixture) -> None:
    """A historical chart absent from current membership is not a removal."""
    from superset.versioning.membership import dashboard_restore_removal_count

    session: MagicMock = mocker.patch("superset.versioning.membership.db.session")
    session.execute.return_value.scalars.return_value = [1]
    mocker.patch(
        "superset.versioning.membership.chart_attachment_windows_for_dashboard",
        return_value=[(1, Window(1, None)), (99, Window(1, None))],
    )
    assert dashboard_restore_removal_count(7, 5) == 0


@pytest.mark.parametrize("requested", [False, True])
@pytest.mark.parametrize("dashboard", [False, True])
def test_snapshot_removal_count_is_opt_in_and_dashboard_only(
    app: object, mocker: MockerFixture, requested: bool, dashboard: bool
) -> None:
    """Only an authorized dashboard snapshot can opt into the count."""
    from types import SimpleNamespace
    from uuid import UUID

    from flask import jsonify, Response

    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.versioning import api_helpers

    entity_uuid: UUID = UUID("00000000-0000-4000-8000-000000000001")
    api: MagicMock = MagicMock()
    api.response.side_effect = lambda status, **values: jsonify(values)
    mocker.patch.object(
        api_helpers,
        "resolve_endpoint_path_entity",
        return_value=(SimpleNamespace(id=7), entity_uuid),
    )
    mocker.patch.object(
        api_helpers.VersionDAO,
        "get_version",
        return_value={
            "_version": {"transaction_id": 5},
        },
    )
    mocker.patch.object(
        api_helpers,
        "set_version_etag_by_uuid",
        side_effect=lambda response, *args, **kwargs: response,
    )
    count: MagicMock = mocker.patch(
        "superset.versioning.membership.dashboard_restore_removal_count", return_value=2
    )
    response: Response = api_helpers.get_version_endpoint(
        api,
        Dashboard if dashboard else Slice,
        str(entity_uuid),
        str(entity_uuid),
        include_restore_impact=requested,
    )
    if requested and dashboard:
        assert response.json["result"]["_restore_impact"] == {"removed_chart_count": 2}
        assert response.cache_control.no_store
        count.assert_called_once_with(7, 5)
    else:
        assert "_restore_impact" not in response.json["result"]
        count.assert_not_called()


def test_snapshot_refusal_does_not_read_restore_impact(mocker: MockerFixture) -> None:
    """The existing editorship gate runs before membership is read."""
    from flask import Response

    from superset.models.dashboard import Dashboard
    from superset.versioning import api_helpers

    refusal: Response = Response(status=403)
    mocker.patch.object(
        api_helpers,
        "resolve_endpoint_path_entity",
        side_effect=api_helpers.PathEntityResponseError(refusal),
    )
    count: MagicMock = mocker.patch(
        "superset.versioning.membership.dashboard_restore_removal_count"
    )
    assert (
        api_helpers.get_version_endpoint(
            MagicMock(), Dashboard, "id", "version", include_restore_impact=True
        )
        is refusal
    )
    count.assert_not_called()


def test_removal_count_reads_only_the_dashboards_associations(
    mocker: MockerFixture,
) -> None:
    """Count unplaced/archived associations without joining visible charts."""
    import sqlalchemy as sa
    from sqlalchemy.orm import Session

    from superset.versioning.membership import dashboard_restore_removal_count

    engine: sa.Engine = sa.create_engine("sqlite:///:memory:")
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE dashboard_slices (dashboard_id INTEGER, slice_id INTEGER)"
            )
            connection.exec_driver_sql(
                "INSERT INTO dashboard_slices VALUES (7, 1), (7, 2), (7, 3), (8, 99)"
            )
        with Session(engine) as session:
            mocker.patch("superset.versioning.membership.db.session", session)
            mocker.patch(
                "superset.versioning.membership.chart_attachment_windows_for_dashboard",
                return_value=[(1, Window(1, None))],
            )
            assert dashboard_restore_removal_count(7, 5) == 2
    finally:
        engine.dispose()
