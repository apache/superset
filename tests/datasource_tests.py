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

from .base_tests import SupersetTestCase
from .fixtures.datasource import datasource_post


class DatasourceTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(DatasourceTests, self).__init__(*args, **kwargs)

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
        self.assertEquals(
            col_names, {"sum_boys", "num", "gender", "name", "ds", "state", "sum_girls"}
        )

    def compare_lists(self, l1, l2, key):
        l2_lookup = {o.get(key): o for o in l2}
        for obj1 in l1:
            obj2 = l2_lookup.get(obj1.get(key))
            for k in obj1:
                if k not in "id" and obj1.get(k):
                    self.assertEquals(obj1.get(k), obj2.get(k))

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
            else:
                self.assertEquals(resp[k], datasource_post[k])

    def test_get_datasource(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        url = f"/datasource/get/{tbl.type}/{tbl.id}/"
        resp = self.get_json_resp(url)
        self.assertEquals(resp.get("type"), "table")
        col_names = {o.get("column_name") for o in resp["columns"]}
        self.assertEquals(
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
        self.assertEquals(resp.get("error"), "This datasource does not exist")
