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
# pylint: disable=import-outside-toplevel, unused-argument

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset import db
from superset.commands.dashboard.importers import v0
from superset.models.dashboard import Dashboard
from superset.time_range_limits.adjustments import TimeRangeAdjustmentsRequiredError
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags

# A minimal unversioned dashboard export carrying an embedded dataset. The
# dataset object is enough to drive the datasets loop in ``import_dashboards``.
CONTENT_WITH_DATASET = json.dumps(
    {
        "datasources": [
            {
                "__SqlaTable__": {
                    "table_name": "sample_table",
                    "params": json.dumps({"remote_id": 1, "database_name": "main"}),
                }
            }
        ],
        "dashboards": [],
    }
)


def test_import_dashboards_requires_dataset_write(mocker: MockerFixture) -> None:
    """
    A user must hold dataset write permission to create/update the datasets
    embedded in a legacy dashboard export.
    """
    from superset import security_manager
    from superset.commands.exceptions import ImportFailedError

    mocker.patch.object(v0, "get_user", return_value=object())
    can_access = mocker.patch.object(security_manager, "can_access", return_value=False)
    import_dataset = mocker.patch.object(v0, "import_dataset")

    with pytest.raises(ImportFailedError):
        v0.import_dashboards(CONTENT_WITH_DATASET)

    can_access.assert_called_once_with("can_write", "Dataset")
    import_dataset.assert_not_called()


def test_import_dashboards_allows_dataset_write(mocker: MockerFixture) -> None:
    """
    A user holding dataset write permission proceeds to import the datasets.
    """
    from superset import security_manager

    mocker.patch.object(v0, "get_user", return_value=object())
    mocker.patch.object(security_manager, "can_access", return_value=True)
    import_dataset = mocker.patch.object(v0, "import_dataset", return_value=42)

    v0.import_dashboards(CONTENT_WITH_DATASET)

    import_dataset.assert_called_once()


def test_import_dashboards_skips_check_without_user(mocker: MockerFixture) -> None:
    """
    The command-line import paths run without a request user; the permission
    check is skipped so those paths keep working.
    """
    from superset import security_manager

    mocker.patch.object(v0, "get_user", return_value=None)
    can_access = mocker.patch.object(security_manager, "can_access")
    import_dataset = mocker.patch.object(v0, "import_dataset", return_value=42)

    v0.import_dashboards(CONTENT_WITH_DATASET)

    can_access.assert_not_called()
    import_dataset.assert_called_once()


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_legacy_import_lists_every_dashboard_before_clamping(
    session: Session, mocker: MockerFixture
) -> None:
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    global_limits = {
        "schema_version": 1,
        "max_span": {"quantity": 60, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    }
    stale = {**global_limits, "max_span": {"quantity": 90, "time_grain": "P1D"}}
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_limits})
    contents: dict[str, str] = {}
    for remote_id in (1234, 5678):
        metadata = json.dumps({"remote_id": remote_id, "time_range_limits": stale})
        db.session.add(
            Dashboard(dashboard_title=f"Original {remote_id}", json_metadata=metadata)
        )
        content = {
            "datasources": [],
            "dashboards": [
                {
                    "__Dashboard__": {
                        "id": remote_id,
                        "dashboard_title": f"Imported {remote_id}",
                        "json_metadata": metadata,
                    }
                }
            ],
        }
        contents[f"dashboard_{remote_id}.json"] = json.dumps(content)
    db.session.commit()

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
        v0.ImportDashboardsCommand(contents).run()

    assert excinfo.value.payload() == [
        {
            "kind": "time_range_limit",
            "dashboard": f"Imported {remote_id}",
            "dashboard_key": str(remote_id),
            "file": f"dashboard_{remote_id}.json",
            "name": f"Imported {remote_id}",
            "filter_id": None,
            "field": "max_span",
            "old": {"quantity": 90, "time_grain": "P1D"},
            "new": {"quantity": 60, "time_grain": "P1D"},
            "old_label": "90 days",
            "new_label": "60 days",
        }
        for remote_id in (1234, 5678)
    ]
    dashboards = db.session.query(Dashboard).order_by(Dashboard.id).all()
    assert [dashboard.dashboard_title for dashboard in dashboards] == [
        "Original 1234",
        "Original 5678",
    ]
    assert all(
        dashboard.params_dict["time_range_limits"] == stale for dashboard in dashboards
    )

    v0.ImportDashboardsCommand(contents, adjust_time_ranges=True).run()

    dashboards = db.session.query(Dashboard).order_by(Dashboard.id).all()
    assert [dashboard.dashboard_title for dashboard in dashboards] == [
        "Imported 1234",
        "Imported 5678",
    ]
    assert all(
        dashboard.params_dict["time_range_limits"] == global_limits
        for dashboard in dashboards
    )


@with_feature_flags(TIME_RANGE_LIMITS=True)
@pytest.mark.parametrize("stored", ["fitted", "none"])
def test_legacy_import_over_an_existing_dashboard_fits_a_looser_file(
    session: Session, mocker: MockerFixture, stored: str
) -> None:
    """Over an existing dashboard whose stored limit an earlier import already
    fitted, or that has none, a looser file asks and fits instead of refusing."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    global_limits = {
        "schema_version": 1,
        "max_span": {"quantity": 60, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    }
    looser = {**global_limits, "max_span": {"quantity": 90, "time_grain": "P1D"}}
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_limits})
    existing: dict[str, object] = {"remote_id": 1234}
    if stored == "fitted":
        existing["time_range_limits"] = global_limits
    db.session.add(
        Dashboard(dashboard_title="Original", json_metadata=json.dumps(existing))
    )
    db.session.commit()
    metadata = json.dumps({"remote_id": 1234, "time_range_limits": looser})
    contents = {
        "dashboard.json": json.dumps(
            {
                "datasources": [],
                "dashboards": [
                    {
                        "__Dashboard__": {
                            "id": 1234,
                            "dashboard_title": "Imported",
                            "json_metadata": metadata,
                        }
                    }
                ],
            }
        )
    }

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
        v0.ImportDashboardsCommand(contents).run()

    assert [
        (item["old_label"], item["new_label"]) for item in excinfo.value.payload()
    ] == [("90 days", "60 days")]
    assert db.session.query(Dashboard).one().dashboard_title == "Original"

    v0.ImportDashboardsCommand(contents, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Imported"
    assert dashboard.params_dict["time_range_limits"] == global_limits


def days_policy(days: int) -> dict[str, object]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": days, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    }


def legacy_file(
    title: str, days: int, metadata_remote_id: int = 1234, remote_id: int = 1234
) -> str:
    metadata = {"remote_id": metadata_remote_id, "time_range_limits": days_policy(days)}
    return json.dumps(
        {
            "datasources": [],
            "dashboards": [
                {
                    "__Dashboard__": {
                        "id": remote_id,
                        "dashboard_title": title,
                        "json_metadata": json.dumps(metadata),
                    }
                }
            ],
        }
    )


@with_feature_flags(TIME_RANGE_LIMITS=True)
@pytest.mark.parametrize("consent", [False, True], ids=["ask", "cli-consent"])
def test_legacy_import_repeating_an_existing_target_fits_the_later_looser_entry(
    session: Session, mocker: MockerFixture, consent: bool
) -> None:
    """Two entries overwrite the same existing row and the second is looser: the
    second fits the row the first leaves, instead of refusing the batch."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": days_policy(60)})
    db.session.add(
        Dashboard(
            dashboard_title="Original",
            json_metadata=json.dumps(
                {"remote_id": 1234, "time_range_limits": days_policy(60)}
            ),
        )
    )
    db.session.commit()
    contents = {
        "first.json": legacy_file("First", 30),
        "second.json": legacy_file("Second", 90),
    }

    if not consent:
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
            v0.ImportDashboardsCommand(contents).run()
        assert [
            (item["file"], item["old_label"], item["new_label"])
            for item in excinfo.value.payload()
        ] == [("second.json", "90 days", "60 days")]
        assert db.session.query(Dashboard).one().dashboard_title == "Original"
        return

    v0.ImportDashboardsCommand(contents, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Second"
    assert dashboard.params_dict["time_range_limits"] == days_policy(60)


@with_feature_flags(TIME_RANGE_LIMITS=True)
@pytest.mark.parametrize("consent", [False, True], ids=["ask", "cli-consent"])
def test_legacy_import_after_a_re_key_chain_fits_the_later_looser_entry(
    session: Session, mocker: MockerFixture, consent: bool
) -> None:
    """The existing row is re-keyed from 1234 to 5678 and back inside the batch,
    so the third entry overwrites that same row: it fits and asks."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": days_policy(60)})
    db.session.add(
        Dashboard(
            dashboard_title="Original",
            json_metadata=json.dumps(
                {"remote_id": 1234, "time_range_limits": days_policy(60)}
            ),
        )
    )
    db.session.commit()
    contents = {
        "first.json": legacy_file("First", 30, metadata_remote_id=5678),
        "second.json": legacy_file(
            "Second", 30, metadata_remote_id=1234, remote_id=5678
        ),
        "third.json": legacy_file("Third", 90),
    }

    if not consent:
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
            v0.ImportDashboardsCommand(contents).run()
        assert [
            (item["file"], item["old_label"], item["new_label"])
            for item in excinfo.value.payload()
        ] == [("third.json", "90 days", "60 days")]
        assert db.session.query(Dashboard).one().dashboard_title == "Original"
        return

    v0.ImportDashboardsCommand(contents, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Third"
    assert dashboard.params_dict["time_range_limits"] == days_policy(60)


@with_feature_flags(TIME_RANGE_LIMITS=True)
@pytest.mark.parametrize(
    "existing,first_remote_id",
    [(False, 1234), (True, 5678)],
    ids=["created-by-the-batch", "re-keyed-by-the-first-entry"],
)
def test_legacy_import_looser_entry_on_a_new_row_is_refused(
    session: Session, mocker: MockerFixture, existing: bool, first_remote_id: int
) -> None:
    """A looser entry whose row the import creates is refused: the row doesn't
    exist yet, or an earlier entry takes its remote id away, so the second entry
    writes a new row."""
    from superset.commands.exceptions import CommandInvalidError

    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": days_policy(60)})
    if existing:
        db.session.add(
            Dashboard(
                dashboard_title="Original",
                json_metadata=json.dumps({"remote_id": 1234}),
            )
        )
        db.session.commit()
    before = db.session.query(Dashboard).count()
    contents = {
        "first.json": legacy_file("First", 30, metadata_remote_id=first_remote_id),
        "second.json": legacy_file("Second", 90),
    }

    for adjust in (False, True):
        with pytest.raises(CommandInvalidError) as excinfo:
            v0.ImportDashboardsCommand(contents, adjust_time_ranges=adjust).run()
        assert not isinstance(excinfo.value, TimeRangeAdjustmentsRequiredError)
        assert excinfo.value.normalized_messages() == {
            "second.json": {
                "dashboards": {
                    0: {
                        "json_metadata": {
                            "time_range_limits.max_span.quantity": [
                                "Dashboard maximum span must be 60 days or less."
                            ]
                        }
                    }
                }
            }
        }
        assert db.session.query(Dashboard).count() == before
