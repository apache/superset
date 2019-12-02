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
        table_name = table.table_name
        columns = reflection.Inspector.from_engine(db.engine).get_columns(table_name)

        data = {"tableName": table_name}
        response = self.get_resp(url, json_=data)
        assert columns[0].get("name") in response

    def test_get_invalid_columns(self):
        url = "/geocoder/geocoding/columns"
        table_name = "no_table"

        data = {"tableName": table_name}
        response = self.get_resp(url, json_=data)

        message = "No columns found for table with name {0}".format(table_name)
        assert message in response

    # def test_add_lat_lon_columns(self):
    #     table = db.session.query(SqlaTable).first()
    #     database = db.session.query(Database).filter_by(id=table.database_id).first()
    #     database.allow_dml = True
    #     db.session.commit()
    #
    #     table_name = table.table_name
    #     lat_column_name = "lat"
    #     lon_column_name = "lon"
    #
    #     columns = reflection.Inspector.from_engine(db.engine).get_columns(table_name)
    #     number_of_columns_before = len(columns)
    #
    #     geocoding.Geocoder()._add_lat_lon_columns(
    #         table_name, lat_column_name, lon_column_name
    #     )
    #
    #     columns = reflection.Inspector.from_engine(db.engine).get_columns(table_name)
    #     number_of_columns_after = len(columns)
    #     assert number_of_columns_after == number_of_columns_before + 2
    #     column_names = [column["name"] for column in columns]
    #     assert lon_column_name in column_names
    #     assert lat_column_name in column_names

    def test_insert_geocoded_data(self):
        table_name = "birth_names"

        selected_columns = ["name", "gender"]
        data = [
            ("Aaron", "boy", 1, "2.2"),
            ("Amy", "girl", 3, "4.4"),
            ("Barbara", "girl", 5, "6.6"),
            ("Bradley", "boy", 7, "8.8"),
        ]
        first_column_name = "num"
        second_column_name = "state"

        geocoding.Geocoder()._insert_geocoded_data(
            table_name, first_column_name, second_column_name, selected_columns, data
        )
        result = db.engine.execute(
            "SELECT name, gender, num, state FROM birth_names WHERE name IN ('Aaron', 'Amy', 'Barbara', 'Bradley')"
        )
        for row in result:
            assert row in data
