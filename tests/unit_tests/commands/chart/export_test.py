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
"""Unit tests for ExportChartsCommand."""

from __future__ import annotations

from collections.abc import Generator

import pytest
import yaml
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.chart.importers.v1 import ImportChartsCommand
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.models.slice import Slice


@pytest.fixture
def chart_on_dataset(session: Session) -> Generator[Slice, None, None]:
    """A chart backed by a dataset, both alive."""
    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    dataset = SqlaTable(
        table_name="my_table",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()

    chart = Slice(
        slice_name="my_chart",
        viz_type="table",
        datasource_id=dataset.id,
        datasource_type="table",
        datasource_name="my_table",
        params="{}",
    )
    session.add(chart)
    session.flush()

    yield chart
    session.rollback()


@pytest.fixture
def permissive_security(mocker: MockerFixture) -> None:
    """Grant every read/write check the export and import paths consult."""
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)


def _export(chart: Slice) -> dict[str, str]:
    return {
        file_name: file_content()
        for file_name, file_content in ExportChartsCommand([chart.id]).run()
    }


def _next_request() -> None:
    """Drop everything loaded in this session.

    ``Slice.table`` is ``lazy="subquery"``, so a relationship loaded before the
    delete stays warm in the identity map and would mask the visibility filter.
    Export runs in its own request in a deployment; expiring models that.
    """
    db.session.expire_all()


@pytest.mark.usefixtures("permissive_security")
def test_export_chart_bundle_is_importable_when_dataset_is_soft_deleted(
    app_context: None,
    chart_on_dataset: Slice,
) -> None:
    """A chart whose dataset was deleted still exports a complete bundle.

    Deleting a dataset soft-deletes it, which hides it from ``Slice.table``
    while the chart itself survives. The export must still name the dataset,
    otherwise ``charts/*.yaml`` carries no ``dataset_uuid`` and the bundle is
    rejected on import with ``Missing data for required field``.
    """
    chart = chart_on_dataset
    dataset = chart.table
    dataset_uuid = str(dataset.uuid)

    DatasetDAO.delete([dataset])
    db.session.flush()
    _next_request()
    assert chart.table is None, "dataset should be hidden from the relationship"

    contents = _export(chart)

    chart_files = [name for name in contents if name.startswith("charts/")]
    dataset_files = [name for name in contents if name.startswith("datasets/")]
    assert len(chart_files) == 1
    assert len(dataset_files) == 1, "the dataset must travel with the chart"

    payload = yaml.safe_load(contents[chart_files[0]])
    assert payload["dataset_uuid"] == dataset_uuid
    assert yaml.safe_load(contents[dataset_files[0]])["uuid"] == dataset_uuid


@pytest.mark.usefixtures("permissive_security")
def test_export_import_round_trip_restores_chart_and_dataset(
    app_context: None,
    chart_on_dataset: Slice,
) -> None:
    """Export → delete → import restores both assets (issue #44309)."""
    chart = chart_on_dataset
    dataset = chart.table
    dataset_uuid = str(dataset.uuid)

    DatasetDAO.delete([dataset])
    db.session.flush()
    _next_request()

    contents = _export(chart)

    ImportChartsCommand(contents, overwrite=True).run()
    db.session.flush()

    restored = db.session.query(SqlaTable).filter_by(uuid=dataset.uuid).one()
    assert restored.deleted_at is None, "the dataset must come back out of the trash"
    assert str(restored.uuid) == dataset_uuid

    reimported = db.session.query(Slice).filter_by(uuid=chart.uuid).one()
    assert reimported.datasource_id == restored.id


@pytest.mark.usefixtures("permissive_security")
def test_export_chart_omits_dataset_uuid_when_dataset_is_gone(
    app_context: None,
    chart_on_dataset: Slice,
) -> None:
    """A dangling ``datasource_id`` still exports, without a dataset link.

    Hard-deleted datasets (``SOFT_DELETE`` off, or after the retention purge)
    leave no row to resolve, so the export has nothing to name. The chart file
    is still produced rather than the command raising.
    """
    chart = chart_on_dataset
    dataset = chart.table

    DatasetDAO.hard_delete([dataset])
    db.session.flush()
    _next_request()

    contents = _export(chart)

    chart_files = [name for name in contents if name.startswith("charts/")]
    assert len(chart_files) == 1
    assert not [name for name in contents if name.startswith("datasets/")]
    assert "dataset_uuid" not in yaml.safe_load(contents[chart_files[0]])
