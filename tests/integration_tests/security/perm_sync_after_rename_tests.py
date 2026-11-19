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
"""Permission strings of charts after their database or dataset changes."""

import gc
import os
import sqlite3
import tempfile
from typing import Any
from uuid import uuid4

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


def _query_context(dataset_id: int) -> str:
    return json.dumps(
        {
            "datasource": {"id": dataset_id, "type": "table"},
            "force": False,
            "queries": [
                {
                    "filters": [],
                    "extras": {"having": "", "where": ""},
                    "columns": ["a"],
                    "metrics": [],
                    "orderby": [],
                    "row_limit": 10,
                }
            ],
            "result_format": "json",
            "result_type": "full",
        }
    )


class TestDatabaseRenamePermissions(SupersetTestCase):
    def setUp(self) -> None:
        super().setUp()
        suffix = uuid4().hex[:8]
        self.old_name = f"rename_perm_old_{suffix}"
        self.new_name = f"rename_perm_new_{suffix}"
        self.role_name = f"rename_perm_viewer_{suffix}"
        self.username = f"rename_perm_viewer_{suffix}"

        fd, self.data_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        with sqlite3.connect(self.data_path) as conn:
            conn.executescript(
                "CREATE TABLE t1 (a INTEGER); INSERT INTO t1 VALUES (1);"
                "CREATE TABLE t2 (a INTEGER); INSERT INTO t2 VALUES (1);"
            )

        self.database = Database(
            database_name=self.old_name,
            sqlalchemy_uri=f"sqlite:///{self.data_path}",
        )
        db.session.add(self.database)
        db.session.flush()

        # One dataset with a schema and one without.
        self.datasets = [
            SqlaTable(
                table_name=table_name,
                schema=schema,
                database=self.database,
                columns=[TableColumn(column_name="a", type="INTEGER")],
            )
            for table_name, schema in (("t1", "main"), ("t2", None))
        ]
        db.session.add_all(self.datasets)
        db.session.flush()

        self.charts = [
            Slice(
                slice_name=f"rename_perm_chart_{dataset.schema}_{suffix}",
                datasource_id=dataset.id,
                datasource_type=DatasourceType.TABLE,
                viz_type="table",
                params=json.dumps({}),
                query_context=_query_context(dataset.id),
            )
            for dataset in self.datasets
        ]
        db.session.add_all(self.charts)
        db.session.commit()

        # A viewer whose only data access is the per-dataset grant.
        security_manager.copy_role("Gamma", self.role_name, merge=False)
        role = security_manager.find_role(self.role_name)
        for dataset in self.datasets:
            security_manager.add_permission_role(
                role,
                security_manager.find_permission_view_menu(
                    "datasource_access", dataset.perm
                ),
            )
        db.session.commit()
        self.create_user_with_roles(self.username, [self.role_name])

        self.database_id = self.database.id
        self.dataset_ids = [dataset.id for dataset in self.datasets]
        self.chart_ids = [chart.id for chart in self.charts]
        # Start the request from a clean session, like a real API call: no
        # instance loaded by the setup may linger in the identity map.
        del self.database, self.datasets, self.charts
        db.session.close()
        gc.collect()

    def tearDown(self) -> None:
        db.session.rollback()
        for chart_id in self.chart_ids:
            db.session.query(Slice).filter_by(id=chart_id).delete()
        db.session.commit()
        if user := security_manager.find_user(self.username):
            db.session.delete(user)
        if role := security_manager.find_role(self.role_name):
            db.session.delete(role)
        db.session.commit()
        for dataset_id in self.dataset_ids:
            if dataset := db.session.get(SqlaTable, dataset_id):
                db.session.delete(dataset)
        db.session.commit()
        if database := db.session.get(Database, self.database_id):
            db.session.delete(database)
        db.session.commit()
        os.unlink(self.data_path)
        super().tearDown()

    def _rename_database_and_assert_access(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            f"/api/v1/database/{self.database_id}",
            json={"database_name": self.new_name},
        )
        assert rv.status_code == 200, rv.data
        self.logout()

        db.session.expire_all()
        for chart_id, dataset_id in zip(self.chart_ids, self.dataset_ids, strict=True):
            dataset = db.session.get(SqlaTable, dataset_id)
            chart = db.session.get(Slice, chart_id)
            expected_perm = f"[{self.new_name}].[{dataset.table_name}](id:{dataset_id})"
            expected_schema_perm = (
                f"[{self.new_name}].[{dataset.schema}]" if dataset.schema else None
            )
            assert dataset.perm == expected_perm
            assert dataset.schema_perm == expected_schema_perm
            assert chart.perm == expected_perm, dataset.schema
            assert chart.schema_perm == expected_schema_perm, dataset.schema

        self.login(self.username)
        for chart_id in self.chart_ids:
            rv = self.client.get(f"/api/v1/chart/{chart_id}/data/")
            assert rv.status_code == 200, (chart_id, rv.data)

    def test_rename_database_keeps_chart_perms_in_sync(self) -> None:
        """
        Renaming a database through the API rewrites ``perm`` and
        ``schema_perm`` of every chart of its datasets, with and without a
        schema, so a viewer with the dataset grant keeps chart data access.
        """
        self._rename_database_and_assert_access()

    def test_rename_database_with_loaded_datasets_keeps_chart_perms_in_sync(
        self,
    ) -> None:
        """
        The rename also holds when the datasets are already loaded in the
        session, as in a long-lived app context: the rename rewrites their
        perm through the connection, and the chart schema perm sync must not
        copy the previous perm back from the loaded instances.
        """
        loaded = [db.session.get(SqlaTable, id_) for id_ in self.dataset_ids]
        assert all(dataset.perm for dataset in loaded)

        self._rename_database_and_assert_access()


class TestDatasetChangePermissions(SupersetTestCase):
    """
    A dataset change rewrites the dataset's perm strings through the
    connection. A chart of that dataset written later in the same transaction
    copies its perm strings from the dataset instance, so they must match.
    """

    def setUp(self) -> None:
        super().setUp()
        suffix = uuid4().hex[:8]
        self.databases = [
            Database(
                database_name=f"perm_sync_{name}_{suffix}", sqlalchemy_uri="sqlite://"
            )
            for name in ("a", "b")
        ]
        db.session.add_all(self.databases)
        db.session.flush()
        self.dataset = SqlaTable(
            table_name=f"perm_sync_{suffix}",
            schema="s1",
            database=self.databases[0],
        )
        db.session.add(self.dataset)
        db.session.flush()
        self.chart = Slice(
            slice_name=f"perm_sync_{suffix}",
            datasource_id=self.dataset.id,
            datasource_type=DatasourceType.TABLE,
            viz_type="table",
            params=json.dumps({}),
        )
        db.session.add(self.chart)
        db.session.commit()

    def tearDown(self) -> None:
        db.session.rollback()
        db.session.delete(self.chart)
        db.session.delete(self.dataset)
        for database in self.databases:
            db.session.delete(database)
        db.session.commit()
        super().tearDown()

    def _change_dataset_then_write_chart(self, **changes: Any) -> None:
        for key, value in changes.items():
            setattr(self.dataset, key, value)
        db.session.flush()
        self.chart.slice_name = f"{self.chart.slice_name} (edited)"
        db.session.commit()

        db.session.expire_all()
        assert self.dataset.perm == security_manager.get_dataset_perm(
            self.dataset.id,
            self.dataset.table_name,
            self.dataset.database.database_name,
        )
        assert self.dataset.schema_perm == security_manager.get_schema_perm(
            self.dataset.database.database_name, None, self.dataset.schema
        )
        assert self.chart.perm == self.dataset.perm
        assert self.chart.schema_perm == self.dataset.schema_perm

    def test_table_rename_then_chart_write(self) -> None:
        self._change_dataset_then_write_chart(
            table_name=f"{self.dataset.table_name}_renamed"
        )

    def test_schema_change_then_chart_write(self) -> None:
        self._change_dataset_then_write_chart(schema="s2")

    def test_database_change_then_chart_write(self) -> None:
        self._change_dataset_then_write_chart(database=self.databases[1])
