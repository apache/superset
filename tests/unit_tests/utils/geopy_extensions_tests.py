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
import unittest

from geopy import Point

from superset.utils.geopy_extensions import LngLatPoint


class LngLatPointTestCase(unittest.TestCase):
    def test_from_string(self):
        self.assertEqual(LngLatPoint("113.21, 1.23"), (1.23, 113.21, 0.0))
        self.assertEqual(LngLatPoint("-113.21, +1.23"), (1.23, -113.21, 0.0))
        self.assertEqual(LngLatPoint("-113.21 W 1.23 N"), (1.23, 113.21, 0.0))
        self.assertEqual(LngLatPoint("113.21 E, -1.23 S"), (1.23, 113.21, 0.0))
        self.assertEqual(
            LngLatPoint("""113 12' 6" E 1 13' 8" N"""),
            (1 + 13 / 60 + 8 / 3600, 113 + 12 / 60 + 6 / 3600, 0.0),
        )
        self.assertEqual(
            LngLatPoint("113 12m 6s E 1 13m 8s N"),
            (1 + 13 / 60 + 8 / 3600, 113 + 12 / 60 + 6 / 3600, 0.0),
        )
        self.assertEqual(
            LngLatPoint("UT: W 74°35' 0'' / N 39°20' 0''"),
            Point("UT: N 39°20' 0'' / W 74°35' 0''"),
        )

        # solt
        point = LngLatPoint("113.21, 1.23")
        self.assertEqual(point.longitude, 113.21)
        self.assertEqual(point.latitude, 1.23)
        self.assertEqual(point.altitude, 0.0)

        # has lat..
        self.assertEqual(LngLatPoint("113.21, 1.23, 2.5km"), (1.23, 113.21, 2.5))

    def test_parse_lat(self):
        self.assertEqual(LngLatPoint("113.21, 1.23, 2.5km"), (1.23, 113.21, 2.5))
        self.assertEqual(LngLatPoint("113.21, 1.23, 2500m"), (1.23, 113.21, 2.5))
        self.assertEqual(LngLatPoint("113.21, 1.23, 2500ft"), (1.23, 113.21, 0.762))
        self.assertEqual(
            LngLatPoint("113.21, 1.23, 712mi"), (1.23, 113.21, 1145.852928)
        )

    def test_from_point(self):
        lng_lat_point = LngLatPoint(113.21, 1.23, 2)
        self.assertEqual(LngLatPoint(lng_lat_point), (1.23, 113.21, 2.0))

        point = Point(1.23, 113.21)
        self.assertEqual(LngLatPoint(point), (1.23, 113.21, 0.0))

    def test_from_arr(self):
        self.assertEqual(LngLatPoint([113.21, 1.23, 2]), LngLatPoint(113.21, 1.23, 2))

    def test_from_iterable(self):
        self.assertEqual(LngLatPoint(113.21, 1.23, 2), (1.23, 113.21, 2.0))
