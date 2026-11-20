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
# pylint: disable=import-outside-toplevel
"""Permission strings of datasets and charts after an import renames a database."""

import copy
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    databases_config,
    datasets_config,
)

DATABASE_FILE = "databases/examples.yaml"
RENAMED_DATABASE_NAME = "examples_renamed"


def _renamed(configs: dict[str, Any]) -> dict[str, Any]:
    configs = copy.deepcopy(configs)
    configs[DATABASE_FILE]["database_name"] = RENAMED_DATABASE_NAME
    return configs


@pytest.mark.parametrize("bundle_has_assets", [True, False])
@pytest.mark.parametrize("assets_loaded", [True, False])
def test_import_renamed_database_resyncs_schema_perms(
    mocker: MockerFixture,
    session: Session,
    bundle_has_assets: bool,
    assets_loaded: bool,
) -> None:
    """
    An import that renames an existing database leaves no dataset or chart with
    the previous database name in its permission strings, whether the bundle
    carries the datasets and charts or only the database, and whether they are
    already loaded in the session. A grant on the schema moves to the new name.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    initial = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
    }
    ImportAssetsCommand._import(initial)
    db.session.commit()

    datasets = db.session.query(SqlaTable).all()
    charts = db.session.query(Slice).all()
    assert datasets
    assert charts
    assert all(d.schema_perm == "[examples].[main]" for d in datasets)
    assert all(c.schema_perm == "[examples].[main]" for c in charts)
    schema_pvm = security_manager.find_permission_view_menu(
        "schema_access", "[examples].[main]"
    )
    assert schema_pvm
    pvm_id = schema_pvm.id
    if not assets_loaded:
        db.session.expire_all()

    if bundle_has_assets:
        renamed = {
            **_renamed(databases_config),
            **copy.deepcopy(datasets_config),
            **copy.deepcopy(charts_config_1),
        }
    else:
        renamed = _renamed(databases_config)
    ImportAssetsCommand._import(renamed)
    db.session.commit()
    db.session.expire_all()

    renamed_pvm = security_manager.find_permission_view_menu(
        "schema_access", f"[{RENAMED_DATABASE_NAME}].[main]"
    )
    assert renamed_pvm
    assert renamed_pvm.id == pvm_id
    assert not security_manager.find_permission_view_menu(
        "schema_access", "[examples].[main]"
    )

    database = db.session.query(Database).one()
    assert database.database_name == RENAMED_DATABASE_NAME
    for dataset in db.session.query(SqlaTable).all():
        assert dataset.perm.startswith(f"[{RENAMED_DATABASE_NAME}]."), dataset.perm
        assert dataset.schema_perm == f"[{RENAMED_DATABASE_NAME}].[main]"
    for chart in db.session.query(Slice).all():
        assert chart.perm.startswith(f"[{RENAMED_DATABASE_NAME}]."), chart.perm
        assert chart.schema_perm == f"[{RENAMED_DATABASE_NAME}].[main]"


def test_import_renamed_database_resyncs_catalog_perms(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The catalog permission follows the rename too, for datasets and charts under a
    catalog, including a soft-deleted dataset that may be restored later.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.helpers import skip_visibility_filter
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    config = copy.deepcopy(databases_config[DATABASE_FILE])
    database = import_database(config)
    dataset = SqlaTable(
        table_name="t1", catalog="cat", schema="main", database=database
    )
    db.session.add(dataset)
    db.session.flush()
    chart = Slice(
        slice_name="c1",
        datasource_id=dataset.id,
        datasource_type="table",
        viz_type="table",
    )
    db.session.add(chart)
    db.session.commit()
    assert dataset.catalog_perm == "[examples].[cat]"
    assert chart.schema_perm == "[examples].[cat].[main]"
    dataset.soft_delete()
    db.session.commit()

    renamed = copy.deepcopy(databases_config[DATABASE_FILE])
    renamed["database_name"] = RENAMED_DATABASE_NAME
    import_database(renamed, overwrite=True)
    db.session.commit()
    db.session.expire_all()

    assert db.session.query(Database).one().database_name == RENAMED_DATABASE_NAME
    with skip_visibility_filter(db.session, SqlaTable):
        dataset = db.session.query(SqlaTable).one()
    chart = db.session.query(Slice).one()
    for target in (dataset, chart):
        assert target.catalog_perm == f"[{RENAMED_DATABASE_NAME}].[cat]"
        assert target.schema_perm == f"[{RENAMED_DATABASE_NAME}].[cat].[main]"
    assert security_manager.find_permission_view_menu(
        "catalog_access", f"[{RENAMED_DATABASE_NAME}].[cat]"
    )
    assert not security_manager.find_permission_view_menu(
        "catalog_access", "[examples].[cat]"
    )
