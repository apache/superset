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
from typing import Optional, List

from sqlalchemy.engine.reflection import Inspector
from superset.db_engine_specs.base import BaseEngineSpec

import pyocient
from pyocient import _STPoint, _STLinestring, _STPolygon, TypeCodes
from superset import app
from typing import Any, Callable, Dict, List, NamedTuple, Tuple

# Ensure pyocient inherits Superset's logging level
superset_log_level = app.config['LOG_LEVEL']
pyocient.logger.setLevel(superset_log_level)


def _to_hex(data: bytes) -> str:
    """
    Converts the bytes object into a string of hexadecimal digits.

    :param data: the bytes object
    :returns: string of hexadecimal digits representing the bytes
    """
    return data.hex()

def _polygon_to_json(polygon: _STPolygon) -> str:
    """
    Converts the _STPolygon object into its JSON representation.

    :param data: the polygon object
    :returns: JSON representation of the polygon
    """
    json_value = f'{str([[p.long, p.lat] for p in polygon.exterior])}'
    if polygon.holes:
        for hole in polygon.holes:
            json_value += f', {str([[p.long, p.lat] for p in hole])}'
        json_value = f'[{json_value}]'
    return json_value

def _linestring_to_json(linestring: _STLinestring) -> str:
    """
    Converts the _STLinestring object into its JSON representation.

    :param data: the linestring object
    :returns: JSON representation of the linestring
    """
    return f'{str([[p.long, p.lat] for p in linestring.points])}'

def _point_to_comma_delimited(point: _STPoint) -> str:
    """
    Returns the x and y coordinates as a comma delimited string.

    :param data: the point object
    :returns: the x and y coordinates as a comma delimited string
    """
    return f'{point.long}, {point.lat}'

# Sanitization function for column values
SanitizeFunc = Callable[[Any], Any]

# Represents a pair of a column index and the sanitization function 
# to apply to its values.
PlacedSanitizeFunc = NamedTuple(
    "PlacedSanitizeFunc",
    [
        ("column_index", int),
        ("sanitize_func", SanitizeFunc),
    ],
)

# This map contains functions used to sanitize values for column types 
# that cannot be processed natively by Superset.
# 
# Superset serializes temporal objects using a custom serializer 
# defined in superset/utils/core.py (#json_int_dttm_ser(...)). Other 
# are serialized by the default JSON encoder.
_sanitized_ocient_type_codes: Dict[int, SanitizeFunc] = {
    TypeCodes.BINARY: _to_hex,
    TypeCodes.ST_POINT: _point_to_comma_delimited,
    TypeCodes.IP: str,
    TypeCodes.IPV4: str,
    TypeCodes.ST_LINESTRING: _linestring_to_json,
    TypeCodes.ST_POLYGON: _polygon_to_json,
}
    
def _find_columns_to_sanitize(cursor: Any) -> List[PlacedSanitizeFunc]:
    """
    Cleans the column value for consumption by Superset.
    
    :param cursor: the result set cursor
    :returns: the list of tuples consisting of the column index and sanitization function
    """
    return [
        PlacedSanitizeFunc(i, _sanitized_ocient_type_codes[cursor.description[i][1]])
        for i in range(len(cursor.description))
        if cursor.description[i][1] in _sanitized_ocient_type_codes
    ]

    
class OcientEngineSpec(BaseEngineSpec):
    engine = 'ocient'
    engine_name = "Ocient"
    #limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "ROUND({col}, 'SECOND')",
        "PT1M": "ROUND({col}, 'MINUTE')",
        "PT1H": "ROUND({col}, 'HOUR')",
        "P1D": "ROUND({col}, 'DAY')",
        "P1W": "ROUND({col}, 'WEEK')",
        "P1M": "ROUND({col}, 'MONTH')",
        "P0.25Y": "ROUND({col}, 'QUARTER')",
        "P1Y": "ROUND({col}, 'YEAR')",
    }

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: Inspector, schema: Optional[str]
    ) -> List[str]:
        return sorted(inspector.get_table_names(schema))

    @classmethod
    def fetch_data(cls, cursor, lim=None):
        rows = super(OcientEngineSpec, cls).fetch_data(cursor)

        if (len(rows)) == 0:
            # No rows were produced
            return rows

        if type(rows[0]).__name__ != 'Row':
            # TODO what else is returned here?
            return rows

        # Peek at the schema to determine which column values, if any,
        # require sanitization.
        columns_to_sanitize: List[PlacedSanitizeFunc] = _find_columns_to_sanitize(cursor)

        if columns_to_sanitize:
            # At least 1 column has to be sanitized.
            for row in rows:
                for info in columns_to_sanitize:
                    # Modify the element in-place.
                    v = row[info.column_index]
                    row[info.column_index] = info.sanitize_func(v)

        return rows
