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
# pylint: disable=C,R,W

import simplejson as json
from flask import flash, request, Response
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __
from sqlalchemy import Column, Float, text
from sqlalchemy.engine import Connection, reflection

import superset.models.core as models
from superset import appbuilder, conf, db
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import (
    SqlAddColumnException,
    SqlSelectException,
    SqlUpdateException,
)
from superset.utils.geocoding_utils import GeocoderUtil

from .base import api, BaseSupersetView, json_error_response, json_success


class Geocoder(BaseSupersetView):
    """Geocoding methods and API!"""

    # Variables for geocoding
    geocoder_util = GeocoderUtil(conf)

    @has_access
    @expose("/geocoding")
    def geocoding(self):
        """
        Render react view for geocoding
        :return: Geocoding react view
        """
        bootstrap_data = {
            "tables": self._get_editable_tables(),
            "common": self.common_bootstrap_payload(),
        }

        if request.args.get("json") == "true":
            return json_success(
                json.dumps(bootstrap_data, default=lambda x: x.__dict__)
            )

        return self.render_template(
            "superset/geocoding.html",
            entry="geocoding",
            standalone_mode=False,
            title="Geocode Addresses",
            bootstrap_data=json.dumps(bootstrap_data, default=lambda x: x.__dict__),
        )

    def _get_editable_tables(self):
        """
        Get tables which are allowed to create columns (allow dml on their database)
        :return: list of table names
        """
        tables = []
        for database in (
            db.session.query(models.Database).filter_by(allow_dml=True).all()
        ):
            for table in (
                db.session.query(SqlaTable).filter_by(database_id=database.id).all()
            ):
                tables.append(
                    models.TableDto(
                        table.id, table.table_name, table.schema, table.database_id
                    )
                )
        return tables

    @api
    @has_access_api
    @expose("/geocoding/columns", methods=["POST"])
    def columns(self) -> str:
        """
        Get all column names from given table name
        :return: list of column names or an error message if table with given name does not exist
        """
        tableDto = request.json.get("table", models.TableDto())
        error_message = "No columns found for table with name {0}".format(
            tableDto.get("fullName", "undefined")
        )
        try:
            table = (
                db.session.query(SqlaTable).filter_by(id=tableDto.get("id", "")).first()
            )
            if table and table.columns:
                column_names = [column.column_name for column in table.columns]
            else:
                return json_error_response(error_message, status=400)
        except:
            return json_error_response(error_message, status=400)
        return json.dumps(column_names)

    @api
    @has_access_api
    @expose("/geocoding/geocode", methods=["POST"])
    def geocode(self) -> Response:
        """
        Geocode addresses in given columns from given table
        :return: geocoded data as list of tuples with success, doubt and failed counters as dict bundled in a list
                 or an error message if somethings went wrong
        """
        table_name = request.json.get("datasource", "")
        columns = [
            request.json.get("streetColumn"),
            request.json.get("cityColumn"),
            request.json.get("countryColumn"),
        ]
        lat_column = request.json.get("latitudeColumnName", "lat")
        lon_column = request.json.get("longitudeColumnName", "lon")
        override_if_exist = request.json.get("overwriteIfExists", False)
        save_on_stop_geocoding = request.json.get("saveOnErrorOrInterrupt", True)
        data = [()]

        try:
            if not override_if_exist and self._does_column_name_exist(
                table_name, lat_column
            ):
                raise ValueError(
                    "Column name {0} for latitude is already in use".format(lat_column)
                )
            if not override_if_exist and self._does_column_name_exist(
                table_name, lon_column
            ):
                raise ValueError(
                    "Column name {0} for longitude is already in use".format(lon_column)
                )

            data = self._load_data_from_columns(table_name, columns)
        except ValueError as e:
            return json_error_response(e.args[0], status=400)
        except SqlSelectException as e:
            return json_error_response(e.args[0], status=500)
        except Exception as e:
            return json_error_response(e.args[0], status=500)

        try:
            data = self._geocode(data)
        except Exception as e:
            if not save_on_stop_geocoding:
                return json_error_response(e.args[0])

        try:
            self._add_lat_lon_columns(table_name, lat_column, lon_column)
            self._insert_geocoded_data(
                table_name, lat_column, lon_column, columns, data[0]
            )
        except SqlAddColumnException as e:
            return json_error_response(e.args[0], status=500)
        except SqlUpdateException as e:
            return json_error_response(e.args[0], status=500)
        except Exception as e:
            return json_error_response(e.args[0], status=500)
        progress = self.geocoder.progress
        message = _(
            "Geocoded values, success: {}, doubt: {}, fail: {}".format(
                progress["success_counter"],
                progress["doubt_counter"],
                success["failed_counter"],
            )
        )
        flash(message, "success")
        return json_success(json.dumps(data))

    def _does_column_name_exist(self, table_name: str, column_name: str):
        """
        Check if column name already exists in table
        :param table_name: The table name of table to check
        :param column_name: The name of column to check
        :return true if column name exists in table
        """
        columns = reflection.Inspector.from_engine(db.engine).get_columns(table_name)
        column_names = [column["name"] for column in columns]
        return column_name in column_names

    def _load_data_from_columns(self, table_name: str, columns: list):
        """
        Get data from columns form table
        :param table_name: The table name from table from which select
        :param columns: The names of columns to select
        :return: The data from columns from given table as list of tuples
        :raise SqlSelectException: When SELECT from given columns went wrong
        """
        try:
            # TODO SQL Injection Check
            selected_columns = ", ".join(filter(None, columns))
            sql = "SELECT " + selected_columns + " FROM %s" % table_name
            result = db.engine.connect().execute(sql)
            return [row for row in result]
        except Exception:
            raise SqlSelectException(
                "An error occured while getting address data from columns "
                + selected_columns
            )

    def _geocode(self, data: list, dev=False):
        """
        Internal method which starts the geocoding
        :param data: the data to be geocoded as a list of tuples
        :param dev: Whether to Mock the geocoding process for testing purposes
        :return: a list of tuples containing the data and the corresponding long, lat values
        """
        if dev:
            return self.geocoder_util.geocode("", data)
        else:
            return self.geocoder_util.geocode("MapTiler", data)

    def _add_lat_lon_columns(self, table_name: str, lat_column: str, lon_column: str):
        """
        Add new longitude and latitude columns to table
        :param table_name: The table name of table to insert columns
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :raise SqlAddColumnException: When add column-SQL went wrong
        """
        connection = db.engine.connect()
        transaction = connection.begin()
        try:
            self._add_column(connection, table_name, lat_column, Float())
            self._add_column(connection, table_name, lon_column, Float())
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise SqlAddColumnException(
                "An error occured while creating new columns for latitude and longitude"
            )

    def _add_column(
        self,
        connection: Connection,
        table_name: str,
        column_name: str,
        column_type: str,
    ):
        """
        Add new column to table
        :param connection: The connection to work with
        :param table_name: The name of table to add a new column
        :param column_name: The name of latitude column
        :param column_type: The name of longitude column
        """
        column = Column(column_name, column_type)
        name = column.compile(column_name, dialect=db.engine.dialect)
        type = column.type.compile(db.engine.dialect)
        sql = text("ALTER TABLE %s ADD %s %s" % (table_name, name, type))
        connection.execute(sql)

    def _insert_geocoded_data(
        self,
        table_name: str,
        lat_column: str,
        lon_column: str,
        geo_columns: list,
        data: list,
    ):
        """
        Insert geocoded coordinates in table
        :param table_name: The name of table to insert
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :param geo_columns: The list of selected geographical column names
        :param data: row with geographical data and geocoded coordinates
        :raise SqlUpdateException: When Update of given columns with given data went wrong
        """
        where_clause = "='%s' AND ".join(filter(None, geo_columns)) + "='%s'"
        number_of_columns = len(geo_columns)

        connection = db.engine.connect()
        transaction = connection.begin()
        try:
            for row in data:
                update = "UPDATE %s SET %s=%s, %s=%s " % (
                    table_name,
                    lat_column,
                    row[number_of_columns],
                    lon_column,
                    row[number_of_columns + 1],
                )
                where = "WHERE " + where_clause % (row[:number_of_columns])
                connection.execute(text(update + where))
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise SqlUpdateException(
                "An error occured while inserting geocoded addresses"
            )

    @api
    @has_access_api
    @expose("/geocoding/progress", methods=["GET"])
    def progress(self) -> Response:
        """
        Method to check the progress of the geocoding task
        :return: GeoCoding Object
        """
        return json_success(
            json.dumps(self.geocoder_util.progress, default=lambda x: x.__dict__)
        )

    @api
    @has_access_api
    @expose("/geocoding/interrupt", methods=["POST"])
    def interrupt(self) -> Response:
        """ Used for interrupting the geocoding process """
        self.geocoder_util.interruptflag = True
        return json_success("")


appbuilder.add_view_no_menu(Geocoder)

appbuilder.add_link(
    "Geocode Addresses",
    label=__("Geocode Addresses"),
    href="/geocoder/geocoding",
    icon="fa-globe",
    category="Sources",
    category_label=__("Sources"),
    category_icon="fa-wrench",
)
appbuilder.add_separator("Sources")
