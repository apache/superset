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
"""Unit tests for geocoding"""

from sqlalchemy.engine import reflection
from sqlalchemy_utils import table_name

import superset.models.core as models
from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.views import core, geocoding

from .base_tests import SupersetTestCase


class GeocodingTests(SupersetTestCase):
    superset = core.Superset()

    def __init__(self, *args, **kwargs):
        super(GeocodingTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()

    def tearDown(self):
        self.logout()

    def test_menu_entry_geocode_exist(self):
        url = "/dashboard/list/"
        dashboard_page = self.get_resp(url)
        assert "Geocode Addresses" in dashboard_page

    def test_geocode_adresses_view_load(self):
        url = "/geocoder/geocoding"
        form_get = self.get_resp(url)
        assert "Geocode Addresses" in form_get

    def test_get_columns(self):
        url = "/geocoder/geocoding/columns"

        table = db.session.query(SqlaTable).first()
        tableDto = models.TableDto(
            table.id, table.table_name, table.schema, table.database_id
        )
        columns = reflection.Inspector.from_engine(db.engine).get_columns(
            table.table_name
        )

        data = {"table": tableDto.to_json()}
        response = self.get_resp(url, json_=data)
        assert columns[0].get("name") in response

    def test_get_invalid_columns(self):
        url = "/geocoder/geocoding/columns"
        tableDto = models.TableDto(10001, "no_table")

        data = {"table": tableDto.to_json()}
        response = self.get_resp(url, json_=data)

        message = "No columns found for table with name {0}".format(tableDto.name)
        assert message in response
