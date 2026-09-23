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
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.chart.importers.v1 import ImportChartsCommand
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils.core import override_user


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


@pytest.fixture
def chart_editor_without_dataset_access(
    chart_on_dataset: Slice,
) -> Generator[User, None, None]:
    """Log in a user who edits the chart but holds no grant on its dataset.

    The user has no role, so no ``all_datasource_access``, ``database_access``,
    ``datasource_access``, ``schema_access`` or ``catalog_access``, and is not
    an editor of the dataset, so ``DatasourceFilter`` hides the dataset from
    them in the trash as well. Editing the chart is what lets ``ChartFilter``
    hand them the chart.
    """
    user = User(
        first_name="chart",
        last_name="editor",
        username="chart_editor",
        email="chart_editor@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.flush()
    chart_on_dataset.editors = [
        Subject(label="chart_editor", type=SubjectType.USER, user_id=user.id)
    ]
    db.session.flush()

    with override_user(user):
        yield user


def _export(chart: Slice, export_related: bool = True) -> dict[str, str]:
    return {
        file_name: file_content()
        for file_name, file_content in ExportChartsCommand(
            [chart.id], export_related=export_related
        ).run()
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


@pytest.mark.usefixtures("chart_editor_without_dataset_access")
@pytest.mark.parametrize("export_related", [True, False])
def test_export_chart_does_not_leak_deleted_dataset_without_access(
    app_context: None,
    chart_on_dataset: Slice,
    export_related: bool,
) -> None:
    """Resolving a soft-deleted dataset must not widen dataset access.

    ``find_chart_dataset`` lifts only the soft-delete filter. A caller who can
    export the chart but cannot read its dataset gets the chart alone: no
    ``datasets/`` or ``databases/`` file and no ``dataset_uuid``, the same
    bundle the export produced for them before the dataset could be resolved
    out of the trash.
    """
    chart = chart_on_dataset
    dataset_id = chart.table.id

    DatasetDAO.delete([chart.table])
    db.session.flush()
    _next_request()

    # The row is still there, so only the missing access keeps it out.
    assert DatasetDAO.find_by_id(
        dataset_id, skip_base_filter=True, skip_visibility_filter=True
    )

    contents = _export(chart, export_related)

    chart_files = [name for name in contents if name.startswith("charts/")]
    assert len(chart_files) == 1
    assert not [
        name for name in contents if name.startswith(("datasets/", "databases/"))
    ]
    assert "dataset_uuid" not in yaml.safe_load(contents[chart_files[0]])


@pytest.mark.usefixtures("chart_editor_without_dataset_access")
def test_nested_dataset_export_keeps_access_filter_for_deleted_dataset(
    app_context: None,
    chart_on_dataset: Slice,
) -> None:
    """``include_deleted`` lifts the soft-delete filter and nothing else.

    The chart export passes it to the nested dataset export, so a caller who
    cannot read the dataset must still be refused there.
    """
    dataset_id = chart_on_dataset.table.id

    DatasetDAO.delete([chart_on_dataset.table])
    db.session.flush()
    _next_request()

    with pytest.raises(DatasetNotFoundError):
        list(ExportDatasetsCommand([dataset_id], include_deleted=True).run())
