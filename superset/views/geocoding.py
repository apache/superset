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

import logging

import simplejson as json
from flask import flash, request, Response
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __
from sqlalchemy import Column, Float, text
from sqlalchemy.engine import Connection

import superset.models.core as models
from superset import appbuilder, conf, db, security_manager
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import (
    NoAPIKeySuppliedException,
    NoColumnsException,
    SqlAddColumnException,
    SqlSelectException,
    SqlUpdateException,
    TableNotFoundException,
)
from superset.utils.geocoders import BaseGeocoder, GoogleGeocoder, MapTilerGeocoder

from .base import api, BaseSupersetView, json_error_response, json_success


class Geocoder(BaseSupersetView):
    """Geocoding methods and API!"""

    # Variables for geocoding
    geocoder = BaseGeocoder(conf)
    stats_logger = conf["STATS_LOGGER"]
    logger = logging.getLogger(__name__)

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
            all_tables = (
                db.session.query(SqlaTable).filter_by(database_id=database.id).all()
            )
            permitted_tables = security_manager.get_datasources_accessible_by_user(
                database, all_tables
            )
            for table in permitted_tables:
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
        except Exception as e:
            self.logger.exception(f"Failed getting columns {e}")
            self.stats_logger.incr(error_message)
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
        request_data = request.json
        columns = []

        self._set_geocoder(request_data.get("geocoder", ""))
        if request_data.get("streetColumn"):
            columns.append(request.json.get("streetColumn"))
        if request_data.get("cityColumn"):
            columns.append(request.json.get("cityColumn"))
        if request_data.get("countryColumn"):
            columns.append(request.json.get("countryColumn"))
        if request_data.get("buildingNumberColumn"):
            columns.append(request_data.get("buildingNumberColumn"))
        if_exists = request_data.get("ifExists")
        lat_column = request_data.get("latitudeColumnName", "lat")
        lon_column = request_data.get("longitudeColumnName", "lon")
        save_on_stop_geocoding = request.json.get("saveOnErrorOrInterrupt", True)
        table_dto = request_data.get("datasource", models.TableDto())
        table_id = table_dto.get("id", "")
        message_suffix = ""
        try:
            column_message = self._check_and_create_columns(request_data)
            if column_message:
                message_suffix = f" but {column_message} please choose the overwrite option when trying again"
            if "append" in if_exists:
                table_data = self._load_data_from_columns(
                    table_id, columns, lat_column, lon_column
                )
            else:
                table_data = self._load_data_from_columns(table_id, columns)

        except ValueError as e:
            self.logger.exception(f"ValueError when querying for lat/lon columns {e}")
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=400)
        except SqlSelectException as e:
            self.logger.exception(
                f"SqlSelectException when preparing for geocoding {e.orig}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=500)
        except Exception as e:
            self.logger.exception(f"Exception when preparing for geocoding {e}")
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=500)

        try:
            geocoded_values_with_message = self._geocode(table_data, self.geocoder)
        except NoAPIKeySuppliedException as e:
            self.logger.exception(e.args[0])
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}")
        if self.geocoder.interruptflag:
            if not save_on_stop_geocoding:
                return json_success(
                    json.dumps(f"geocoding interrupted {message_suffix}")
                )
        # If there was an error, data[0] will be a message, otherwise it will be an empty string meaning we can proceed
        if geocoded_values_with_message[0]:
            if not save_on_stop_geocoding:
                return json_error_response(
                    json.dumps(f"{geocoded_values_with_message[0]} {message_suffix}")
                )
        try:
            geocoded_values = geocoded_values_with_message[1]
            # It is possible that no exception occured but no geocoded values are returned check for this
            if len(geocoded_values[0]) == 0:
                return json_error_response(
                    json.dumps(f"No geocoded values received {message_suffix}")
                )
            table = self._get_table_by_id(table_id)
            self._insert_geocoded_data(
                table, lat_column, lon_column, columns, geocoded_values[0]
            )
        except (SqlAddColumnException, SqlUpdateException) as e:
            self.logger.exception(
                f"Failed to add columns/ data after geocoding {e.orig}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=500)
        except Exception as e:
            self.logger.exception(
                f"Exception when adding columns/ data after geocoding {e}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=500)

        db.session.commit()
        progress = self.geocoder.progress
        message = (
            f"Geocoded values, success: {progress['success_counter']}, doubt: {progress['doubt_counter']}, "
            f"fail: {progress['failed_counter']}"
        )
        flash(message, "success")
        self.stats_logger.incr("succesful_geocoding")
        return json_success('"OK"')

    def _get_from_clause(self, table):
        quote = table.database.get_sqla_engine().dialect.identifier_preparer.quote
        if table.schema:
            full_table_name = quote(table.schema) + "." + quote(table.table_name)
        else:
            full_table_name = quote(table.table_name)
        return text(full_table_name)

    def _check_and_create_columns(self, request_data):
        lat_column = request_data.get("latitudeColumnName", "lat")
        lon_column = request_data.get("longitudeColumnName", "lon")
        if_exists = request.json.get("ifExists", "fail")
        if "fail" in if_exists:
            override_if_exist = False
        else:
            override_if_exist = True
        table_dto = request_data.get("datasource", models.TableDto())
        table_id = table_dto.get("id", "")
        table = self._get_table_by_id(table_id)
        lat_exists = self._does_column_name_exist(table, lat_column)
        lon_exists = self._does_column_name_exist(table, lon_column)
        column_message_suffix = ""
        if override_if_exist:
            if lat_exists:
                if lon_exists:
                    pass
                else:
                    self._add_lat_lon_columns(table, lon_column=lon_column)
                    column_message_suffix = f"successfully created column {lon_column}"
            else:
                if lon_exists:
                    self._add_lat_lon_columns(table, lat_column=lat_column)
                    column_message_suffix = f"successfully created column {lat_column}"
                else:
                    self._add_lat_lon_columns(table, lat_column, lon_column)
                    column_message_suffix = (
                        f"successfully created columns: {lat_column} and {lon_column}"
                    )
        else:
            if lat_exists:
                raise ValueError(
                    f"Column name {lat_column} for latitude is already in use"
                )
            if lon_exists:
                raise ValueError(
                    f"Column name {lon_column} for longitude is already in use"
                )
            self._add_lat_lon_columns(table, lat_column, lon_column)
            column_message_suffix = (
                f"successfully created columns: {lat_column} and {lon_column}"
            )

        return column_message_suffix

    def _does_column_name_exist(self, table: SqlaTable, column_name: str):
        """
        Check if column name already exists in table
        :param table_name: The table name of table to check
        :param column_name: The name of column to check
        :return true if column name exists in table
        :raise TableNotFoundException: When there is no table
        """
        if table:
            if table.columns:
                column_names = [column.column_name.lower() for column in table.columns]
                return column_name.lower() in column_names
            raise NoColumnsException(f"No columns found for table with ID {table.id}.")
        raise TableNotFoundException(f"Table with ID {table.id} does not exist")

    def _load_data_from_columns(
        self, table_id: int, columns: list, lat_column=None, lon_column=None
    ):
        """
        Get data from columns form table
        :param table_name: The table name from table from which select
        :param columns: The names of columns to select
        :return: The data from columns from given table as list of tuples
        :raise SqlSelectException: When SELECT from given columns went wrong
        """
        try:
            table = self._get_table_by_id(table_id)
            full_table_name = self._get_from_clause(table)
            column_list = self._create_column_list(columns, lat_column, lon_column)
            sql = f"SELECT {column_list} FROM {full_table_name}"
            result = table.database.get_sqla_engine().connect().execute(sql)
            if lat_column and lon_column:
                resultset = []
                column_count = len(columns)
                for row in result:
                    if not row[column_count] or not row[column_count + 1]:
                        resultset.append(row[0:column_count])
                return resultset
            else:
                return [row for row in result]
        except Exception as e:
            raise SqlSelectException(
                "An error occured while getting address data from columns "
                + column_list,
                e,
            )

    def _get_table_by_id(self, table_id: int) -> SqlaTable:
        """
        Get a SqlaTable object from the session and return it
        :param table_id: The ID of the table to get
        :return: The SqlaTable object with the corresponding ID
        """
        table = db.session.query(SqlaTable).filter_by(id=table_id).first()
        if not table:
            raise TableNotFoundException(f"Table with ID {table_id} does not exists")
        return table

    def _create_column_list(self, columns, lat_column: str, lon_column: str):
        column_list = []
        for column in columns:
            if column:
                column_list.append(column)
        if lat_column and lon_column:
            column_list.append(lat_column)
            column_list.append(lon_column)

        return ", ".join(filter(None, column_list))

    def _set_geocoder(self, geocoder_name: str) -> None:
        if geocoder_name:
            if geocoder_name.lower() == "maptiler":
                self.geocoder = MapTilerGeocoder(conf)
            if geocoder_name.lower() == "google":
                self.geocoder = GoogleGeocoder(conf)

    def _geocode(self, data: list, geocoder):
        """
        Internal method which starts the geocoding
        :param data: the data to be geocoded as a list of tuples
        :return: a list of tuples containing the data and the corresponding long, lat values
        """
        try:
            geocoder.check_api_key()
        except NotImplementedError:
            return json_error_response(
                "Geocoder is not implemented correctly, please contact your administrator."
            )
        return geocoder.geocode(data)

    def _add_lat_lon_columns(
        self, table: SqlaTable, lat_column: str = None, lon_column: str = None
    ):
        """
        Add new longitude and latitude columns to table
        :param table: The table insert columns
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :raise SqlAddColumnException: When add column-SQL went wrong
        """
        connection = table.database.get_sqla_engine().connect()
        transaction = connection.begin()
        try:
            if lat_column:
                self._add_column(connection, table, lat_column, Float())
            if lon_column:
                self._add_column(connection, table, lon_column, Float())
            transaction.commit()
        except Exception as e:
            transaction.rollback()
            raise SqlAddColumnException(
                "An error occured while creating new columns for latitude and longitude",
                e,
            )
        finally:
            transaction.close()
            connection.close()
            db.session.commit()

    def _add_column(
        self,
        connection: Connection,
        table: SqlaTable,
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
        col_type = column.type.compile(db.engine.dialect)
        sql = text(f"ALTER TABLE {self._get_from_clause(table)} ADD {name} {col_type}")
        connection.execute(sql)

        table.columns.append(TableColumn(column_name=column_name, type=col_type))

    def _insert_geocoded_data(
        self,
        table: SqlaTable,
        lat_column: str,
        lon_column: str,
        geo_columns: list,
        data,
    ):
        """
        Insert geocoded coordinates in table
        :param table: The table to insert
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :param geo_columns: The list of selected geographical column names
        :param data: row with geographical data and geocoded coordinates
        :raise SqlUpdateException: When Update of given columns with given data went wrong
        """
        where_clause = "='%s' AND ".join(filter(None, geo_columns)) + "='%s'"
        lat_column_index = len(geo_columns)

        connection = table.database.get_sqla_engine().connect()
        transaction = connection.begin()
        try:
            for row in data:
                update = (
                    f"UPDATE {self._get_from_clause(table)} SET {lat_column}={row[lat_column_index]}, "
                    f"{lon_column}={row[lat_column_index + 1]} "
                )
                where = "WHERE " + where_clause % (tuple(row[:lat_column_index]))
                connection.execute(text(update + where))
            transaction.commit()
        except Exception as e:
            transaction.rollback()
            raise SqlUpdateException(
                "An error occured while inserting geocoded addresses", e
            )
        finally:
            transaction.close()
            connection.close()
            db.session.commit()

    @api
    @has_access_api
    @expose("/geocoding/progress", methods=["GET"])
    def progress(self) -> Response:
        """
        Method to check the progress of the geocoding task
        :return: GeoCoding Object
        """
        return json_success(
            json.dumps(self.geocoder.progress, default=lambda x: x.__dict__)
        )

    @api
    @has_access_api
    @expose("/geocoding/interrupt", methods=["POST"])
    def interrupt(self) -> Response:
        """ Used for interrupting the geocoding process """
        self.geocoder.interruptflag = True
        return json_success('"OK"')


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
