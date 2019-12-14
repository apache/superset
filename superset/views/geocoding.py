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
from superset import appbuilder, conf, db
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import (
    SqlAddColumnException,
    SqlSelectException,
    SqlUpdateException,
    TableNotFoundException,
)
from superset.utils.geocoding_utils import GeocoderUtil

from .base import api, BaseSupersetView, json_error_response, json_success


class Geocoder(BaseSupersetView):
    """Geocoding methods and API!"""

    # Variables for geocoding
    geocoder_util = GeocoderUtil(conf)
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
        table_name = request_data.get("datasource", "")
        columns = []

        if request.json.get("streetColumn"):
            columns.append(request.json.get("streetColumn"))
        if request.json.get("cityColumn"):
            columns.append(request.json.get("cityColumn"))
        if request.json.get("countryColumn"):
            columns.append(request.json.get("countryColumn"))

        lat_column = request_data.get("latitudeColumnName", "lat")
        lon_column = request_data.get("longitudeColumnName", "lon")
        save_on_stop_geocoding = request.json.get("saveOnErrorOrInterrupt", True)
        data = [()]

        try:
            table_dto = request_data.get("datasource", models.TableDto())
            self._check_and_create_columns(request_data)
            data = self._load_data_from_columns(table_dto.get("id", ""), columns)
        except ValueError as e:
            self.logger.exception(f"ValueError when querying for lat/lon columns {e}")
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(e.args[0], status=400)
        except SqlSelectException as e:
            self.logger.exception(
                f"SqlSelectException when preparing for geocoding {e.orig}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(e.args[0], status=500)
        except Exception as e:
            self.logger.exception(f"Exception when preparing for geocoding {e}")
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(e.args[0], status=500)

        try:
            data = self.geocoder_util.geocode("MapTiler", data)
        except Exception as e:
            self.logger.exception(f"Exception when geocoding data {e}")
            if not save_on_stop_geocoding:
                self.stats_logger.incr("geocoding_failed")
                return json_error_response(e.args[0])
        try:
            self._insert_geocoded_data(
                table_name.get("id"), lat_column, lon_column, columns, data[0]
            )
        except (SqlAddColumnException, SqlUpdateException) as e:
            self.logger.exception(
                f"Failed to add columns/ data after geocoding {e.orig}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(e.args[0], status=500)
        except Exception as e:
            self.logger.exception(
                f"Exception when adding columns/ data after geocoding {e}"
            )
            self.stats_logger.incr("geocoding_failed")
            return json_error_response(e.args[0], status=500)

        db.session.commit()
        progress = self.geocoder_util.progress
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
        override_if_exist = request.json.get("overwriteIfExists", False)
        table_dto = request_data.get("datasource", models.TableDto())
        table_id = table_dto.get("id", "")
        lat_exists = self._does_column_name_exist(table_id, lat_column)
        lon_exists = self._does_column_name_exist(table_id, lon_column)
        if override_if_exist:
            if lat_exists:
                if lon_exists:
                    pass
                else:
                    self._add_lat_lon_columns(table_id, lon_column=lon_column)
            else:
                if lon_exists:
                    self._add_lat_lon_columns(table_id, lat_column=lat_column)
                else:
                    self._add_lat_lon_columns(table_id, lat_column, lon_column)

        else:
            if self._does_column_name_exist(table_id, lat_column):
                raise ValueError(
                    "Column name {0} for latitude is already in use".format(lat_column)
                )
            if self._does_column_name_exist(table_id, lon_column):
                raise ValueError(
                    "Column name {0} for longitude is already in use".format(lon_column)
                )
            self._add_lat_lon_columns(table_id, lat_column, lon_column)

    def _does_column_name_exist(self, id: int, column_name: str):
        """
        Check if column name already exists in table
        :param table_name: The table name of table to check
        :param column_name: The name of column to check
        :return true if column name exists in table
        """
        table = self._get_table(id)
        if table and table.columns:
            column_names = [column.column_name.lower() for column in table.columns]
            return column_name.lower() in column_names
        raise TableNotFoundException(f"Table with ID {id} does not exists")

    def _load_data_from_columns(self, id: int, columns: list):
        """
        Get data from columns form table
        :param table_name: The table name from table from which select
        :param columns: The names of columns to select
        :return: The data from columns from given table as list of tuples
        :raise SqlSelectException: When SELECT from given columns went wrong
        """
        try:
            table = self._get_table(id)
            quote = table.database.get_sqla_engine().dialect.identifier_preparer.quote
            if table.schema:
                full_table_name = quote(table.schema) + "." + quote(table.table_name)
            else:
                full_table_name = quote(table.table_name)

            column_list = self._create_column_list(columns)
            sql = f"SELECT {column_list} FROM {full_table_name}"
            result = table.database.get_sqla_engine().connect().execute(sql)
            return [row for row in result]
        except Exception as e:
            raise SqlSelectException(
                "An error occured while getting address data from columns "
                + column_list,
                e,
            )

    def _get_table(self, id: int):
        return db.session.query(SqlaTable).filter_by(id=id).first()

    def _create_column_list(self, columns):
        column_list = []
        for column in columns:
            if column:
                column_list.append(column)
        return ", ".join(filter(None, column_list))

    def _add_lat_lon_columns(
        self, table_id: int, lat_column: str = None, lon_column: str = None
    ):
        """
        Add new longitude and latitude columns to table
        :param table_name: The table name of table to insert columns
        :param lat_column: The name of latitude column
        :param lon_column: The name of longitude column
        :raise SqlAddColumnException: When add column-SQL went wrong
        """
        table = self._get_table(table_id)
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
        type = column.type.compile(db.engine.dialect)
        sql = text(
            "ALTER TABLE %s ADD %s %s" % (self._get_from_clause(table), name, type)
        )
        connection.execute(sql)

        table.columns.append(TableColumn(column_name=column_name, type=type))

    def _insert_geocoded_data(
        self, table_id: int, lat_column: str, lon_column: str, geo_columns: list, data
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

        table = self._get_table(table_id)
        connection = table.database.get_sqla_engine().connect()
        transaction = connection.begin()
        try:
            for row in data:
                update = "UPDATE %s SET %s=%s, %s=%s " % (
                    self._get_from_clause(table),
                    lat_column,
                    row[number_of_columns],
                    lon_column,
                    row[number_of_columns + 1],
                )
                where = "WHERE " + where_clause % (tuple(row[:number_of_columns]))
                sql = update + where
                connection.execute(text(sql))
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
