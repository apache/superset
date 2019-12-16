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
from typing import Tuple

import simplejson as json
import sqlalchemy
import sqlalchemy_utils
from flask import flash, g, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import MultipleResultsFound, NoResultFound
from werkzeug.utils import secure_filename

from superset import app, appbuilder, conf, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import (
    CsvException,
    DatabaseAlreadyExistException,
    DatabaseCreationException,
    DatabaseDeletionException,
    DatabaseFileAlreadyExistsException,
    FileSaveException,
    GetDatabaseException,
    NameNotAllowedException,
    NoPasswordSuppliedException,
    NoUsernameSuppliedException,
    SchemaNotAllowedCsvUploadException,
    TableCreationException,
)
from superset.models.core import Database, DatabaseDto
from superset.utils import core as utils

from .base import api, BaseSupersetView, json_error_response, json_success

STATS_LOGGER = app.config["STATS_LOGGER"]
LOGGER = logging.getLogger(__name__)
UPLOAD_FOLDER = app.config["UPLOAD_FOLDER"]
BAD_REQUEST = 400
NEW_DATABASE_ID = -1
SQLALCHEMY_SQLITE_CONNECTION = "sqlite:///"
SQLALCHEMY_POSTGRESQL_CONNECTION = "postgresql://"
SQLITE = "sqlite"
POSTGRESQL = "postgresql"


class CsvImporter(BaseSupersetView):
    """The base views for CSV-Importer!"""

    @has_access
    @expose("/csvtodatabase")
    def csvtodatabase(self):
        """ Create CSV-Form
        :return: json or react html form with databases and common bootstrap
        ---

        """
        bootstrap_data = {
            "databases": self._allow_csv_upload_databases(),
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

    def _allow_csv_upload_databases(self) -> list:
        """ Get all databases which allow csv upload as database dto
        :returns list of database dto
        """
        databases = db.session().query(Database).filter_by(allow_csv_upload=True).all()
        permitted_databases: list = []
        for database in databases:
            if security_manager.database_access(database):
                permitted_databases.append(database)

        databases_json = [DatabaseDto(NEW_DATABASE_ID, "In a new database", [])]
        for database in permitted_databases:
            databases_json.append(
                DatabaseDto(
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
        try:
            form_data = request.form
            csv_file = request.files["file"]
            csv_path = None
            csv_filename = self._clean_name(csv_file.filename, "CSV")
            database = None
            db_flavor = form_data.get("databaseFlavor", SQLITE)
            database_id = self._convert_database_id(form_data.get("connectionId"))
            table_name = self._clean_name(form_data.get("tableName", ""), "Table")
            self._check_table_name(table_name)

            if database_id != NEW_DATABASE_ID:
                database = self._get_existing_database(
                    database_id, form_data.get("schema") or None
                )
                db_name = database.database_name
            else:
                db_name = self._clean_name(
                    form_data.get("databaseName", ""), "database"
                )
                database, db_uri = self._create_database(db_name, db_flavor)

            table = self._create_table(table_name, database)

            csv_path = self._check_and_save_csv(csv_file, csv_filename)
            self._fill_table(form_data, table, csv_filename)
        except (
            NameNotAllowedException,
            DatabaseFileAlreadyExistsException,
            DatabaseAlreadyExistException,
            SchemaNotAllowedCsvUploadException,
            NoResultFound,
            MultipleResultsFound,
            GetDatabaseException,
            FileSaveException,
            NoUsernameSuppliedException,
            NoPasswordSuppliedException,
        ) as e:
            LOGGER.exception(f"Failed to prepare CSV import {e.orig}")
            STATS_LOGGER.incr("csv_upload_failed")
            return json_error_response(e.args[0], status=BAD_REQUEST)
        except (DatabaseCreationException, TableCreationException) as e:
            LOGGER.exception(f"Failed to import CSV {e.orig}")
            STATS_LOGGER.incr("csv_upload_failed")
            if NEW_DATABASE_ID == database_id:
                self._remove_database(database, db_uri, db_flavor)
            return json_error_response(e.args[0], status=BAD_REQUEST)
        except DatabaseDeletionException as e:
            LOGGER.exception(f"Failed to delete Database {e.orig}")
            STATS_LOGGER.incr("csv_upload_failed")
            return json_error_response(e.args[0])
        except Exception as e:
            LOGGER.exception(f"Unexpected error {e}")
            STATS_LOGGER.incr("csv_upload_failed")
            return json_error_response('"An unknown error occurred!"')
        finally:
            try:
                if csv_path:
                    os.remove(csv_path)
            except OSError:
                pass

        STATS_LOGGER.incr("csv_upload_successful")
        flash(f"{table_name} imported into database {db_name}", "success")
        return json_success('"OK"')

    def _clean_name(self, name: str, purpose: str) -> str:
        """ Clean filename from disallowed characters
        :param name: the name of the file to clean
        :param purpose: the purpose to give a clear error message
        :return: filename with allowed characters
        """
        if not name:
            raise NameNotAllowedException(f"No filename received for {purpose}", None)
        cleaned_name = secure_filename(name)
        if len(cleaned_name) == 0:
            raise NameNotAllowedException(
                f"Name {name} is not allowed for {purpose}", None
            )
        return cleaned_name

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
            raise DatabaseFileAlreadyExistsException(message, e)

    def _check_table_name(self, table_name: str) -> None:
        """ Check if table name is alredy in use
        :param table_name: the name of the table to check
        :return: False if table name is not in use or otherwise TableNameInUseException
        """
        if db.session.query(SqlaTable).filter_by(table_name=table_name).one_or_none():
            message = _(
                f"Table name {table_name} already exists. Please choose another"
            )
            raise NameNotAllowedException(message, None)

    def _create_database(self, db_name: str, db_flavor: str) -> Tuple[Database, str]:
        """ Creates the Database itself as well as the Superset Connection to it

        Keyword arguments:
        db_name -- the name for the database to be created
        db_flavor -- which database to use postgres or sqlite

        Raises:
            DatabaseFileAlreadyExistsException: If a file with the database name already exists in the folder
            NoUserSuppliedException: If the user did not supply a username
            NoPasswordSuppliedException: If the user did not supply a password
            DatabaseCreationException: If the database could not be created
        """
        database = SQLAInterface(Database).obj()
        database.database_name = db_name
        database.allow_csv_upload = True

        try:
            if db_flavor == POSTGRESQL:
                uri = self._setup_postgresql_database(db_name, database)
            else:
                uri = self._setup_sqlite_database(db_name, database)
            # TODO check if SQL-injection is possible through add()
            db.session.add(database)
            db.session.commit()
            return database, uri
        except DatabaseAlreadyExistException as e:
            raise DatabaseAlreadyExistException(e.args[0], e)
        except IntegrityError as e:
            raise DatabaseCreationException("Error when trying to create Database", e)
        except Exception as e:
            raise DatabaseCreationException(
                "An unknown error occurred trying to create the database.", e
            )

    def _setup_postgresql_database(self, db_name: str, database: Database) -> str:
        """ Setup PostgreSQL specific configuration on database
        :param db_name: the database name of SQLite
        :param database: the database object to configure
        :return PostgreSQL url
        """
        postgresql_user = conf["POSTGRESQL_USERNAME"]
        if not postgresql_user:
            raise NoUsernameSuppliedException(
                "No username supplied for PostgreSQL", None
            )
        postgresql_password = conf["POSTGRESQL_PASSWORD"]
        if not postgresql_password:
            raise NoPasswordSuppliedException(
                "No password supplied for PostgreSQL", None
            )

        url = (
            SQLALCHEMY_POSTGRESQL_CONNECTION
            + postgresql_user
            + ":"
            + postgresql_password
            + "@localhost/"
            + db_name
        )
        enurl = (
            "postgresql://"
            + postgresql_user
            + ":"
            + "XXXXXXXXXX"
            + "@localhost/"
            + db_name
        )
        engine = sqlalchemy.create_engine(url)
        if not sqlalchemy_utils.database_exists(engine.url):
            sqlalchemy_utils.create_database(engine.url)
        else:
            raise DatabaseAlreadyExistException(
                f"The database {db_name} already exists", None
            )

        database.sqlalchemy_uri = enurl
        database.password = postgresql_password
        return url

    def _setup_sqlite_database(self, db_name: str, database: Database) -> str:
        """ Set SQlite specific configuration on database
        :param db_name: the database name of SQLite
        :param database: the database object to configure
        :return SQLite db file path
        """
        db_path = os.getcwd() + "/" + db_name + ".db"
        if os.path.isfile(db_path):
            message = f"Database file for {db_name} already exists, please choose a different name"
            raise DatabaseAlreadyExistException(message, None)
        database.sqlalchemy_uri = SQLALCHEMY_SQLITE_CONNECTION + db_path
        return db_path

    def _remove_database(self, database, db_uri, db_flavor: str) -> None:
        """Remove database in an exception case
        :param database: the database to remove
        :param db_uri: the uri of database (URL or file path)
        :param db_flavor: the kind of database
        """
        try:
            if db_uri:
                if db_flavor == SQLITE:
                    if os.path.isfile(db_uri):
                        os.remove(db_uri)
                elif db_flavor == POSTGRESQL:
                    if sqlalchemy_utils.database_exists(db_uri):
                        sqlalchemy_utils.drop_database(db_uri)

            if database:
                db.session.rollback()
                db.session.delete(database)
                db.session.commit()
        except Exception as e:
            message = _(
                f"Error when trying to create database {database.database_name}.The database could not be removed. "
                "Please contact your administrator to remove it manually."
            )
            raise DatabaseDeletionException(message, e)

    def _get_existing_database(self, database_id: int, schema: str = None) -> Database:
        """Returns the database object for an existing database

        Keyword arguments:
        database_id -- the ID used to identify the database
        schema -- the schema to be used

        Raises:
            SchemaNotAllowedCsvUploadException: If the schema is not allowed for csv upload
            GetDatabaseException:    1. If the database ID is not valid
                                     2. If there was a problem getting the schema
            NoResultFound: If no database found with id
            MultipleResultsFound: If more than one database found with id
        """
        try:
            database = db.session.query(Database).filter_by(id=database_id).one()
            if not self._is_schema_allowed_for_csv_upload(database, schema):
                message = _(
                    f"Database {database.database_name} Schema {schema} is not allowed for csv uploads. "
                    "Please contact your Superset administrator."
                )
                raise SchemaNotAllowedCsvUploadException(message, None)
            return database
        except NoResultFound as e:
            raise NoResultFound("Database was not found.", e)
        except MultipleResultsFound as e:
            raise MultipleResultsFound("Multiple databases were found.", e)
        except SchemaNotAllowedCsvUploadException as e:
            raise e
        except Exception as e:
            raise GetDatabaseException(
                "An unknown error occurred trying to get the database.", e
            )

    def _is_schema_allowed_for_csv_upload(
        self, database: Database, schema: str = None
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

    def _create_table(self, table_name: str, database: Database) -> SqlaTable:
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
            raise TableCreationException(f"Table {table_name} could not be created.", e)

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
                f"Table {form_data.get('tableName')} could not be filled with CSV {csv_filename}. "
                "This could be an issue with the schema, a connection issue, etc.",
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
