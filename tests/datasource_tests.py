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
from copy import deepcopy

from superset.utils.core import get_or_create_db

from .base_tests import SupersetTestCase
from .fixtures.datasource import datasource_post


class TestDatasource(SupersetTestCase):
    def test_external_metadata(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        schema = tbl.schema or ""
        url = (
            f"/datasource/external_metadata/table/{tbl.id}/?"
            f"db_id={tbl.database.id}&"
            f"table_name={tbl.table_name}&"
            f"schema={schema}&"
        )
        resp = self.get_json_resp(url)
        col_names = {o.get("name") for o in resp}
        self.assertEqual(
            col_names, {"sum_boys", "num", "gender", "name", "ds", "state", "sum_girls"}
        )

    def compare_lists(self, l1, l2, key):
        l2_lookup = {o.get(key): o for o in l2}
        for obj1 in l1:
            obj2 = l2_lookup.get(obj1.get(key))
            for k in obj1:
                if k not in "id" and obj1.get(k):
                    self.assertEqual(obj1.get(k), obj2.get(k))

    def test_save(self):
        self.login(username="admin")
        tbl_id = self.get_table_by_name("birth_names").id
        datasource_post["id"] = tbl_id
        data = dict(data=json.dumps(datasource_post))
        resp = self.get_json_resp("/datasource/save/", data)
        for k in datasource_post:
            if k == "columns":
                self.compare_lists(datasource_post[k], resp[k], "column_name")
            elif k == "metrics":
                self.compare_lists(datasource_post[k], resp[k], "metric_name")
            elif k == "database":
                self.assertEqual(resp[k]["id"], datasource_post[k]["id"])
            else:
                self.assertEqual(resp[k], datasource_post[k])

    def save_datasource_from_dict(self, datasource_dict):
        data = dict(data=json.dumps(datasource_post))
        resp = self.get_json_resp("/datasource/save/", data)
        return resp

    def test_change_database(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        tbl_id = tbl.id
        db_id = tbl.database_id
        datasource_post["id"] = tbl_id

        new_db = self.create_fake_db()

        datasource_post["database"]["id"] = new_db.id
        resp = self.save_datasource_from_dict(datasource_post)
        self.assertEqual(resp["database"]["id"], new_db.id)

        datasource_post["database"]["id"] = db_id
        resp = self.save_datasource_from_dict(datasource_post)
        self.assertEqual(resp["database"]["id"], db_id)

        self.delete_fake_db()

    def test_save_duplicate_key(self):
        self.login(username="admin")
        tbl_id = self.get_table_by_name("birth_names").id
        datasource_post_copy = deepcopy(datasource_post)
        datasource_post_copy["id"] = tbl_id
        datasource_post_copy["columns"].extend(
            [
                {
                    "column_name": "<new column>",
                    "filterable": True,
                    "groupby": True,
                    "expression": "<enter SQL expression here>",
                    "id": "somerandomid",
                },
                {
                    "column_name": "<new column>",
                    "filterable": True,
                    "groupby": True,
                    "expression": "<enter SQL expression here>",
                    "id": "somerandomid2",
                },
            ]
        )
        data = dict(data=json.dumps(datasource_post_copy))
        resp = self.get_json_resp("/datasource/save/", data, raise_on_error=False)
        self.assertIn("Duplicate column name(s): <new column>", resp["error"])

    def test_get_datasource(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        url = f"/datasource/get/{tbl.type}/{tbl.id}/"
        resp = self.get_json_resp(url)
        self.assertEqual(resp.get("type"), "table")
        col_names = {o.get("column_name") for o in resp["columns"]}
        self.assertEqual(
            col_names,
            {
                "sum_boys",
                "num",
                "gender",
                "name",
                "ds",
                "state",
                "sum_girls",
                "num_california",
            },
        )

    def test_get_datasource_failed(self):
        self.login(username="admin")
        url = f"/datasource/get/druid/500000/"
        resp = self.get_json_resp(url)
        self.assertEqual(resp.get("error"), "This datasource does not exist")
