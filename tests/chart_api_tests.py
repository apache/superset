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
from typing import List

import prison
from flask_appbuilder.security.sqla import models as ab_models

from superset import db, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.slice import Slice

from .base_tests import SupersetTestCase


class ChartApiTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(ChartApiTests, self).__init__(*args, **kwargs)

    def insert_chart(
        self,
        slice_name: str,
        owners: List[int],
        datasource_id: int,
        datasource_type: str = "table",
        description: str = "",
        viz_type: str = "",
        params: str = "",
        cache_timeout: int = 30,
    ) -> Slice:
        obj_owners = list()
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        slice = Slice(
            slice_name=slice_name,
            datasource_id=datasource.id,
            datasource_name=datasource.name,
            datasource_type=datasource.type,
            owners=obj_owners,
            description=description,
            viz_type=viz_type,
            params=params,
            cache_timeout=cache_timeout,
        )
        db.session.add(slice)
        db.session.commit()
        return slice

    def test_delete_chart(self):
        """
            Chart API: Test delete
        """
        admin_id = self.get_user("admin").id
        chart_id = self.insert_chart("name", [admin_id], 1).id
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)

    def test_delete_not_found_chart(self):
        """
            Chart API: Test not found delete
        """
        self.login(username="admin")
        dashboard_id = 1000
        uri = f"api/v1/chart/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

    def test_delete_chart_admin_not_owned(self):
        """
            Dashboard API: Test admin delete not owned
        """
        gamma_id = self.get_user("gamma").id
        chart_id = self.insert_chart("title", [gamma_id], 1).id

        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)
