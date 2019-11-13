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
"""Unit tests for geocoding"""
import asyncio

from geopy import Location

from superset.views import core as views

from .base_tests import SupersetTestCase


class GeocodingTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(GeocodingTests, self).__init__(*args, **kwargs)

    def setUp(self):
        self.login()

    def tearDown(self):
        self.logout()

    def test_get_mapbox_api_key(self):
        superset = views.Superset()
        api_key = superset._get_mapbox_key()
        assert isinstance(api_key, str)

    def test_geocode_single_address(self):
        superset = views.Superset()
        resp = superset._geocode(
            "HSR Hochschule für Technik, Oberseestrasse 10, CH-8640 Rapperswil"
        )
        # assert isinstance(resp, Location)

    # Solely for testing the functionality while developing
    def test_async(self):
        url = "/superset/geocoding/is_in_progress"
        u = "/superset/geocoding/geocode"
        superset = views.Superset()
        dats = [
            "HSR Hochschule für Technik, Oberseestrasse 10, CH-8640 Rapperswil",
            "ETH Zürich",
        ]
        # task = superset.geocode()
        # r = self.get_resp(u)
        """print(r)
        try:
            resp = self.get_resp(url)
            assert "True" in resp
            url2 = "/superset/geocoding/progress"
            resp2 = self.get_resp(url2)
            url3 = "/superset/geocoding/interrupt"
            resp3 = self.get_resp(url3)
        except Exception as e:
            print(e)
        """
