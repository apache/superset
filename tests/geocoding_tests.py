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
import threading
import time

import pandas as pd
import simplejson as json
from sqlalchemy import Float, Integer, MetaData, String
from sqlalchemy.engine import reflection
from sqlalchemy.ext.declarative import declarative_base

import superset.models.core as models
from superset import conf, db
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import TableNotFoundException
from superset.models.core import Database
from superset.utils.geocoding_utils import GeocoderUtilMock
from superset.views.geocoding import Geocoder

from .base_tests import SupersetTestCase


class GeocodingTests(SupersetTestCase):
    test_database = None
    sqla_departments = None

    def __init__(self, *args, **kwargs):
        super(GeocodingTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()
        Geocoder.geocoder_util = GeocoderUtilMock(conf)
        self.create_table_in_view()

    def create_table_in_view(self):
        engine = None
        if not self.test_database:
            self.test_database = db.session.query(Database).first()
            self.test_database.allow_dml = True
            engine = self.test_database.get_sqla_engine()
            db.session.commit()
        if not self.sqla_departments and self.test_database and engine:
            params = {"remote_id": 1234, "database_name": self.test_database.name}
            self.sqla_departments = SqlaTable(
                id=1234, table_name="Departments", params=json.dumps(params)
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="department_id", type="INTEGER")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="name", type="STRING")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="street", type="STRING")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="city", type="STRING")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="country", type="STRING")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="lat", type="FLOAT")
            )
            self.sqla_departments.columns.append(
                TableColumn(column_name="lon", type="FLOAT")
            )
            self.sqla_departments.database = self.test_database
            self.sqla_departments.database_id = self.sqla_departments.database.id
            db.session.add(self.sqla_departments)
            db.session.commit()

            data = {
                "department_id": [1, 2, 3, 4, 5],
                "name": [
                    "Logistics",
                    "Marketing",
                    "Facility Management",
                    "Personal",
                    "Finances",
                ],
                "street": [
                    "Oberseestrasse 10",
                    "Grossmünsterplatz",
                    "Uetliberg",
                    "Zürichbergstrasse 221",
                    "Bahnhofstrasse",
                ],
                "city": ["Rapperswil", "Zürich", "Zürich", "Zürich", "Zürich"],
                "country": [
                    "Switzerland",
                    "Switzerland",
                    "Switzerland",
                    "Switzerland",
                    "Switzerland",
                ],
                "lat": [None, None, None, None, None],
                "lon": [None, None, None, None, None],
            }
            df = pd.DataFrame(data=data)
            df.to_sql(
                self.sqla_departments.table_name,
                engine,
                if_exists="replace",
                chunksize=500,
                dtype={
                    "department_id": Integer,
                    "name": String(60),
                    "street": String(60),
                    "city": String(60),
                    "country": String(60),
                    "lat": Float,
                    "lon": Float,
                },
                index=False,
            )

    def doCleanups(self):
        self.logout()
        if self.test_database and self.sqla_departments:
            db.session.delete(self.sqla_departments)
            self.test_database.allow_dml = False
            db.session.commit()

            base = declarative_base()
            metadata = MetaData(db.engine, reflect=True)
            table = metadata.tables.get(self.sqla_departments.table_name)
            if table is not None:
                base.metadata.drop_all(db.engine, [table], checkfirst=True)

    def test_menu_entry_geocode_exist(self):
        url = "/dashboard/list/"
        dashboard_page = self.get_resp(url)
        assert "Geocode Addresses" in dashboard_page

    def test_geocode_addresses_view_load(self):
        url = "/geocoder/geocoding"
        form_get = self.get_resp(url)
        assert "Geocode Addresses" in form_get

    def test_get_columns(self):
        url = "/geocoder/geocoding/columns"
        table_dto = models.TableDto(
            self.sqla_departments.id,
            self.sqla_departments.table_name,
            self.sqla_departments.schema,
            self.sqla_departments.database_id,
        )
        data = {"table": table_dto.to_json()}

        columns = reflection.Inspector.from_engine(db.engine).get_columns(
            self.sqla_departments.table_name
        )

        response = self.get_resp(url, json_=data)
        assert columns[0].get("name") in response

    def test_get_invalid_columns(self):
        url = "/geocoder/geocoding/columns"
        table_dto = models.TableDto(10001, "no_table")
        data = {"table": table_dto.to_json()}

        response = self.get_resp(url, json_=data)

        error_message = f"No columns found for table with name {table_dto.name}"
        assert error_message in response

    def test_does_valid_column_name_exist(self):
        table_id = self.sqla_departments.id
        columns = reflection.Inspector.from_engine(db.engine).get_columns(
            self.sqla_departments.table_name
        )
        column_name = columns[0].get("name")

        response = Geocoder()._does_column_name_exist(table_id, column_name)
        assert True is response

    def test_does_column_name_not_exist(self):
        table_id = self.sqla_departments.id
        column_name = "no_column"

        response = Geocoder()._does_column_name_exist(table_id, column_name)
        assert False is response

    def test_does_table_not_exist(self):
        table_id = -1
        column_name = "no_column"

        error_message = f"Table with ID {table_id} does not exists"
        with self.assertRaisesRegex(TableNotFoundException, error_message):
            Geocoder()._does_column_name_exist(table_id, column_name)

    def test_load_data_from_all_columns(self):
        table_id = self.sqla_departments.id
        geo_columns = ["street", "city", "country"]

        data = Geocoder()._load_data_from_columns(table_id, geo_columns)
        assert 5 == len(data)
        assert ("Oberseestrasse 10", "Rapperswil", "Switzerland") in data

    def test_load_data_from_columns_with_none(self):
        table_id = self.sqla_departments.id
        geo_columns = ["street", None, "country"]

        data = Geocoder()._load_data_from_columns(table_id, geo_columns)
        assert 5 == len(data)
        assert ("Oberseestrasse 10", "Switzerland") in data

    def test_add_lat_lon_columns(self):
        table = self.sqla_departments
        lat_column_name = "latitude"
        lon_column_name = "longitude"

        columns = self.sqla_departments.columns
        number_of_columns_before = len(columns)

        Geocoder()._add_lat_lon_columns(table, lat_column_name, lon_column_name)

        columns = self.sqla_departments.columns
        number_of_columns_after = len(columns)

        assert number_of_columns_after == number_of_columns_before + 2
        column_names = [column.column_name for column in columns]
        assert lon_column_name in column_names
        assert lat_column_name in column_names

    def test_insert_geocoded_data(self):
        lat_column_name = "lat"
        lon_column_name = "lon"
        table_name = self.sqla_departments.table_name
        table = self.sqla_departments
        geo_columns = ["street", "city", "country"]
        data = [
            ("Oberseestrasse 10", "Rapperswil", "Switzerland", 47.224, 8.8181),
            ("Grossmünsterplatz", "Zürich", "Switzerland", 47.370, 8.544),
            ("Uetliberg", "Zürich", "Switzerland", 47.353, 8.492),
            ("Zürichbergstrasse 221", "Zürich", "Switzerland", 47.387, 8.574),
            ("Bahnhofstrasse", "Zürich", "Switzerland", 47.372, 8.539),
        ]

        Geocoder()._insert_geocoded_data(
            table, lat_column_name, lon_column_name, geo_columns, data
        )

        quote = self.test_database.get_sqla_engine().dialect.identifier_preparer.quote
        result = db.engine.execute(
            f"SELECT street, city, country, {lat_column_name}, {lon_column_name} FROM {quote(table_name)}"
        )
        for row in result:
            assert row in data

    def _geocode_post(self):
        table_dto = models.TableDto(
            self.sqla_departments.id,
            self.sqla_departments.table_name,
            self.sqla_departments.schema,
            self.sqla_departments.database_id,
        )
        return {
            "datasource": table_dto.to_json(),
            "streetColumn": "street",
            "cityColumn": "city",
            "countryColumn": "country",
            "latitudeColumnName": "lat",
            "longitudeColumnName": "lon",
            "overwriteIfExists": True,
            "saveOnErrorOrInterrupt": True,
        }

    def test_geocode(self):
        url = "/geocoder/geocoding/geocode"

        response = self.get_resp(url, json_=self._geocode_post())
        assert "OK" in response

    def test_progress(self):
        geocode_url = "/geocoder/geocoding/geocode"
        progress_url = "/geocoder/geocoding/progress"

        geocode = threading.Thread(
            target=self.get_resp,
            args=(geocode_url, None, True, True, self._geocode_post()),
        )
        geocode.start()
        time.sleep(
            4
        )  # Wait to be sure geocode has geocoded some data, but not all (5 addresses * 2 sec)

        progress = json.loads(self.get_resp(progress_url))
        assert 0 < progress.get("progress", 0)
        assert progress.get("is_in_progress", False)
        assert 0 < progress.get("success_counter", 0)

        geocode.join()

    def test_interrupt(self):
        geocode_url = "/geocoder/geocoding/geocode"
        interrupt_url = "/geocoder/geocoding/interrupt"
        progress_url = "/geocoder/geocoding/progress"

        geocode = threading.Thread(
            target=self.get_resp,
            args=(geocode_url, None, True, True, self._geocode_post()),
        )
        geocode.start()
        time.sleep(
            4
        )  # Wait to be sure geocode has geocoded some data, but not all (5 addresses * 2 sec)

        interrupt = self.get_resp(interrupt_url, json_=json.dumps("{}"))
        assert '"ok"' == interrupt

        time.sleep(4)  # Wait to be sure geocode has geocoded another data

        progress = json.loads(self.get_resp(progress_url))
        assert 5 >= progress.get("success_counter", 0)
        assert 0 == progress.get("progress", 5)
        assert not progress.get("is_in_progress", True)

        geocode.join()
