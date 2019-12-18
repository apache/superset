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
    def geocoding(self) -> Response:
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

    def _get_editable_tables(self) -> list:
        """
        Get tables which are allowed to create columns (allow dml on their database)
        :return: list of dto table
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
        table_dto = request.json.get("table", models.TableDto())
        error_message = "No columns found for table with name {0}".format(
            table_dto.get("fullName", "undefined")
        )
        try:
            table = (
                db.session.query(SqlaTable)
                .filter_by(id=table_dto.get("id", ""))
                .first()
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
        :return: OK message or an error messge
        """
        request_data = request.json
        self._set_geocoder(request_data.get("geocoder", ""))
        lat_column = request_data.get("latitudeColumnName", "lat")
        lon_column = request_data.get("longitudeColumnName", "lon")
        columns = self._create_column_list(request_data)
        if_exists = request_data.get("ifExists")
        save_on_stop_geocoding = request_data.get("saveOnErrorOrInterrupt", True)
        table_dto = request_data.get("datasource", models.TableDto())
        table_id = table_dto.get("id", "")
        message_suffix = ""
        try:
            table = self._get_table_with_columns(table_id)
            lat_exists = self._does_column_name_exist(table, lat_column)
            lon_exists = self._does_column_name_exist(table, lon_column)
            if "fail" in if_exists and (lat_exists or lon_exists):
                self.stats_logger.incr("geocoding_failed")
                return json_error_response(
                    "At least one of the columns already exists!", status=400
                )
            self._create_columns(lat_column, lat_exists, lon_column, lon_exists, table)
            message_suffix = f" but columns have been created please choose the 'Replace' or 'Append' option when trying again."
            table_data = self._load_data_from_columns(
                table, columns, lat_column, lon_column, "append" in if_exists
            )
        except (NoColumnsException, TableNotFoundException, SqlSelectException) as e:
            self.stats_logger.incr("geocoding_failed")
            self.logger.exception(f"Error while verifying parameters {e}")
            return json_error_response(e.args[0], status=400)
        except Exception as e:
            self.logger.exception(f"Exception when preparing for geocoding {e}")
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=500)

        try:
            message_with_geocoded_values = self._geocode(table_data)
        except NotImplementedError as e:
            self.logger.exception(e.args[0])
            self.stats_logger.inc("geocoding_failed")
            return json_error_response(
                "Geocoder is not implemented correctly. Please contact your administrator."
            )
        except NoAPIKeySuppliedException as e:
            self.logger.exception(e.args[0])
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}")

        if self.geocoder.interruptflag and not save_on_stop_geocoding:
            return json_success(json.dumps(f"geocoding interrupted {message_suffix}"))
        # If there was an error, data[0] will be a message, otherwise it will be an empty string meaning we can proceed
        if message_with_geocoded_values[0] and not save_on_stop_geocoding:
            return json_error_response(
                f"{message_with_geocoded_values[0]} {message_suffix}"
            )
        try:
            geocoded_values = message_with_geocoded_values[1]
            # It is possible that no exception occured but no geocoded values are returned check for this
            if len(geocoded_values[0]) == 0:
                return json_error_response(
                    f"No geocoded values received {message_suffix}"
                )
            self._insert_geocoded_data(
                table, lat_column, lon_column, columns, geocoded_values[0]
            )
        except (SqlAddColumnException, SqlUpdateException) as e:
            self.logger.exception(
                f"Failed to add columns/ data after geocoding {e.orig}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(f"{e.args[0]} {message_suffix}", status=400)
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

    def _create_column_list(self, request_data: dict) -> list:
        """
        Create a list of column names from the given columns from request
        :param request_data: data sent by the request
        :return: list of column names
        """
        columns = []
        street_column = request_data.get("streetColumn")
        city_column = request_data.get("cityColumn")
        country_column = request_data.get("countryColumn")
        building_number_column = request_data.get("buildingNumberColumn")
        if street_column:
            columns.append(street_column)
        if city_column:
            columns.append(city_column)
        if country_column:
            columns.append(country_column)
        if building_number_column:
            columns.append(building_number_column)
        return columns

    def _get_from_clause(self, table: SqlaTable) -> str:
        """
        Get the from clause for the SQL statement
        :param table: The SqlaTable
        :return: The from clause as a string
        """
        quote = table.database.get_sqla_engine().dialect.identifier_preparer.quote
        if table.schema:
            full_table_name = quote(table.schema) + "." + quote(table.table_name)
        else:
            full_table_name = quote(table.table_name)
        return text(full_table_name)

    def _create_columns(
        self,
        lat_column: str,
        lat_exists: bool,
        lon_column: str,
        lon_exists: bool,
        table: SqlaTable,
    ) -> None:
        """
        Create the lat / lon columns if needed
        :param lat_column: The name of the latitude column
        :param lat_exists: True if the lat column already exists
        :param lon_column: The name of the longitude column
        :param lon_exists: True if the lon column already exists
        :param table: The table to check and add columns
        :return: SqlAddColumnException if the alter column SQL fail
        """

        connection = table.database.get_sqla_engine().connect()
        transaction = connection.begin()
        try:
            if not lat_exists:
                self._add_column(connection, table, lat_column, Float())
            if not lon_exists:
                self._add_column(connection, table, lon_column, Float())
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

    def _get_table_with_columns(self, table_id: str) -> SqlaTable:
        """
        Check if there is a table and the table has columns
        :param table_id: The id of the table
        :raise TableNotFoundException: If there is no table object
        :raise NoColumnsException: If the table does not have any columns
        """
        table = db.session.query(SqlaTable).filter_by(id=table_id).first()
        if not table:
            raise TableNotFoundException(f"Table with ID {table_id} does not exists")
        if not table.columns:
            raise NoColumnsException(f"No columns found for table with ID {table.id}.")
        return table

    def _does_column_name_exist(self, table: SqlaTable, column_name: str):
        """
        Check if column name already exists in table
        :param table: The SqlaTable
        :param column_name: The name of column to check
        :return true if column name exists in table
        """
        column_names = [column.column_name.lower() for column in table.columns]
        return column_name.lower() in column_names

    def _load_data_from_columns(
        self,
        table: SqlaTable,
        columns: list,
        lat_column: str,
        lon_column: str,
        is_append: bool,
    ) -> list:
        """
        Get data from columns form table
        :param table: The SqlaTable
        :param columns: The names of columns to select
        :param lat_column: The name of the lat column
        :param lon_column: The name of the lon_column
        :param is_append: If the data needs to be appended
        :return: The data from columns from given table as list of tuples
        :raise SqlSelectException: When SELECT from given columns went wrong
        """
        try:
            full_table_name = self._get_from_clause(table)
            column_list = ", ".join(columns)
            sql = f"SELECT {column_list} FROM {full_table_name}"
            if is_append:
                sql += f" WHERE {lat_column} IS NULL OR {lon_column} IS NULL"
            result = table.database.get_sqla_engine().connect().execute(sql)
            return [row for row in result]
        except Exception as e:
            raise SqlSelectException(
                "An error occured while getting address data from columns "
                + column_list,
                e,
            )

    def _set_geocoder(self, geocoder_name: str) -> None:
        """
        Initializes the geocoder to be used
        :param geocoder_name: The name of the geocoder
        """
        if geocoder_name:
            if geocoder_name.lower() == "maptiler":
                self.geocoder = MapTilerGeocoder(conf)
            if geocoder_name.lower() == "google":
                self.geocoder = GoogleGeocoder(conf)

    def _geocode(self, data: list):
        """
        Internal method which starts the geocoding
        :param data: The data to be geocoded as a list of tuples
        :return: A list of tuples containing the data and the corresponding long, lat values
        """
        self.geocoder.check_api_key()
        return self.geocoder.geocode(data)

    def _add_column(
        self,
        connection: Connection,
        table: SqlaTable,
        column_name: str,
        column_type: str,
    ) -> None:
        """
        Add new column to table
        :param connection: The connection to work with
        :param table: The SqlaTable
        :param column_name: The name of the column
        :param column_type: The type of the column
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
    ) -> None:
        """
        Insert geocoded coordinates in table
        :param table: The table to insert
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :param geo_columns: The list of selected geographical column names
        :param data: row with geographical data and geocoded coordinates
        :raise SqlUpdateException: When update of given columns with given data went wrong
        """
        where_clause = "='%s' AND ".join(geo_columns) + "='%s'"
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
