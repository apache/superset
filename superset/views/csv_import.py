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
import os
from sqlite3 import OperationalError

import simplejson as json
import sqlalchemy
import sqlalchemy_utils
from flask import flash, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __, lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError, IntegrityError
from sqlalchemy_utils import EncryptedType
from werkzeug.utils import secure_filename

import superset.models.core as models
from superset import app, appbuilder, conf, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import (
    DatabaseCreationException,
    InvalidURIException,
    NoPasswordSuppliedException,
    NoUsernameSuppliedException,
    TableCreationException,
)
from superset.utils import core as utils
from superset.views.database import sqlalchemy_uri_validator

from .base import api, BaseSupersetView, json_error_response, json_success

config = app.config
stats_logger = config["STATS_LOGGER"]


class CsvImporter(BaseSupersetView):
    """The base views for CSV-Importer!"""

    @has_access
    @expose("/csvtodatabase")
    def csvtodatabase(self):
        session = db.session()
        Database = models.Database
        databases = session.query(Database).filter_by(allow_csv_upload=True).all()
        databases_json = [models.DatabaseDto(-1, "In a new database")]
        for database in databases:
            databases_json.append(models.DatabaseDto(database.id, database.name))

        bootstrap_data = {
            "databases": databases_json,
            "common": self.common_bootstrap_payload(),
        }

        if request.args.get("json") == "true":
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
        form_data = request.form
        csv_file = request.files["file"]
        csv_filename = secure_filename(csv_file.filename)
        if len(csv_filename) == 0:
            return json_error_response("Filename is not allowed", status=400)
        database_id = form_data["connectionId"]
        # check for possible SQL-injection, filter_by does not sanitize the input therefore we have to check
        # this beforehand
        try:
            database_id = int(database_id)
        except ValueError:
            message = _(
                "Possible tampering detected, non-numeral character in database-id"
            )
            return json_error_response(message, status=400)

        try:
            if database_id != -1:
                schema = form_data["schema"] or None
                database = self._get_existing_database(database_id, schema)
                db_name = database.database_name
            else:
                if not form_data["databaseName"]:
                    return json_error_response("No database name received", status=400)
                db_name = form_data["databaseName"]
                db_name = secure_filename(db_name)
                if len(db_name) == 0:
                    return json_error_response(
                        "Database name is not allowed", status=400
                    )
                db_flavor = form_data["databaseFlavor"] or None
                database = self._create_database(db_name, db_flavor)
        except ValueError as e:
            return json_error_response(e.args[0], status=400)
        except DatabaseCreationException as e:
            return json_error_response(e.args[0], status=400)
        except NoUsernameSuppliedException as e:
            return json_error_response(e.args[0], status=400)
        except NoPasswordSuppliedException as e:
            return json_error_response(e.args[0], status=400)
        except InvalidURIException as e:
            return json_error_response(e.args[0], status=400)
        except Exception as e:
            return json_error_response(e.args[0], status=500)

        try:
            path = self._check_and_save_csv(csv_file, csv_filename)
            self._create_table(form_data, database, csv_filename)
        except Exception as e:
            if isinstance(e, TableCreationException):
                message = e.args[0]
            try:
                os.remove(os.getcwd() + "/" + db_name + ".db")
            except OSError:
                pass
            try:
                if database_id == -1:
                    db.session.rollback()
                    db.session.delete(database)
                    db.session.commit()
            except Exception:
                pass
            if hasattr(e, "orig"):
                # pylint: disable=no-member
                if isinstance(e.orig, IntegrityError):  # type: ignore
                    message = "Table {0} could not be created".format(
                        form_data["tableName"]
                    )
                # pylint: disable:no-member
                elif isinstance(e.orig, OperationalError):  # type: ignore
                    message = _(
                        "Table {0} could not be created. This could be an issue with the schema, a connection "
                        "issue, etc.".format(form_data["tableName"])
                    )
                else:
                    message = str(e)
            else:
                message = str(e)
            return json_error_response(message, status=400)
        finally:
            try:
                os.remove(path)
            except OSError:
                pass

        stats_logger.incr("successful_csv_upload")
        message = "{} imported into database {}".format(form_data["tableName"], db_name)
        flash(message, "success")
        return json_success(
            '"{} imported into database {}"'.format(form_data["tableName"], db_name)
        )

    def _create_database(self, db_name: str, db_flavor="sqlite"):
        """ Creates the Database itself as well as the Superset Connection to it

        Keyword arguments:
        db_name -- the name for the database to be created
        db_flavor -- which database to use postgres or sqlite

        Raises:
            ValueError: If a file with the database name already exists in the folder
            NoUserSuppliedException: If the user did not supply a username
            NoPasswordSuppliedException: If the user did not supply a password
            Exception: If the Database could not be created
        """
        if db_flavor == "postgres":
            # TODO add possibility to use schema

            postgres_user = conf["POSTGRES_USERNAME"]
            postgres_password = conf["POSTGRES_PASSWORD"]

            if not postgres_user:
                raise NoUsernameSuppliedException("No username supplied for PostgreSQL")
            if not postgres_password:
                raise NoPasswordSuppliedException("No password supplied for PostgreSQL")
            url = (
                "postgresql://"
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
            try:
                url2 = make_url(url)

            except (ArgumentError, AttributeError):
                raise InvalidURIException(
                    "Invalid URI. Username, password or database-name lead to an error"
                )
            engine = sqlalchemy.create_engine(url2)
            if not sqlalchemy_utils.database_exists(engine.url):
                sqlalchemy_utils.create_database(engine.url)
            else:
                raise DatabaseCreationException(
                    "The database {0} already exist".format(db_name)
                )

            try:
                encpass = EncryptedType(postgres_password, conf["SECRET_KEY"])
                item = SQLAInterface(models.Database).obj()
                item.database_name = db_name
                item.sqlalchemy_uri = enurl  # engine.url
                item.password = postgres_password
                item.allow_csv_upload = True
                db.session.add(item)
                db.session.commit()
            except Exception as e:
                stats_logger.incr("failed_csv_upload")
                raise e

            return item
        else:
            db_path = os.getcwd() + "/" + db_name + ".db"
            if os.path.isfile(db_path):
                message = "Database file for {0} already exists, please choose a different name".format(
                    db_name
                )
                raise ValueError(message)
            try:
                item = SQLAInterface(models.Database).obj()
                item.database_name = db_name
                item.sqlalchemy_uri = "sqlite:///" + db_path
                item.allow_csv_upload = True
                # TODO check if SQL-injection is possible through add()
                db.session.add(item)
                db.session.commit()
                return item
            except Exception as e:
                exception = e
                if isinstance(e, IntegrityError):
                    message = "Error when trying to create Database"
                    exception = DatabaseCreationException(message)
                try:
                    if os.path.isfile(db_path):
                        os.remove(db_path)
                    db.session.delete(item)
                    db.session.commit()
                except OSError:
                    message = _(
                        "Error when trying to create Database.The database file {0}.db could not be removed. "
                        "Please contact your administrator to remove it manually".format(
                            db_name
                        )
                    )
                    exception = DatabaseCreationException(message)
                    pass
                except Exception:
                    pass
                stats_logger.incr("failed_csv_upload")
                raise exception

    def _get_existing_database(self, database_id: int, schema):
        """Returns the database object for an existing database

        Keyword arguments:
        database_id -- the ID used to identify the database
        schema -- the schema to be used

        Raises:
            ValueError: 1. If the schema is not allowed for csv upload
                        2. If the database ID is not valid
                        3. If there was a problem getting the schema
        """
        try:
            database = db.session.query(models.Database).filter_by(id=database_id).one()
            if not self._is_schema_allowed(database, schema):
                message = _(
                    "Database {0} Schema {1} is not allowed for csv uploads. "
                    "Please contact your Superset administrator".format(
                        database.database_name, schema
                    )
                )
                raise ValueError(message)
            return database
        except ValueError as e:
            message = _("No row was found for one")
            raise ValueError(message)
        except Exception as e:
            raise ValueError(e.args[0])

    def _is_schema_allowed(self, database: models.Database, schema: str) -> bool:
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
            OSError: 1. If the upload folder does not exist
                     2. If the csv-file could not be saved
        """
        path = os.path.join(config["UPLOAD_FOLDER"], csv_filename)
        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            csv_file.save(path)
        except Exception:
            os.remove(path)
            raise OSError("Could not save CSV-file, does the upload folder exist?")
        return path

    def _create_table(
        self, form_data: dict, database: models.Database, csv_filename: str
    ) -> None:
        """ Create the Table itself and fill it with the data from the csv file

        Keyword arguments:
        form_data -- the dictionary containing the properties for the Table to be created
        database -- the database object which will be used
        csv_filename -- the name of the csv-file to be imported

        Raises:
            Exception:  1. If the Table object could not be created
                        2. If the Table could not be created in the database
                        3. If the data could not be inserted into the table
        """

        try:
            if (
                db.session.query(SqlaTable)
                .filter_by(table_name=form_data["tableName"])
                .one_or_none()
            ):
                message = _(
                    "Table name {0} already exists. Please choose another".format(
                        form_data["tableName"]
                    )
                )
                raise TableCreationException(message)

            table = SqlaTable(table_name=form_data["tableName"])
            table.database = database
            table.database_id = table.database.id
            table.database.db_engine_spec.create_and_fill_table_from_csv(
                form_data, table, csv_filename, database
            )
        except Exception as e:
            raise e


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
