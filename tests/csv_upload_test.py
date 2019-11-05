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

from superset import db
from superset.utils import core as utils

from .base_tests import SupersetTestCase

import superset.models.core as models


class CsvUploadTests(SupersetTestCase):
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
        self, filename, db_id, database_name="", table_name="TableForTesting"
    ):
        form_data = {
            "file": self.create_csv_file(filename),
            "connectionId": db_id,
            "databaseName": database_name,
            "schema": "",
            "tableName": table_name,
            "delimiter": ",",
            "ifTableExists": "Fail",
            "headerRow": 0,
            "decimalCharacter": ".",
            "indexColumn": "",
            "mangleDuplicateColumns": True,
            "skipInitialSpace": True,
            "skipRows": 0,
            "rowsToRead": 3,
            "skipBlankLines": True,
            "parseDates": "",
            "inferDatetimeFormat": True,
            "dataframeIndex": False,
            "columnLabels": "",
        }
        return form_data

    def test_menu_entry_upload_csv_exist(self):
        url = "/databaseview/list/"
        add_datasource_page = self.get_resp(url)
        assert "Upload a CSV" in add_datasource_page

    def test_upload_csv_view_load(self):
        url = "/superset/csvtodatabase"
        form_get = self.get_resp(url)
        assert "CSV to Database configuration" in form_get

    def test_import_csv_full_data_in_existing(self):
        url = "/superset/csvtodatabase/add"
        filename = "maximum.csv"
        try:
            form_data = self.get_full_data(filename, self.get_existing_db_id())
            response = self.get_resp(url, data=form_data)
            assert "imported into database" in response
        finally:
            os.remove(filename)

    def test_import_csv_full_data_in_new(self):
        url = "/superset/csvtodatabase/add"
        filename = "maximum_into_new.csv"
        database_name = "new_database_max"
        table_name = "import_maximum_into_new"
        try:
            form_data = self.get_full_data(filename, -1, database_name, table_name)
            response = self.get_resp(url, data=form_data)
            message = "{0} imported into database {1}".format(table_name, database_name)
            print(response)
            assert message in response
        finally:
            os.remove(filename)
            os.remove(os.getcwd() + "/" + database_name + ".db")
            todel = db.session.query(models.Database).all()
            todel2 = (
                db.session.query(models.Database).filter_by(name=database_name).all()
            )
            print(todel2)
            print(todel)
            for d in todel:
                if d.name == database_name:
                    db.session.delete(d)

    def test_not_allowed_filename(self):
        try:
            url = "/superset/csvtodatabase/add"
            filename = ",+."
            form_data = self.get_full_data(filename, self.get_existing_db_id())
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            assert "Filename is not allowed" in response
        finally:
            # Shouldnt be needed, as file does not get saved
            os.remove(filename)

    def test_invalid_database_id(self):
        try:
            url = "/superset/csvtodatabase/add"
            filename = "invalid_database_id.csv"
            form_data = self.get_full_data(filename, "id")
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            assert (
                "Possible tampering detected, non-numeral character in database-id"
                in response
            )
        finally:
            os.remove(filename)

    def test_not_existing_database_id(self):
        try:
            url = "/superset/csvtodatabase/add"
            filename = "not_existing_database_id.csv"
            form_data = self.get_full_data(filename, 1337)
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            assert "None or several matching databases found" in response
        finally:
            os.remove(filename)

    def test_not_allowed_upload(self):
        try:
            url = "/superset/csvtodatabase/add"
            filename = "not_allowed_schema.csv"

            example_db = utils.get_example_database()
            example_db.allow_csv_upload = False
            db.session.commit()

            form_data = self.get_full_data(filename, example_db.id)
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            message = "Database {0} Schema {1} is not allowed for csv uploads.".format(
                example_db.database_name, None
            )
            assert message in response

        finally:
            os.remove(filename)

    def test_not_allowed_database_name(self):
        try:
            url = "/superset/csvtodatabase/add"
            filename = "not_allowed_database_name.csv"
            form_data = self.get_full_data(filename, -1, "./.")
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            assert "Database name is not allowed" in response
        finally:
            os.remove(filename)

    def test_already_exist_database_file(self):
        url = "/superset/csvtodatabase/add"
        filename = "not_allowed_database_name.csv"
        db_name = "existing_db"
        db_path = os.getcwd() + "/" + db_name + ".db"
        try:
            existing_file = open(db_path, "w+")
            existing_file.close()

            form_data = self.get_full_data(filename, -1, db_name)
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            assert (
                "Database file for {0} already exists, please choose a different name".format(
                    db_name
                )
                in response
            )
        finally:
            os.remove(filename)
            os.remove(db_path)

    def test_duplicate_table_name(self):
        url = "/superset/csvtodatabase/add"
        filename = "duplicate_table_name.csv"
        db_name = "newDB"
        table_name = "birth_names"
        try:
            form_data = self.get_full_data(filename, -1, db_name, table_name)
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            message = "Table name {0} already exists. Please choose another".format(
                table_name
            )
            assert message in response
        finally:
            os.remove(filename)

    def test_database_exists_no_file(self):
        url = "/superset/csvtodatabase/add"
        filename = "duplicate_database_name.csv"
        db_name = "examples"
        table_name = "uniqueTableName"
        try:
            form_data = self.get_full_data(filename, -1, db_name, table_name)
            response = self.get_resp(url, data=form_data, raise_on_error=False)
            message = "Error when trying to create Database"
            assert message in response
        finally:
            os.remove(filename)
