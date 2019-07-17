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
"""Unit tests for Superset"""
import json
import unittest

import yaml

from superset import db
from superset.connectors.druid.models import DruidColumn, DruidDatasource, DruidMetric
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.utils.core import get_main_database
from .base_tests import SupersetTestCase

DBREF = "dict_import__export_test"
NAME_PREFIX = "dict_"
ID_PREFIX = 20000


class DictImportExportTests(SupersetTestCase):
    """Testing export import functionality for dashboards"""

    def __init__(self, *args, **kwargs):
        super(DictImportExportTests, self).__init__(*args, **kwargs)

    @classmethod
    def delete_imports(cls):
        # Imported data clean up
        session = db.session
        for table in session.query(SqlaTable):
            if DBREF in table.params_dict:
                session.delete(table)
        for datasource in session.query(DruidDatasource):
            if DBREF in datasource.params_dict:
                session.delete(datasource)
        session.commit()

    @classmethod
    def setUpClass(cls):
        cls.delete_imports()

    @classmethod
    def tearDownClass(cls):
        cls.delete_imports()

    def create_table(self, name, schema="", id=0, cols_names=[], metric_names=[]):
        database_name = "main"
        name = "{0}{1}".format(NAME_PREFIX, name)
        params = {DBREF: id, "database_name": database_name}

        dict_rep = {
            "database_id": get_main_database().id,
            "table_name": name,
            "schema": schema,
            "id": id,
            "params": json.dumps(params),
            "columns": [{"column_name": c} for c in cols_names],
            "metrics": [{"metric_name": c, "expression": ""} for c in metric_names],
        }

        table = SqlaTable(
            id=id, schema=schema, table_name=name, params=json.dumps(params)
        )
        for col_name in cols_names:
            table.columns.append(TableColumn(column_name=col_name))
        for metric_name in metric_names:
            table.metrics.append(SqlMetric(metric_name=metric_name, expression=""))
        return table, dict_rep

    def create_druid_datasource(self, name, id=0, cols_names=[], metric_names=[]):
        name = "{0}{1}".format(NAME_PREFIX, name)
        cluster_name = "druid_test"
        params = {DBREF: id, "database_name": cluster_name}
        dict_rep = {
            "cluster_name": cluster_name,
            "datasource_name": name,
            "id": id,
            "params": json.dumps(params),
            "columns": [{"column_name": c} for c in cols_names],
            "metrics": [{"metric_name": c, "json": "{}"} for c in metric_names],
        }

        datasource = DruidDatasource(
            id=id,
            datasource_name=name,
            cluster_name=cluster_name,
            params=json.dumps(params),
        )
        for col_name in cols_names:
            datasource.columns.append(DruidColumn(column_name=col_name))
        for metric_name in metric_names:
            datasource.metrics.append(DruidMetric(metric_name=metric_name))
        return datasource, dict_rep

    def get_datasource(self, datasource_id):
        return db.session.query(DruidDatasource).filter_by(id=datasource_id).first()

    def get_table_by_name(self, name):
        return db.session.query(SqlaTable).filter_by(table_name=name).first()

    def yaml_compare(self, obj_1, obj_2):
        obj_1_str = yaml.safe_dump(obj_1, default_flow_style=False)
        obj_2_str = yaml.safe_dump(obj_2, default_flow_style=False)
        self.assertEquals(obj_1_str, obj_2_str)

    def assert_table_equals(self, expected_ds, actual_ds):
        self.assertEquals(expected_ds.table_name, actual_ds.table_name)
        self.assertEquals(expected_ds.main_dttm_col, actual_ds.main_dttm_col)
        self.assertEquals(expected_ds.schema, actual_ds.schema)
        self.assertEquals(len(expected_ds.metrics), len(actual_ds.metrics))
        self.assertEquals(len(expected_ds.columns), len(actual_ds.columns))
        self.assertEquals(
            set([c.column_name for c in expected_ds.columns]),
            set([c.column_name for c in actual_ds.columns]),
        )
        self.assertEquals(
            set([m.metric_name for m in expected_ds.metrics]),
            set([m.metric_name for m in actual_ds.metrics]),
        )

    def assert_datasource_equals(self, expected_ds, actual_ds):
        self.assertEquals(expected_ds.datasource_name, actual_ds.datasource_name)
        self.assertEquals(expected_ds.main_dttm_col, actual_ds.main_dttm_col)
        self.assertEquals(len(expected_ds.metrics), len(actual_ds.metrics))
        self.assertEquals(len(expected_ds.columns), len(actual_ds.columns))
        self.assertEquals(
            set([c.column_name for c in expected_ds.columns]),
            set([c.column_name for c in actual_ds.columns]),
        )
        self.assertEquals(
            set([m.metric_name for m in expected_ds.metrics]),
            set([m.metric_name for m in actual_ds.metrics]),
        )

    def test_import_table_no_metadata(self):
        table, dict_table = self.create_table("pure_table", id=ID_PREFIX + 1)
        new_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        imported_id = new_table.id
        imported = self.get_table(imported_id)
        self.assert_table_equals(table, imported)
        self.yaml_compare(table.export_to_dict(), imported.export_to_dict())

    def test_import_table_1_col_1_met(self):
        table, dict_table = self.create_table(
            "table_1_col_1_met",
            id=ID_PREFIX + 2,
            cols_names=["col1"],
            metric_names=["metric1"],
        )
        imported_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        imported = self.get_table(imported_table.id)
        self.assert_table_equals(table, imported)
        self.assertEquals(
            {DBREF: ID_PREFIX + 2, "database_name": "main"}, json.loads(imported.params)
        )
        self.yaml_compare(table.export_to_dict(), imported.export_to_dict())

    def test_import_table_2_col_2_met(self):
        table, dict_table = self.create_table(
            "table_2_col_2_met",
            id=ID_PREFIX + 3,
            cols_names=["c1", "c2"],
            metric_names=["m1", "m2"],
        )
        imported_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        imported = self.get_table(imported_table.id)
        self.assert_table_equals(table, imported)
        self.yaml_compare(table.export_to_dict(), imported.export_to_dict())

    def test_import_table_override_append(self):
        table, dict_table = self.create_table(
            "table_override", id=ID_PREFIX + 3, cols_names=["col1"], metric_names=["m1"]
        )
        imported_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        table_over, dict_table_over = self.create_table(
            "table_override",
            id=ID_PREFIX + 3,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_over_table = SqlaTable.import_from_dict(db.session, dict_table_over)
        db.session.commit()

        imported_over = self.get_table(imported_over_table.id)
        self.assertEquals(imported_table.id, imported_over.id)
        expected_table, _ = self.create_table(
            "table_override",
            id=ID_PREFIX + 3,
            metric_names=["new_metric1", "m1"],
            cols_names=["col1", "new_col1", "col2", "col3"],
        )
        self.assert_table_equals(expected_table, imported_over)
        self.yaml_compare(
            expected_table.export_to_dict(), imported_over.export_to_dict()
        )

    def test_import_table_override_sync(self):
        table, dict_table = self.create_table(
            "table_override", id=ID_PREFIX + 3, cols_names=["col1"], metric_names=["m1"]
        )
        imported_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        table_over, dict_table_over = self.create_table(
            "table_override",
            id=ID_PREFIX + 3,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_over_table = SqlaTable.import_from_dict(
            session=db.session, dict_rep=dict_table_over, sync=["metrics", "columns"]
        )
        db.session.commit()

        imported_over = self.get_table(imported_over_table.id)
        self.assertEquals(imported_table.id, imported_over.id)
        expected_table, _ = self.create_table(
            "table_override",
            id=ID_PREFIX + 3,
            metric_names=["new_metric1"],
            cols_names=["new_col1", "col2", "col3"],
        )
        self.assert_table_equals(expected_table, imported_over)
        self.yaml_compare(
            expected_table.export_to_dict(), imported_over.export_to_dict()
        )

    def test_import_table_override_identical(self):
        table, dict_table = self.create_table(
            "copy_cat",
            id=ID_PREFIX + 4,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_table = SqlaTable.import_from_dict(db.session, dict_table)
        db.session.commit()
        copy_table, dict_copy_table = self.create_table(
            "copy_cat",
            id=ID_PREFIX + 4,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_copy_table = SqlaTable.import_from_dict(db.session, dict_copy_table)
        db.session.commit()
        self.assertEquals(imported_table.id, imported_copy_table.id)
        self.assert_table_equals(copy_table, self.get_table(imported_table.id))
        self.yaml_compare(
            imported_copy_table.export_to_dict(), imported_table.export_to_dict()
        )

    def test_import_druid_no_metadata(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "pure_druid", id=ID_PREFIX + 1
        )
        imported_cluster = DruidDatasource.import_from_dict(db.session, dict_datasource)
        db.session.commit()
        imported = self.get_datasource(imported_cluster.id)
        self.assert_datasource_equals(datasource, imported)

    def test_import_druid_1_col_1_met(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "druid_1_col_1_met",
            id=ID_PREFIX + 2,
            cols_names=["col1"],
            metric_names=["metric1"],
        )
        imported_cluster = DruidDatasource.import_from_dict(db.session, dict_datasource)
        db.session.commit()
        imported = self.get_datasource(imported_cluster.id)
        self.assert_datasource_equals(datasource, imported)
        self.assertEquals(
            {DBREF: ID_PREFIX + 2, "database_name": "druid_test"},
            json.loads(imported.params),
        )

    def test_import_druid_2_col_2_met(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "druid_2_col_2_met",
            id=ID_PREFIX + 3,
            cols_names=["c1", "c2"],
            metric_names=["m1", "m2"],
        )
        imported_cluster = DruidDatasource.import_from_dict(db.session, dict_datasource)
        db.session.commit()
        imported = self.get_datasource(imported_cluster.id)
        self.assert_datasource_equals(datasource, imported)

    def test_import_druid_override_append(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "druid_override", id=ID_PREFIX + 3, cols_names=["col1"], metric_names=["m1"]
        )
        imported_cluster = DruidDatasource.import_from_dict(db.session, dict_datasource)
        db.session.commit()
        table_over, table_over_dict = self.create_druid_datasource(
            "druid_override",
            id=ID_PREFIX + 3,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_over_cluster = DruidDatasource.import_from_dict(
            db.session, table_over_dict
        )
        db.session.commit()
        imported_over = self.get_datasource(imported_over_cluster.id)
        self.assertEquals(imported_cluster.id, imported_over.id)
        expected_datasource, _ = self.create_druid_datasource(
            "druid_override",
            id=ID_PREFIX + 3,
            metric_names=["new_metric1", "m1"],
            cols_names=["col1", "new_col1", "col2", "col3"],
        )
        self.assert_datasource_equals(expected_datasource, imported_over)

    def test_import_druid_override_sync(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "druid_override", id=ID_PREFIX + 3, cols_names=["col1"], metric_names=["m1"]
        )
        imported_cluster = DruidDatasource.import_from_dict(db.session, dict_datasource)
        db.session.commit()
        table_over, table_over_dict = self.create_druid_datasource(
            "druid_override",
            id=ID_PREFIX + 3,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_over_cluster = DruidDatasource.import_from_dict(
            session=db.session, dict_rep=table_over_dict, sync=["metrics", "columns"]
        )  # syncing metrics and columns
        db.session.commit()
        imported_over = self.get_datasource(imported_over_cluster.id)
        self.assertEquals(imported_cluster.id, imported_over.id)
        expected_datasource, _ = self.create_druid_datasource(
            "druid_override",
            id=ID_PREFIX + 3,
            metric_names=["new_metric1"],
            cols_names=["new_col1", "col2", "col3"],
        )
        self.assert_datasource_equals(expected_datasource, imported_over)

    def test_import_druid_override_identical(self):
        datasource, dict_datasource = self.create_druid_datasource(
            "copy_cat",
            id=ID_PREFIX + 4,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported = DruidDatasource.import_from_dict(
            session=db.session, dict_rep=dict_datasource
        )
        db.session.commit()
        copy_datasource, dict_cp_datasource = self.create_druid_datasource(
            "copy_cat",
            id=ID_PREFIX + 4,
            cols_names=["new_col1", "col2", "col3"],
            metric_names=["new_metric1"],
        )
        imported_copy = DruidDatasource.import_from_dict(db.session, dict_cp_datasource)
        db.session.commit()

        self.assertEquals(imported.id, imported_copy.id)
        self.assert_datasource_equals(copy_datasource, self.get_datasource(imported.id))


if __name__ == "__main__":
    unittest.main()
