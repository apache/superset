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
from unittest.mock import patch

from superset import app, is_feature_enabled
from .base_tests import SupersetTestCase


class ThumbnailsTests(SupersetTestCase):

    def setUp(self) -> None:
        app.config["THUMBNAILS"] = True
        super().__init__()

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"THUMBNAILS": True},
        clear=True,
    )
    def test_simple_get_screenshot(self):
        """
            Thumbnails: Simple get screen shot
        """
        self.assertTrue(is_feature_enabled("THUMBNAILS"))
