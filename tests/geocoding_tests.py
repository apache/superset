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
import subprocess
import time

from superset import app, db
from superset.models.helpers import QueryStatus
from superset.utils.geocoding import GeoCoder
from superset.connectors.sqla.models import SqlaTable
from superset.views import core as views

from .base_tests import SupersetTestCase

BASE_DIR = app.config["BASE_DIR"]


class GeocodingTests(SupersetTestCase):
    superset = views.Superset()

    def __init__(self, *args, **kwargs):
        super(GeocodingTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()

    def tearDown(self):
        self.logout()

    @classmethod
    def setUpClass(cls):
        worker_command = BASE_DIR + "/bin/superset worker -w 2"
        subprocess.Popen(worker_command, shell=True, stdout=subprocess.PIPE)

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | xargs kill -9", shell=True
        )
        subprocess.call(
            "ps auxww | grep 'superset worker' | awk '{print $2}' | xargs kill -9",
            shell=True,
        )

    def test_get_mapbox_api_key(self):
        superset = views.Superset()
        api_key = superset._get_mapbox_key()
        assert isinstance(api_key, str)

    def test_menu_entry_geocode_exist(self):
        url = "/dashboard/list/"
        dashboard_page = self.get_resp(url)
        assert "Geocode Addresses" in dashboard_page

    # def test_geocode_adresses_view_load(self):
    # url = "/superset/geocoding"
    # form_get = self.get_resp(url)
    # assert "Geocode Addresses" in form_get

    def test_get_columns(self):
        url = "/superset/geocoding/columns"

        table = db.session.query(SqlaTable).all()[0]
        table_name = table.table_name

        data = {"tableName": table_name}
        response = self.get_resp(url, json_=data)
        assert table.columns[0].column_name in response

    def test_get_invalid_columns(self):
        url = "/superset/geocoding/columns"
        table_name = "no_table"

        data = {"tableName": table_name}
        response = self.get_resp(url, json_=data)

        message = "No table found with name {0}".format(table_name)
        assert message in response
