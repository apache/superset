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
from .base_tests import SupersetTestCase


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

    def test_menu_entry_upload_csv_exist(self):
        url = "/databaseview/list/"
        add_datasource_page = self.get_resp(url)
        assert "Upload a CSV" in add_datasource_page

    def test_upload_csv_view_load(self):
        url = "/superset/csvtodatabase"
        form_get = self.get_resp(url)
        assert "CSV to Database configuration" in form_get
