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
# isort:skip_file

import unittest
from typing import Any, Dict

from tests.base_tests import SupersetTestCase
from tests.test_app import app

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.utils.core import get_or_create_db

FULL_DTTM_DEFAULTS_EXAMPLE = {
    "main_dttm_col": "id",
    "dttm_columns": {
        "dttm": {
            "python_date_format": "epoch_s",
            "expression": "CAST(dttm as INTEGER)",
        },
        "id": {"python_date_format": "epoch_ms"},
        "month": {
            "python_date_format": "%Y-%m-%d",
            "expression": "CASE WHEN length(month) = 7 THEN month || '-01' ELSE month END",
        },
    },
}


def apply_dttm_defaults(table: SqlaTable, dttm_defaults: Dict[str, Any]):
    """Applies dttm defaults to the table, mutates in place."""
    for dbcol in table.columns:
        # Set is_dttm is column is listed in dttm_columns.
        if dbcol.column_name in dttm_defaults.get("dttm_columns", {}):
            dbcol.is_dttm = True

        # Skip non dttm columns.
        if dbcol.column_name not in dttm_defaults.get("dttm_columns", {}):
            continue

        # Set table main_dttm_col.
        if dbcol.column_name == dttm_defaults.get("main_dttm_col"):
            table.main_dttm_col = dbcol.column_name

        # Apply defaults if empty.
        dttm_column_defaults = dttm_defaults.get("dttm_columns", {}).get(
            dbcol.column_name, {}
        )
        dbcol.is_dttm = True
        if (
            not dbcol.python_date_format
            and "python_date_format" in dttm_column_defaults
        ):
            dbcol.python_date_format = dttm_column_defaults["python_date_format"]
        if not dbcol.expression and "expression" in dttm_column_defaults:
            dbcol.expression = dttm_column_defaults["expression"]


class TestConfig(SupersetTestCase):
    def setUp(self) -> None:
        self.login(username="admin")
        self._test_db_id = get_or_create_db(
            "column_test_db", app.config["SQLALCHEMY_DATABASE_URI"]
        ).id
        self._old_sqla_table_mutator = app.config["SQLA_TABLE_MUTATOR"]

    def createTable(self, dttm_defaults):
        app.config["SQLA_TABLE_MUTATOR"] = lambda t: apply_dttm_defaults(
            t, dttm_defaults
        )
        resp = self.client.post(
            "/tablemodelview/add",
            data=dict(database=self._test_db_id, table_name="logs"),
            follow_redirects=True,
        )
        self.assertEqual(resp.status_code, 200)
        self._logs_table = (
            db.session.query(SqlaTable).filter_by(table_name="logs").one()
        )

    def tearDown(self):
        app.config["SQLA_TABLE_MUTATOR"] = self._old_sqla_table_mutator
        if hasattr(self, "_logs_table"):
            db.session.delete(self._logs_table)
            db.session.delete(self._logs_table.database)
            db.session.commit()

    def test_main_dttm_col(self):
        # Make sure that dttm column is set properly.
        self.createTable({"main_dttm_col": "id", "dttm_columns": {"id": {}}})
        self.assertEqual(self._logs_table.main_dttm_col, "id")

    def test_main_dttm_col_nonexistent(self):
        self.createTable({"main_dttm_col": "nonexistent"})
        # Column doesn't exist, falls back to dttm.
        self.assertEqual(self._logs_table.main_dttm_col, "dttm")

    def test_main_dttm_col_nondttm(self):
        self.createTable({"main_dttm_col": "duration_ms"})
        # duration_ms is not dttm column, falls back to dttm.
        self.assertEqual(self._logs_table.main_dttm_col, "dttm")

    def test_python_date_format_by_column_name(self):
        table_defaults = {
            "dttm_columns": {
                "id": {"python_date_format": "epoch_ms"},
                "dttm": {"python_date_format": "epoch_s"},
                "duration_ms": {"python_date_format": "invalid"},
            }
        }
        self.createTable(table_defaults)
        id_col = [c for c in self._logs_table.columns if c.column_name == "id"][0]
        self.assertTrue(id_col.is_dttm)
        self.assertEqual(id_col.python_date_format, "epoch_ms")
        dttm_col = [c for c in self._logs_table.columns if c.column_name == "dttm"][0]
        self.assertTrue(dttm_col.is_dttm)
        self.assertEqual(dttm_col.python_date_format, "epoch_s")
        dms_col = [
            c for c in self._logs_table.columns if c.column_name == "duration_ms"
        ][0]
        self.assertTrue(dms_col.is_dttm)
        self.assertEqual(dms_col.python_date_format, "invalid")

    def test_expression_by_column_name(self):
        table_defaults = {
            "dttm_columns": {
                "dttm": {"expression": "CAST(dttm as INTEGER)"},
                "duration_ms": {"expression": "CAST(duration_ms as DOUBLE)"},
            }
        }
        self.createTable(table_defaults)
        dttm_col = [c for c in self._logs_table.columns if c.column_name == "dttm"][0]
        self.assertTrue(dttm_col.is_dttm)
        self.assertEqual(dttm_col.expression, "CAST(dttm as INTEGER)")
        dms_col = [
            c for c in self._logs_table.columns if c.column_name == "duration_ms"
        ][0]
        self.assertEqual(dms_col.expression, "CAST(duration_ms as DOUBLE)")
        self.assertTrue(dms_col.is_dttm)

    def test_full_setting(self):
        self.createTable(FULL_DTTM_DEFAULTS_EXAMPLE)

        self.assertEqual(self._logs_table.main_dttm_col, "id")

        id_col = [c for c in self._logs_table.columns if c.column_name == "id"][0]
        self.assertTrue(id_col.is_dttm)
        self.assertEqual(id_col.python_date_format, "epoch_ms")
        self.assertIsNone(id_col.expression)

        dttm_col = [c for c in self._logs_table.columns if c.column_name == "dttm"][0]
        self.assertTrue(dttm_col.is_dttm)
        self.assertEqual(dttm_col.python_date_format, "epoch_s")
        self.assertEqual(dttm_col.expression, "CAST(dttm as INTEGER)")


if __name__ == "__main__":
    unittest.main()
