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
# from superset import db
# from superset.models.dashboard import Dashboard
import subprocess
from unittest import skipUnless

from superset import app, is_feature_enabled
from tests.test_app import app

from .base_tests import SupersetTestCase


class ThumbnailsTests(SupersetTestCase):
    @classmethod
    def setUpClass(cls):
        with app.app_context():

            base_dir = app.config["BASE_DIR"]
            worker_command = base_dir + "/bin/superset worker -w 2"
            subprocess.Popen(worker_command, shell=True, stdout=subprocess.PIPE)

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | xargs kill -9", shell=True
        )
        subprocess.call(
            "ps auxww | grep 'superset worker' | awk '{print $2}' | xargs kill -9",
            shell=True,
        )

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_simple_get_screenshot(self):
        """
            Thumbnails: Simple get screen shot
        """
        pass
