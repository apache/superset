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
"""This module extends the geopy

These extensions are very useful in projects,
and were rejected by the geopy maintainer
"""
import re
from typing import Any

from geopy.format import DEGREE, DOUBLE_PRIME, PRIME
from geopy.point import Point

LNG_LAT_POINT_PATTERN = re.compile(
    r"""
    .*?
    (?P<longitude>
      (?P<longitude_direction_front>[EW])?[ ]*
      (?P<longitude_degrees>[+-]?{FLOAT})(?:[{DEGREE}D\*\u00B0\s][ ]*
      (?:(?P<longitude_arcminutes>{FLOAT})[{PRIME}'m][ ]*)?
      (?:(?P<longitude_arcseconds>{FLOAT})[{DOUBLE_PRIME}"s][ ]*)?
      )?(?P<longitude_direction_back>[EW])?)
    {SEP}
    (?P<latitude>
      (?P<latitude_direction_front>[NS])?[ ]*
        (?P<latitude_degrees>[+-]?{FLOAT})(?:[{DEGREE}D\*\u00B0\s][ ]*
        (?:(?P<latitude_arcminutes>{FLOAT})[{PRIME}'m][ ]*)?
        (?:(?P<latitude_arcseconds>{FLOAT})[{DOUBLE_PRIME}"s][ ]*)?
        )?(?P<latitude_direction_back>[NS])?)(?:
    {SEP}
      (?P<altitude>
        (?P<altitude_distance>[+-]?{FLOAT})[ ]*
        (?P<altitude_units>km|m|mi|ft|nm|nmi)))?
    \s*$
""".format(
        FLOAT=r"\d+(?:\.\d+)?",
        DEGREE=DEGREE,
        PRIME=PRIME,
        DOUBLE_PRIME=DOUBLE_PRIME,
        SEP=r"\s*[,;/\s]\s*",
    ),
    re.VERBOSE | re.UNICODE,
)


class LngLatPoint(Point):
    """
    A geodetic point with longitude, latitude, and altitude.

    Give a string containing at least latitude and longitude::

        >>> p = LngLatPoint('113.21, 1.23')
        >>> p = LngLatPoint('-113.21, +1.23')
        >>> p = LngLatPoint('-113.0 W 41.5 N')
        >>> p = LngLatPoint('113.0 E, -41.5 S, 2.5km')
        >>> p = LngLatPoint('23 27m 30s E 23 26m 22s N 21.0mi')
        >>> p = LngLatPoint('''23 27' 30" E 3 26' 22" N''')

    With longitude, latitude, and altitude::

        >>> p1 = LngLatPoint(-113.21, 0, 41.5)
        >>> p2 = LngLatPoint(longitude=-113.21, latitude=41.5)

    With a sequence of 2 to 3 values (latitude, longitude, altitude)::

        >>> p1 = LngLatPoint([-113.21, 41.5, 0])
        >>> p2 = LngLatPoint((-113.21, 41.5))
    """

    # Point method "from_string" implement base on Point.POINT_PATTERN.
    # Override it to supported "lng,lat,alt" string.
    POINT_PATTERN = LNG_LAT_POINT_PATTERN

    def __new__(
        cls, longitude: Any = None, latitude: Any = None, altitude: Any = None
    ) -> "LngLatPoint":
        """
        :param float longitude: Longitude of point.
        :param float latitude: Latitude of point.
        :param float altitude: Altitude of point.
        """
        single_arg = longitude is not None and latitude is None and altitude is None

        if not single_arg:
            return super().__new__(cls, latitude, longitude, altitude)

        input_arg = longitude

        return super().__new__(cls, input_arg)

    @classmethod
    def from_string(cls, string: str) -> "LngLatPoint":
        """
        Create and return a ``LngLatPoint`` instance from a string containing
        latitude and longitude, and optionally, altitude.

        reference Point.from_string

        Some example strings that will work include:

            - ``-81.0;41.5``
            - ``-81.0,41.5``
            - ``-81.0 41.5``
            - ``-81.0 W 41.5 N``
            - ``81.0 E;-41.5 S``
            - ``23 27m 30s E 23 26m 22s N``
            - ``23 27' 30" E 23 26' 22" N``
            - ``UT: W 74°35' 0'' / N 39°20' 0''``

        """
        match = re.match(cls.POINT_PATTERN, re.sub(r"''", r'"', string))
        if not match:
            raise ValueError(
                "Failed to create Point instance from string: unknown format."
            )

        latitude_direction = None
        if match.group("latitude_direction_front"):
            latitude_direction = match.group("latitude_direction_front")
        elif match.group("latitude_direction_back"):
            latitude_direction = match.group("latitude_direction_back")

        longitude_direction = None
        if match.group("longitude_direction_front"):
            longitude_direction = match.group("longitude_direction_front")
        elif match.group("longitude_direction_back"):
            longitude_direction = match.group("longitude_direction_back")
        latitude = cls.parse_degrees(
            match.group("latitude_degrees") or 0.0,
            match.group("latitude_arcminutes") or 0.0,
            match.group("latitude_arcseconds") or 0.0,
            latitude_direction,
        )
        longitude = cls.parse_degrees(
            match.group("longitude_degrees") or 0.0,
            match.group("longitude_arcminutes") or 0.0,
            match.group("longitude_arcseconds") or 0.0,
            longitude_direction,
        )
        altitude = cls.parse_altitude(
            match.group("altitude_distance"), match.group("altitude_units")
        )
        return cls(longitude, latitude, altitude)

    @classmethod
    def from_point(cls, point: Point) -> "LngLatPoint":
        """
        Create and return a new ``Point`` instance from another ``Point``
        instance.
        """
        return cls(point.longitude, point.latitude, point.altitude)
