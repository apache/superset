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
from superset.utils.geocoders import BaseGeocoder
from superset.views.geocoding import Geocoder as GeocoderApi

from .base_tests import SupersetTestCase


class GeocoderMock(BaseGeocoder):
    geocoded_data = {
        "Oberseestrasse 10 Rapperswil Switzerland": [47.224, 8.8181],
        "Grossmünsterplatz Zürich Switzerland": [47.370, 8.544],
        "Uetliberg Zürich Switzerland": [47.353, 8.492],
        "Zürichbergstrasse 221 Zürich Switzerland": [47.387, 8.574],
        "Bahnhofstrasse Zürich Switzerland": [47.372, 8.539],
    }

    def _get_coordinates_from_address(self, address: str):
        time.sleep(2)
        return [self.geocoded_data.get(address), 0.81]

    def check_api_key(self):
        pass


class GeocodingTests(SupersetTestCase):
    test_database = None
    test_table = None

    def __init__(self, *args, **kwargs):
        super(GeocodingTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()
        GeocoderApi.geocoder = GeocoderMock(conf)
        self.create_table_in_view()

    def create_table_in_view(self):
        self.test_database = db.session.query(Database).first()
        self.test_database.allow_dml = True

        params = {"remote_id": 1234, "database_name": self.test_database.name}
        self.test_table = SqlaTable(
            id=1234, table_name="Departments", params=json.dumps(params)
        )
        self.test_table.columns.append(
            TableColumn(column_name="department_id", type="INTEGER")
        )
        self.test_table.columns.append(TableColumn(column_name="name", type="STRING"))
        self.test_table.columns.append(TableColumn(column_name="street", type="STRING"))
        self.test_table.columns.append(TableColumn(column_name="city", type="STRING"))
        self.test_table.columns.append(
            TableColumn(column_name="country", type="STRING")
        )
        self.test_table.columns.append(TableColumn(column_name="lat", type="FLOAT"))
        self.test_table.columns.append(TableColumn(column_name="lon", type="FLOAT"))
        self.test_table.database = self.test_database
        self.test_table.database_id = self.test_table.database.id
        db.session.add(self.test_table)
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

        # because of caching problem with postgres load database a second time
        # without this, the sqla engine throws an exception
        database = db.session.query(Database).first()
        if database:
            engine = database.get_sqla_engine()
            df.to_sql(
                self.test_table.table_name,
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
        if self.test_database and self.test_table:
            db.session.delete(self.test_table)
            self.test_database.allow_dml = False
            db.session.commit()

            base = declarative_base()
            metadata = MetaData(db.engine, reflect=True)
            table = metadata.tables.get(self.test_table.table_name)
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
            self.test_table.id,
            self.test_table.table_name,
            self.test_table.schema,
            self.test_table.database_id,
        )
        data = {"table": table_dto.to_json()}

        columns = reflection.Inspector.from_engine(db.engine).get_columns(
            self.test_table.table_name
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
        columns = reflection.Inspector.from_engine(db.engine).get_columns(
            self.test_table.table_name
        )
        column_name = columns[0].get("name")

        response = GeocoderApi()._does_column_name_exist(self.test_table, column_name)
        assert True is response

    def test_does_column_name_not_exist(self):
        column_name = "no_column"

        response = GeocoderApi()._does_column_name_exist(self.test_table, column_name)
        assert False is response

    def test_does_table_not_exist(self):
        table_id = -1

        error_message = f"Table with ID {table_id} does not exists"
        with self.assertRaisesRegex(TableNotFoundException, error_message):
            GeocoderApi()._get_table_with_columns(table_id)

    def test_load_data_from_all_columns(self):
        table = self.test_table
        geo_columns = ["street", "city", "country"]

        data = GeocoderApi()._load_data_from_columns(table, geo_columns)
        assert 5 == len(data)
        assert ("Oberseestrasse 10", "Rapperswil", "Switzerland") in data

    def test_add_lat_lon_columns(self):
        table = self.test_table
        lat_column_name = "latitude"
        lon_column_name = "longitude"

        columns = self.test_table.columns
        number_of_columns_before = len(columns)

        GeocoderApi()._create_columns(lat_column_name, False, lon_column_name, False, table)

        columns = self.test_table.columns
        number_of_columns_after = len(columns)

        assert number_of_columns_after == number_of_columns_before + 2
        column_names = [column.column_name for column in columns]
        assert lon_column_name in column_names
        assert lat_column_name in column_names

    def test_insert_geocoded_data(self):
        lat_column_name = "lat"
        lon_column_name = "lon"
        table_name = self.test_table.table_name
        table = self.test_table
        geo_columns = ["street", "city", "country"]
        data = [
            ("Oberseestrasse 10", "Rapperswil", "Switzerland", 47.224, 8.8181),
            ("Grossmünsterplatz", "Zürich", "Switzerland", 47.370, 8.544),
            ("Uetliberg", "Zürich", "Switzerland", 47.353, 8.492),
            ("Zürichbergstrasse 221", "Zürich", "Switzerland", 47.387, 8.574),
            ("Bahnhofstrasse", "Zürich", "Switzerland", 47.372, 8.539),
        ]

        GeocoderApi()._insert_geocoded_data(
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
            self.test_table.id,
            self.test_table.table_name,
            self.test_table.schema,
            self.test_table.database_id,
        )
        return {
            "datasource": table_dto.to_json(),
            "streetColumn": "street",
            "cityColumn": "city",
            "countryColumn": "country",
            "latitudeColumnName": "lat",
            "longitudeColumnName": "lon",
            "ifExists": "replace",
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
        assert progress.get("is_in_progress") is True
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
        assert '"OK"' in interrupt

        time.sleep(4)  # Wait to be sure geocode has geocoded another data

        progress = json.loads(self.get_resp(progress_url))
        assert 5 >= progress.get("success_counter", 0)
        assert 0 == progress.get("progress", 5)
        assert progress.get("is_in_progress", True) is False

        geocode.join()
