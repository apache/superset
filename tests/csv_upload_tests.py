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
"""Unit tests for CSV Upload"""
import os
import unittest

import sqlalchemy_utils
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.datastructures import FileStorage

import superset.models.core as models
from superset import conf, db
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import (
    DatabaseCreationException,
    NameNotAllowed,
    NoPasswordSuppliedException,
    NoUsernameSuppliedException,
    TableCreationException,
)
from superset.utils import core as utils
from superset.views.csv_import import CsvImporter

from .base_tests import SupersetTestCase

NEW_DATABASE_ID = -1
SQLITE = "sqlite"
POSTGRES = "postgres"


class CsvUploadTests(SupersetTestCase):
    importer = CsvImporter()

    def __init__(self, *args, **kwargs):
        super(CsvUploadTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()

    def tearDown(self):
        self.logout()

    def create_csv_file(self, filename):
        test_file = open(filename, "w+")
        test_file.write("name,age\n")
        test_file.write("john,35\n")
        test_file.write("paul,47\n")
        test_file.close()
        test_file = open(filename, "rb")
        return test_file

    def get_existing_db_id(self):
        example_db = utils.get_example_database()
        example_db.allow_csv_upload = True
        db.session.commit()
        return example_db.id

    def get_full_data(
        self,
        filename,
        database_id,
        database_name="",
        table_name="",
        schema="",
        database_flavor=SQLITE,
    ):
        form_data = {
            "file": self.create_csv_file(filename),
            "connectionId": database_id,
            "databaseName": database_name,
            "databaseFlavor": database_flavor,
            "schema": schema,
            "tableName": table_name,
            "delimiter": ",",
            "ifTableExists": "Fail",
            "headerRow": "0",
            "decimalCharacter": ".",
            "indexColumn": "",
            "mangleDuplicateColumns": "True",
            "skipInitialSpace": "True",
            "skipRows": "0",
            "rowsToRead": "3",
            "skipBlankLines": "True",
            "parseDates": "",
            "inferDatetimeFormat": "True",
            "dataframeIndex": "False",
            "columnLabels": "",
        }
        return form_data

    def test_menu_entry_upload_csv_exist(self):
        url = "/databaseview/list/"
        add_datasource_page = self.get_resp(url)
        assert "Upload a CSV" in add_datasource_page

    def test_upload_csv_view_load(self):
        url = "/csvimporter/csvtodatabase"
        form_get = self.get_resp(url)
        assert "CSV to Database configuration" in form_get

    def test_import_into_existing_sqlite(self):
        url = "/csvimporter/csvtodatabase/add"
        filename = "in_existing.csv"
        table_name = "in_existing"
        try:
            form_data = self.get_full_data(
                filename, self.get_existing_db_id(), table_name=table_name
            )
            response = self.get_resp(url, data=form_data)
            assert "imported into database" in response
        finally:
            os.remove(filename)

    def test_import_into_new_sqlite(self):
        url = "/csvimporter/csvtodatabase/add"
        filename = "maximum_into_new.csv"
        db_name = "new_sqlite_database"
        table_name = "import_maximum_into_new"
        try:
            form_data = self.get_full_data(
                filename, NEW_DATABASE_ID, db_name, table_name
            )
            response = self.get_resp(url, data=form_data)
            message = "{0} imported into database {1}".format(table_name, db_name)
            assert message in response
        finally:
            os.remove(filename)
            os.remove(os.getcwd() + "/" + db_name + ".db")

    @unittest.skipIf(
        "mysql" in conf.get("SQLALCHEMY_DATABASE_URI", "")
        or SQLITE in conf.get("SQLALCHEMY_DATABASE_URI", ""),
        "This test only run when a PostgreSQL database exist",
    )
    def test_import_into_new_postgres(self):
        url = "/csvimporter/csvtodatabase/add"
        filename = "into_new_postgres.csv"
        db_name = "csv_into_new_postgres_db"
        table_name = "newlyimported_into_postgres"
        form_data = self.get_full_data(
            filename, NEW_DATABASE_ID, db_name, table_name, database_flavor=POSTGRES
        )
        conf["POSTGRES_USERNAME"] = POSTGRES
        conf["POSTGRES_PASSWORD"] = POSTGRES
        try:
            response = self.get_resp(url, data=form_data)
            message = "{0} imported into database {1}".format(table_name, db_name)
            print(response)  # show error message in build
            assert message in response
        finally:
            os.remove(filename)
            url = (
                "postgresql://"
                + conf["POSTGRES_USERNAME"]
                + ":"
                + conf["POSTGRES_PASSWORD"]
                + "@localhost/"
                + db_name
            )
            if sqlalchemy_utils.database_exists(url):
                sqlalchemy_utils.drop_database(url)

    def test_allow_csv_upload_databases(self):
        db_id = self.get_existing_db_id()
        assert db_id in [
            database.id for database in self.importer.allow_csv_upload_databases()
        ]

    def test_clean_filename(self):
        original_filename = "foo,+.bar"
        filename = self.importer._clean_filename(original_filename, "CSV")
        print(filename)
        assert filename == "foo.bar"
        filename = self.importer._clean_filename(filename, "CSV")
        assert filename == "foo.bar"

    def test_clean_filename_None(self):
        purpose = "CSV"
        error_message = "No name is received for {0}".format(purpose)
        with self.assertRaisesRegex(NameNotAllowed, error_message):
            self.importer._clean_filename(None, purpose)

    def test_clean_filename_empty(self):
        filename = "#,'\""
        purpose = "CSV"
        error_message = "Name {0} is not allowed for {1}".format(filename, purpose)
        with self.assertRaisesRegex(NameNotAllowed, error_message):
            self.importer._clean_filename(filename, purpose)

    def test_convert_database_id(self):
        database_id = "1"
        converted_id = self.importer._convert_database_id(database_id)
        assert converted_id == 1

    def test_convert_database_id_failed(self):
        database_id = "id"
        error_message = (
            "Possible tampering detected, non-numeral character in database-id"
        )
        with self.assertRaisesRegex(ValueError, error_message):
            self.importer._convert_database_id(database_id)

    def test_check_table_name(self):
        table_name = "myNewTableName"
        assert not self.importer._check_table_name(table_name)

    def test_check_table_name_failed(self):
        table_name = db.session.query(SqlaTable).first().table_name
        error_message = "Table name {0} already exists. Please choose another".format(
            table_name
        )
        with self.assertRaisesRegex(NameNotAllowed, error_message):
            self.importer._check_table_name(table_name)

    def test_create_sqlite_database(self):
        db_name = "newSqlite"
        sqlite = "sqlite"
        try:
            new_database = self.importer._create_database(db_name, sqlite)
            assert (
                new_database
                == db.session.query(models.Database).filter_by(id=new_database.id).one()
            )
        finally:
            db.session.delete(new_database)
            db.session.commit()

    @unittest.skipIf(
        "mysql" in conf.get("SQLALCHEMY_DATABASE_URI", "")
        or SQLITE in conf.get("SQLALCHEMY_DATABASE_URI", ""),
        "This test only run when a PostgreSQL database exist",
    )
    def test_create_postgresql_database(self):
        db_name = "newPostgresqlDatabase"
        postgresql = "postgres"
        conf["POSTGRES_USERNAME"] = POSTGRES
        conf["POSTGRES_PASSWORD"] = POSTGRES
        try:
            new_database = self.importer._create_database(db_name, postgresql)
            assert (
                new_database
                == db.session.query(models.Database).filter_by(id=new_database.id).one()
            )
        finally:
            db.session.delete(new_database)
            db.session.commit()
            url = (
                "postgresql://"
                + conf["POSTGRES_USERNAME"]
                + ":"
                + conf["POSTGRES_PASSWORD"]
                + "@localhost/"
                + db_name
            )
            if sqlalchemy_utils.database_exists(url):
                sqlalchemy_utils.drop_database(url)

    def test_create_database_duplicate_name(self):
        db_name = "examples"
        error_message = "Error when trying to create Database"
        try:
            with self.assertRaisesRegex(DatabaseCreationException, error_message):
                self.importer._create_database(db_name, SQLITE)
        finally:
            db.session.rollback()

    def test_postgres_no_password_supplied(self):
        db_name = "postgres_no_pw"
        conf["POSTGRES_USERNAME"] = POSTGRES
        conf["POSTGRES_PASSWORD"] = ""
        error_message = "No password supplied for PostgreSQL"
        with self.assertRaisesRegex(NoPasswordSuppliedException, error_message):
            self.importer._setup_postgres_database(db_name, None)

    def test_postgres_no_username_supplied(self):
        db_name = "postgres_no_pw"
        conf["POSTGRES_USERNAME"] = ""
        conf["POSTGRES_PASSWORD"] = POSTGRES
        error_message = "No username supplied for PostgreSQL"
        with self.assertRaisesRegex(NoUsernameSuppliedException, error_message):
            self.importer._setup_postgres_database(db_name, None)

    @unittest.skipIf(
        "mysql" in conf.get("SQLALCHEMY_DATABASE_URI", "")
        or SQLITE in conf.get("SQLALCHEMY_DATABASE_URI", ""),
        "This test only run when a PostgreSQL database exist",
    )
    def test_postgres_already_exist(self):
        db_name = "postgres_already_exist"
        conf["POSTGRES_USERNAME"] = POSTGRES
        conf["POSTGRES_PASSWORD"] = POSTGRES
        error_message = "The database {0} already exist".format(db_name)
        try:
            self.importer._create_database(db_name, POSTGRES)
            with self.assertRaisesRegex(DatabaseCreationException, error_message):
                self.importer._create_database(db_name, POSTGRES)
        finally:
            url = (
                "postgresql://"
                + conf["POSTGRES_USERNAME"]
                + ":"
                + conf["POSTGRES_PASSWORD"]
                + "@localhost/"
                + db_name
            )
            if sqlalchemy_utils.database_exists(url):
                sqlalchemy_utils.drop_database(url)

    def test_already_exist_sqlite_file(self):
        db_name = "existing_db"
        db_path = os.getcwd() + "/" + db_name + ".db"
        try:
            existing_file = open(db_path, "w+")
            existing_file.close()
            error_message = "Database file for {0} already exists, please choose a different name".format(
                db_name
            )
            with self.assertRaisesRegex(ValueError, error_message):
                self.importer._setup_sqlite(db_name, None)
        finally:
            os.remove(db_path)

    def test_not_existing_database_id(self):
        database_id = 1337
        error_message = "No database was found with id {0}".format(database_id)
        with self.assertRaisesRegex(NoResultFound, error_message):
            self.importer._get_existing_database(database_id, None)

    def test_not_allowed_upload(self):
        example_db = utils.get_example_database()
        example_db.allow_csv_upload = False
        db.session.commit()
        error_message = "Database {0} Schema {1} is not allowed for csv uploads. Please contact your Superset administrator".format(
            example_db.database_name, "None"
        )
        with self.assertRaisesRegex(ValueError, error_message):
            self.importer._get_existing_database(example_db.id, None)

    def test_check_and_save_csv(self):
        filename = "filename"
        csv_file = FileStorage(self.create_csv_file(filename), filename)
        try:
            path = self.importer._check_and_save_csv(csv_file, filename)
            assert os.path.isfile(path=path)
        finally:
            os.remove(path)
            os.remove(filename)

    def test_create_table(self):
        table_name = "newTable"
        example_db = utils.get_example_database()
        table = self.importer._create_table(table_name, example_db)
        assert table.table_name == table_name
        assert table.database == example_db

    def test_schema_is_not_allowed(self):
        filename = "not_allowed_schema.csv"
        schema = "mySchema"
        db_name = "not_allowed_schema"
        table_name = "schema_not_allowed"
        table = SqlaTable(table_name=table_name)
        try:
            form_data = self.get_full_data(
                filename, NEW_DATABASE_ID, db_name, table_name, schema
            )

            error_message = (
                "Table {0} could not be filled with CSV {1}. This could be an issue with the schema, a connection "
                "issue, etc.".format(table_name, filename)
            )
            with self.assertRaisesRegex(TableCreationException, error_message):
                self.importer._fill_table(form_data, table, filename)

        finally:
            os.remove(filename)
