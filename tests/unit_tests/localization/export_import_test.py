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
Tests for translations field in export/import operations.

Verifies that:
- Dashboard/Chart export includes translations JSON field
- Dashboard/Chart import restores translations correctly
- Backward compatibility: import without translations works
- Roundtrip: export → import preserves translations
"""

import copy
from collections.abc import Generator
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.connectors.sqla.models import Database, SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json

DASHBOARD_TRANSLATIONS: dict[str, dict[str, str]] = {
    "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
    "description": {"de": "Monatlicher Bericht", "fr": "Rapport mensuel"},
}

CHART_TRANSLATIONS: dict[str, dict[str, str]] = {
    "slice_name": {"de": "Umsatz nach Region", "fr": "Revenus par région"},
    "description": {"de": "Quartalsübersicht", "fr": "Aperçu trimestriel"},
}

DASHBOARD_CONFIG_WITH_TRANSLATIONS: dict[str, Any] = {
    "dashboard_title": "Sales Dashboard",
    "description": "Monthly sales report",
    "css": "",
    "slug": None,
    "uuid": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
    "translations": DASHBOARD_TRANSLATIONS,
    "position": {},
    "metadata": {},
    "version": "1.0.0",
}

DASHBOARD_CONFIG_WITHOUT_TRANSLATIONS: dict[str, Any] = {
    "dashboard_title": "Legacy Dashboard",
    "description": "Old format without translations",
    "css": "",
    "slug": None,
    "uuid": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
    "position": {},
    "metadata": {},
    "version": "1.0.0",
}

CHART_CONFIG_WITH_TRANSLATIONS: dict[str, Any] = {
    "slice_name": "Revenue by Region",
    "description": "Quarterly breakdown",
    "viz_type": "pie",
    "params": {"metric": "sum__amount"},
    "query_context": "{}",
    "cache_timeout": None,
    "uuid": "f0e1d2c3-b4a5-9687-7654-321fedcba098",
    "translations": CHART_TRANSLATIONS,
    "version": "1.0.0",
}

CHART_CONFIG_WITHOUT_TRANSLATIONS: dict[str, Any] = {
    "slice_name": "Legacy Chart",
    "description": "Old format",
    "viz_type": "pie",
    "params": {"metric": "count"},
    "query_context": "{}",
    "cache_timeout": None,
    "uuid": "12345678-abcd-ef01-2345-6789abcdef01",
    "version": "1.0.0",
}


@pytest.fixture
def session_with_dashboard_schema(session: Session) -> Generator[Session, None, None]:
    """Create database schema for Dashboard model."""
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)
    yield session
    session.rollback()


@pytest.fixture
def session_with_chart_schema(session: Session) -> Generator[Session, None, None]:
    """Create database schema for Slice model with required dependencies."""
    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)

    dataset = SqlaTable(
        table_name="test_dataset",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="test_db", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()

    yield session
    session.rollback()


def test_dashboard_import_with_translations(
    mocker: MockerFixture,
    session_with_dashboard_schema: Session,
) -> None:
    """
    Import dashboard with translations field preserves translations JSON.

    Given config with translations={"dashboard_title": {"de": "...", "fr": "..."}},
    when import_dashboard() is called,
    then dashboard.translations equals the input translations dict.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(DASHBOARD_CONFIG_WITH_TRANSLATIONS)
    dashboard = import_dashboard(config)

    assert dashboard.translations == DASHBOARD_TRANSLATIONS
    assert dashboard.dashboard_title == "Sales Dashboard"


def test_dashboard_import_without_translations_backward_compatible(
    mocker: MockerFixture,
    session_with_dashboard_schema: Session,
) -> None:
    """
    Import dashboard without translations field works (backward compatibility).

    Given config without 'translations' key (pre-localization format),
    when import_dashboard() is called,
    then dashboard.translations is None and no error occurs.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(DASHBOARD_CONFIG_WITHOUT_TRANSLATIONS)
    dashboard = import_dashboard(config)

    assert dashboard.translations is None
    assert dashboard.dashboard_title == "Legacy Dashboard"


def test_dashboard_export_includes_translations(
    session_with_dashboard_schema: Session,
) -> None:
    """
    Dashboard.export_to_dict() includes translations field.

    Given a Dashboard with translations set,
    when export_to_dict() is called,
    then the result contains 'translations' key with correct value.
    """
    dashboard = Dashboard(
        dashboard_title="Test Dashboard",
        translations=DASHBOARD_TRANSLATIONS,
    )
    session_with_dashboard_schema.add(dashboard)
    session_with_dashboard_schema.flush()

    exported = dashboard.export_to_dict(recursive=False, export_uuids=True)

    assert "translations" in exported
    assert exported["translations"] == DASHBOARD_TRANSLATIONS


def test_dashboard_export_without_translations_omits_field(
    session_with_dashboard_schema: Session,
) -> None:
    """
    Dashboard.export_to_dict() omits translations when None.

    Given a Dashboard with translations=None,
    when export_to_dict(include_defaults=False) is called,
    then the result does not contain 'translations' key.
    """
    dashboard = Dashboard(
        dashboard_title="No Translations Dashboard",
        translations=None,
    )
    session_with_dashboard_schema.add(dashboard)
    session_with_dashboard_schema.flush()

    exported = dashboard.export_to_dict(
        recursive=False,
        export_uuids=True,
        include_defaults=False,
    )

    assert "translations" not in exported


def test_chart_import_with_translations(
    mocker: MockerFixture,
    session_with_chart_schema: Session,
) -> None:
    """
    Import chart with translations field preserves translations JSON.

    Given config with translations={"slice_name": {"de": "...", "fr": "..."}},
    when import_chart() is called,
    then chart.translations equals the input translations dict.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(CHART_CONFIG_WITH_TRANSLATIONS)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(config)

    assert chart.translations == CHART_TRANSLATIONS
    assert chart.slice_name == "Revenue by Region"


def test_chart_import_without_translations_backward_compatible(
    mocker: MockerFixture,
    session_with_chart_schema: Session,
) -> None:
    """
    Import chart without translations field works (backward compatibility).

    Given config without 'translations' key (pre-localization format),
    when import_chart() is called,
    then chart.translations is None and no error occurs.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(CHART_CONFIG_WITHOUT_TRANSLATIONS)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(config)

    assert chart.translations is None
    assert chart.slice_name == "Legacy Chart"


def test_chart_export_includes_translations(
    session_with_chart_schema: Session,
) -> None:
    """
    Slice.export_to_dict() includes translations field.

    Given a Slice with translations set,
    when export_to_dict() is called,
    then the result contains 'translations' key with correct value.
    """
    chart = Slice(
        slice_name="Test Chart",
        viz_type="pie",
        datasource_type="table",
        datasource_id=1,
        translations=CHART_TRANSLATIONS,
    )
    session_with_chart_schema.add(chart)
    session_with_chart_schema.flush()

    exported = chart.export_to_dict(recursive=False, export_uuids=True)

    assert "translations" in exported
    assert exported["translations"] == CHART_TRANSLATIONS


def test_chart_export_without_translations_omits_field(
    session_with_chart_schema: Session,
) -> None:
    """
    Slice.export_to_dict() omits translations when None.

    Given a Slice with translations=None,
    when export_to_dict(include_defaults=False) is called,
    then the result does not contain 'translations' key.
    """
    chart = Slice(
        slice_name="No Translations Chart",
        viz_type="pie",
        datasource_type="table",
        datasource_id=1,
        translations=None,
    )
    session_with_chart_schema.add(chart)
    session_with_chart_schema.flush()

    exported = chart.export_to_dict(
        recursive=False,
        export_uuids=True,
        include_defaults=False,
    )

    assert "translations" not in exported


def test_dashboard_roundtrip_preserves_translations(
    mocker: MockerFixture,
    session_with_dashboard_schema: Session,
) -> None:
    """
    Export → Import roundtrip preserves translations exactly.

    Given a Dashboard with translations,
    when exported and then imported,
    then translations match exactly.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    original = Dashboard(
        dashboard_title="Roundtrip Test",
        translations=DASHBOARD_TRANSLATIONS,
    )
    session_with_dashboard_schema.add(original)
    session_with_dashboard_schema.flush()

    exported = original.export_to_dict(recursive=False, export_uuids=True)

    session_with_dashboard_schema.delete(original)
    session_with_dashboard_schema.flush()

    imported = import_dashboard(exported)

    assert imported.translations == DASHBOARD_TRANSLATIONS


def test_chart_roundtrip_preserves_translations(
    mocker: MockerFixture,
    session_with_chart_schema: Session,
) -> None:
    """
    Export → Import roundtrip preserves translations exactly.

    Given a Slice with translations,
    when exported and then imported,
    then translations match exactly.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    original = Slice(
        slice_name="Roundtrip Chart",
        viz_type="pie",
        datasource_type="table",
        datasource_id=1,
        params='{"metric": "count"}',
        translations=CHART_TRANSLATIONS,
    )
    session_with_chart_schema.add(original)
    session_with_chart_schema.flush()

    exported = original.export_to_dict(recursive=False, export_uuids=True)
    exported["datasource_id"] = 1
    exported["datasource_type"] = "table"
    # import_chart expects params as dict, export_to_dict returns string
    if isinstance(exported.get("params"), str):
        exported["params"] = json.loads(exported["params"])

    session_with_chart_schema.delete(original)
    session_with_chart_schema.flush()

    imported = import_chart(exported)

    assert imported.translations == CHART_TRANSLATIONS
