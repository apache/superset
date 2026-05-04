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

import copy

import yaml
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import select

from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    charts_config_2,
    dashboards_config_1,
    dashboards_config_2,
    databases_config,
    datasets_config,
)


def test_import_new_assets(mocker: MockerFixture, session: Session) -> None:
    """
    Test that all new assets are imported correctly.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    expected_number_of_dashboards = len(dashboards_config_1)
    expected_number_of_charts = len(charts_config_1)

    ImportAssetsCommand._import(configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards


def test_import_adds_dashboard_charts(mocker: MockerFixture, session: Session) -> None:
    """
    Test that existing dashboards are updated with new charts.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    base_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    new_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    expected_number_of_dashboards = len(dashboards_config_1)
    expected_number_of_charts = len(charts_config_1)

    ImportAssetsCommand._import(base_configs)
    ImportAssetsCommand._import(new_configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards


def test_import_assets_imports_tags(mocker: MockerFixture, session: Session) -> None:
    """
    Test that tags on charts and dashboards are imported when importing assets
    via ``ImportAssetsCommand`` (the code path used by the CLI ``sync native``
    command). Previously tags were silently dropped for the CLI path.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tags.models import Tag, TaggedObject

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(feature_flag_manager, "is_feature_enabled", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

    charts_with_tags = copy.deepcopy(charts_config_1)
    for chart_config in charts_with_tags.values():
        chart_config["tags"] = ["chart_tag"]

    dashboards_with_tags = copy.deepcopy(dashboards_config_1)
    for dashboard_config in dashboards_with_tags.values():
        dashboard_config["tags"] = ["dashboard_tag"]

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **charts_with_tags,
        **dashboards_with_tags,
    }
    contents = {
        "tags.yaml": yaml.dump(
            {
                "tags": [
                    {"tag_name": "chart_tag", "description": "Tag for charts"},
                    {
                        "tag_name": "dashboard_tag",
                        "description": "Tag for dashboards",
                    },
                ]
            }
        )
    }

    ImportAssetsCommand._import(configs, contents=contents)

    chart_uuids = {config["uuid"] for config in charts_with_tags.values()}
    imported_charts = db.session.query(Slice).filter(Slice.uuid.in_(chart_uuids)).all()
    assert len(imported_charts) == len(chart_uuids)
    for chart in imported_charts:
        assocs = (
            db.session.query(TaggedObject)
            .filter_by(object_id=chart.id, object_type="chart")
            .all()
        )
        assert len(assocs) == 1
        assert assocs[0].tag.name == "chart_tag"

    dashboard_uuids = {config["uuid"] for config in dashboards_with_tags.values()}
    imported_dashboards = (
        db.session.query(Dashboard).filter(Dashboard.uuid.in_(dashboard_uuids)).all()
    )
    assert len(imported_dashboards) == len(dashboard_uuids)
    for dashboard in imported_dashboards:
        assocs = (
            db.session.query(TaggedObject)
            .filter_by(object_id=dashboard.id, object_type="dashboard")
            .all()
        )
        assert len(assocs) == 1
        assert assocs[0].tag.name == "dashboard_tag"


def test_import_assets_skips_tags_when_feature_disabled(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that tag import is skipped when the ``TAGGING_SYSTEM`` feature flag
    is disabled, even when the configs include tags.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.extensions import feature_flag_manager
    from superset.models.slice import Slice
    from superset.tags.models import Tag, TaggedObject

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(feature_flag_manager, "is_feature_enabled", return_value=False)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

    charts_with_tags = copy.deepcopy(charts_config_1)
    for chart_config in charts_with_tags.values():
        chart_config["tags"] = ["chart_tag"]

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **charts_with_tags,
        **copy.deepcopy(dashboards_config_1),
    }

    ImportAssetsCommand._import(configs)

    assert db.session.query(TaggedObject).count() == 0


def test_import_removes_dashboard_charts(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that existing dashboards are updated without old charts.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    base_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    new_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    expected_number_of_dashboards = len(dashboards_config_2)
    expected_number_of_charts = len(charts_config_2)

    ImportAssetsCommand._import(base_configs)
    ImportAssetsCommand._import(new_configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards
