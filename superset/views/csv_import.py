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
import os
from distutils.util import strtobool

import simplejson as json
import sqlalchemy
import sqlalchemy_utils
from flask import flash, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import MultipleResultsFound, NoResultFound
from werkzeug.utils import secure_filename

import superset.models.core as models
from superset import app, appbuilder, conf, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import (
    ConversionException,
    DatabaseAlreadyExist,
    DatabaseCreationException,
    DatabaseDeletionException,
    FileSaveException,
    NameNotAllowed,
    NoPasswordSuppliedException,
    NoUsernameSuppliedException,
    SchemaException,
    SchemaNotAllowedCsvUpload,
    TableCreationException,
)
from superset.utils import core as utils

from .base import api, BaseSupersetView, json_error_response, json_success

STATS_LOGGER = app.config["STATS_LOGGER"]
LOGGER = logging.getLogger(__name__)
UPLOAD_FOLDER = app.config["UPLOAD_FOLDER"]
BAD_REQUEST = 400
NEW_DATABASE_ID = -1
SQLALCHEMY_SQLITE_CONNECTION = "sqlite:///"
SQLALCHEMY_POSTGRES_CONNECTION = "postgresql://"
SQLITE = "sqlite"
POSTGRES = "postgres"


class CsvImporter(BaseSupersetView):
    """The base views for CSV-Importer!"""

    @has_access
    @expose("/csvtodatabase")
    def csvtodatabase(self):
        """ Create CSV-Form
        :return: json or react html form with databases and common bootstrap
        """
        bootstrap_data = {
            "databases": self.allow_csv_upload_databases(),
            "common": self.common_bootstrap_payload(),
        }

        if strtobool(request.args.get("json", "False")):
            return json_success(
                json.dumps(bootstrap_data, default=lambda x: x.__dict__)
            )

        return self.render_template(
            "superset/csv_to_database.html",
            entry="csvToDatabase",
            standalone_mode=False,
            title="CSV to Database configuration",
            bootstrap_data=json.dumps(bootstrap_data, default=lambda x: x.__dict__),
        )

    def allow_csv_upload_databases(self) -> list:
        """ Get all databases which allow csv upload as database dto
        :returns list of database dto
        """
        databases = (
            db.session().query(models.Database).filter_by(allow_csv_upload=True).all()
        )
        databases_json = [models.DatabaseDto(NEW_DATABASE_ID, "In a new database", [])]
        for database in databases:
            databases_json.append(
                models.DatabaseDto(
                    database.id,
                    database.name,
                    json.loads(database.extra)["schemas_allowed_for_csv_upload"],
                )
            )
        return databases_json

    @api
    @has_access_api
    @expose("/csvtodatabase/add", methods=["POST"])
    def add(self) -> Response:
        """ import a csv into a Table

        Handles the logic for importing the csv into a Table in a given or newly created Database
        returns HTTP Status Codes (200 for ok, 400 for errors)
        Request body contains multipart/form-data
        Form content:
        form -- contains the properties for the table to be created
        file -- csv file to be imported
        """
        # TODO check for possible SQL-injection, filter_by does not sanitize the input therefore we have to check
        # this beforehand
        try:
            form_data = request.form
            csv_file = request.files["file"]
            csv_path = None
            csv_filename = self._clean_filename(csv_file.filename, "CSV")
            database = None
            db_flavor = form_data.get("databaseFlavor") or None
            database_id = self._convert_database_id(form_data.get("connectionId"))
            table_name = form_data.get("tableName", "")
            self._check_table_name(table_name)

            if database_id != NEW_DATABASE_ID:
                database = self._get_existing_database(
                    database_id, form_data.get("schema") or None
                )
                db_name = database.database_name
            else:
                db_name = self._clean_filename(
                    form_data.get("databaseName", ""), "database"
                )
                database = self._create_database(db_name, db_flavor)

            table = self._create_table(table_name, database)

            csv_path = self._check_and_save_csv(csv_file, csv_filename)
            self._fill_table(form_data, table, csv_filename)
        except (
            NameNotAllowed,
            ConversionException,
            DatabaseAlreadyExist,
            SchemaNotAllowedCsvUpload,
            NoResultFound,
            MultipleResultsFound,
            SchemaException,
            FileSaveException,
            NoUsernameSuppliedException,
            NoPasswordSuppliedException,
        ) as e:
            LOGGER.exception(f"Failed prepare CSV import {e.orig}")
            STATS_LOGGER.incr("failed_csv_upload")
            return json_error_response(e.args[0], status=BAD_REQUEST)
        except (DatabaseCreationException, TableCreationException) as e:
            LOGGER.exception(f"Failed import CSV {e.orig}")
            STATS_LOGGER.incr("failed_csv_upload")
            if NEW_DATABASE_ID == database_id:
                self._remove_database(database, db_flavor)
            return json_error_response(e.args[0], status=BAD_REQUEST)
        except DatabaseDeletionException as e:
            LOGGER.exception(f"Failed delete Database {e.orig}")
            STATS_LOGGER.incr("failed_csv_upload")
            return json_error_response(e.args[0])
        except (Exception) as e:
            LOGGER.exception(f"Unexpected error {e}")
            STATS_LOGGER.incr("failed_csv_upload")
            return json_error_response(e.args[0])
        finally:
            try:
                if csv_path:
                    os.remove(csv_path)
            except OSError:
                pass

        STATS_LOGGER.incr("successful_csv_upload")
        message = '"{} imported into database {}"'.format(table_name, db_name)
        flash(message, "success")
        return json_success(message)

    def _clean_filename(self, filename: str, purpose: str) -> str:
        """ Clean filename from disallowed characters
        :param filename: the name of the file to clean
        :param purpose: the purpose to give a clear error message
        :return: filename with allowed characters
        """
        if not filename:
            raise NameNotAllowed("No name is received for {0}".format(purpose), None)
        cleaned_filename = secure_filename(filename)
        if len(cleaned_filename) == 0:
            raise NameNotAllowed(
                "Name {0} is not allowed for {1}".format(filename, purpose), None
            )
        return cleaned_filename

    def _convert_database_id(self, database_id) -> int:
        """ Convert database id from string to int
        :param database_id: The database id to convert
        :return: database id as integer
        """
        try:
            return int(database_id)
        except ValueError as e:
            message = _(
                "Possible tampering detected, non-numeral character in database-id"
            )
            raise ConversionException(message, e)

    def _check_table_name(self, table_name: str) -> bool:
        """ Check if table name is alredy in use
        :param table_name: the name of the table to check
        :return: False if table name is not in use or otherwise TableNameInUseException
        """
        if db.session.query(SqlaTable).filter_by(table_name=table_name).one_or_none():
            message = _(
                "Table name {0} already exists. Please choose another".format(
                    table_name
                )
            )
            raise NameNotAllowed(message, None)
        return False

    def _create_database(self, db_name: str, db_flavor=SQLITE) -> models.Database:
        """ Creates the Database itself as well as the Superset Connection to it

        Keyword arguments:
        db_name -- the name for the database to be created
        db_flavor -- which database to use postgres or sqlite

        Raises:
            ConversionException: If a file with the database name already exists in the folder
            NoUserSuppliedException: If the user did not supply a username
            NoPasswordSuppliedException: If the user did not supply a password
            DatabaseCreationException: If the database could not be created
        """

        database = SQLAInterface(models.Database).obj()
        database.database_name = db_name
        database.allow_csv_upload = True

        if db_flavor == POSTGRES:
            self._setup_postgres_database(db_name, database)
        else:
            self._setup_sqlite(db_name, database)
        try:
            # TODO check if SQL-injection is possible through add()
            db.session.add(database)
            db.session.commit()
            return database
        except IntegrityError as e:
            raise DatabaseCreationException("Error when trying to create Database", e)
        except Exception as e:
            self._remove_database(database, db_flavor)
            raise DatabaseCreationException(e.args[0], e)

    def _setup_postgres_database(self, db_name, database) -> None:
        """ Setup PostgreSQL specific configuration on database
        :param db_name: the database name of SQLite
        :param database: the database object to configure
        """
        # TODO add possibility to use schema

        postgres_user = conf["POSTGRES_USERNAME"]
        if not postgres_user:
            raise NoUsernameSuppliedException(
                "No username supplied for PostgreSQL", None
            )
        postgres_password = conf["POSTGRES_PASSWORD"]
        if not postgres_password:
            raise NoPasswordSuppliedException(
                "No password supplied for PostgreSQL", None
            )

        url = (
            SQLALCHEMY_POSTGRES_CONNECTION
            + postgres_user
            + ":"
            + postgres_password
            + "@localhost/"
            + db_name
        )
        enurl = (
            "postgresql://"
            + postgres_user
            + ":"
            + "XXXXXXXXXX"
            + "@localhost/"
            + db_name
        )
        engine = sqlalchemy.create_engine(url)
        if not sqlalchemy_utils.database_exists(engine.url):
            sqlalchemy_utils.create_database(engine.url)
        else:
            raise DatabaseCreationException(
                "The database {0} already exist".format(db_name), None
            )

        database.sqlalchemy_uri = enurl
        database.password = postgres_password

    def _setup_sqlite(self, db_name, database) -> None:
        """ Set SQlite specific configuration on database
        :param db_name: the database name of SQLite
        :param database: the database object to configure
        """
        db_path = os.getcwd() + "/" + db_name + ".db"
        if os.path.isfile(db_path):
            message = "Database file for {0} already exists, please choose a different name".format(
                db_name
            )
            raise DatabaseAlreadyExist(message, None)
        database.sqlalchemy_uri = SQLALCHEMY_SQLITE_CONNECTION + db_path

    def _remove_database(self, database, db_flavor=SQLITE):
        """Remove database in an exception case
        :param database: the database to remove
        :param db_flavor: the kind of database
        """
        try:
            if database:
                if db_flavor == SQLITE:
                    db_path = database.sqlalchemy_uri.replace(
                        SQLALCHEMY_SQLITE_CONNECTION, ""
                    )
                    if os.path.isfile(db_path):
                        os.remove(db_path)
                db.session.rollback()
                db.session.delete(database)
                db.session.commit()
        except Exception as e:
            message = _(
                "Error when trying to create database {0}.The database could not be removed. "
                "Please contact your administrator to remove it manually".format(
                    database.database_name
                )
            )
            raise DatabaseDeletionException(message, e)

    def _get_existing_database(self, database_id: int, schema=None) -> models.Database:
        """Returns the database object for an existing database

        Keyword arguments:
        database_id -- the ID used to identify the database
        schema -- the schema to be used

        Raises:
            SchemaException: 1. If the schema is not allowed for csv upload
                             2. If the database ID is not valid
                             3. If there was a problem getting the schema
            NoResultFound: If no database found with id
            MultipleResultsFound: If more than one database found with id
        """
        try:
            database = db.session.query(models.Database).filter_by(id=database_id).one()
            if not self._is_schema_allowed_for_csv_upload(database, schema):
                message = _(
                    "Database {0} Schema {1} is not allowed for csv uploads. "
                    "Please contact your Superset administrator".format(
                        database.database_name, schema
                    )
                )
                raise SchemaNotAllowedCsvUpload(message, None)
            return database
        except NoResultFound as e:
            raise NoResultFound(
                "No database was found with id {}".format(database_id), e
            )
        except MultipleResultsFound as e:
            raise MultipleResultsFound(
                "Multiple databases were found with id {}".format(database_id), e
            )
        except Exception as e:
            raise SchemaException(e.args[0], e)

    def _is_schema_allowed_for_csv_upload(
        self, database: models.Database, schema: str
    ) -> bool:
        """ Checks whether the specified schema is allowed for csv-uploads

        Keyword Arguments:
        database -- The database object which will be used for the import
        schema -- the schema to be used for the import
        """
        if not database.allow_csv_upload:
            return False
        schemas = database.get_schema_access_for_csv_upload()
        if schemas:
            return schema in schemas
        return (
            security_manager.database_access(database)
            or security_manager.all_datasource_access()
        )

    def _check_and_save_csv(self, csv_file, csv_filename: str) -> str:
        """ Sanitizes the filename and saves the csv-file to disk

        Keyword arguments:
        csv_file -- the file which will be saved to disk
        csv_filename -- the filename to be sanitized which will be used

        Raises:
            FileSaveException: 1. If the upload folder does not exist
                     2. If the csv-file could not be saved
        """
        path = os.path.join(UPLOAD_FOLDER, csv_filename)
        try:
            utils.ensure_path_exists(UPLOAD_FOLDER)
            csv_file.save(path)
        except Exception as e:
            os.remove(path)
            raise FileSaveException(
                "Could not save CSV-file, does the upload folder exist?", e
            )
        return path

    def _create_table(self, table_name: str, database: models.Database) -> SqlaTable:
        """ Create the Table itself

        Keyword arguments:
        table_name -- the name of the table to create
        database -- the database object which will be used

        Raises:
            TableCreationException:  1. If the Table object could not be created
                                     2. If the Table could not be created in the database
        """

        try:
            table = SqlaTable(table_name=table_name)
            table.database = database
            table.database_id = table.database.id
            return table
        except Exception as e:
            raise TableCreationException(
                "Table {0} could not be created.".format(table_name), e
            )

    def _fill_table(self, form_data: dict, table: SqlaTable, csv_filename: str) -> None:
        """ Fill the table with the data from the csv file

        Keyword arguments:
        form_data -- the dictionary containing the properties for the table to be created
        table -- the table object which will be used
        csv_filename -- the name of the csv-file to be imported

        Raises:
            TableCreationException:  If the data could not be inserted into the table
        """

        try:
            table.database.db_engine_spec.create_and_fill_table_from_csv(
                form_data, table, csv_filename, table.database
            )
        except Exception as e:
            raise TableCreationException(
                "Table {0} could not be filled with CSV {1}. This could be an issue with the schema, a connection "
                "issue, etc.".format(form_data.get("tableName"), csv_filename),
                e,
            )


appbuilder.add_view_no_menu(CsvImporter)

appbuilder.add_link(
    "Upload a CSV",
    label=__("Upload a CSV"),
    href="/csvimporter/csvtodatabase",
    icon="fa-upload",
    category="Sources",
    category_label=__("Sources"),
    category_icon="fa-wrench",
)

appbuilder.add_separator("Sources")
