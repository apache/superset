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
from pyocient import _STPoint, _STLinestring, _STPolygon
from ipaddress import IPv4Address, IPv6Address
from superset import app

superset_log_level = app.config['LOG_LEVEL']
pyocient.logger.setLevel(superset_log_level)


# Custom datatype conversion functions

def _to_hex(data: bytes) -> str:
    return data.hex()

def _polygon_to_json(polygon: _STPolygon) -> str:
    json_value = f'{str([[p.long, p.lat] for p in polygon.exterior])}'
    if polygon.holes:
        for hole in polygon.holes:
            json_value += f', {str([[p.long, p.lat] for p in hole])}'
        json_value = f'[{json_value}]'
    return json_value

def _linestring_to_json(linestring: _STLinestring) -> str:
    return f'{str([[p.long, p.lat] for p in linestring.points])}'

def _point_to_comma_delimited(point: _STPoint) -> str:
    return f'{point.long}, {point.lat}'


# Map of datatypes that are not allowed in superset, but are allowed in our DB
# Key is datatype, value is function to map, in order to convert to a valid superset type

_superset_conversion_dict = {
    _STPoint: _point_to_comma_delimited,
    _STLinestring: _linestring_to_json,
    _STPolygon: _polygon_to_json,
    IPv4Address: str,
    IPv6Address: str,
    bytes: _to_hex
}
    
def _verify_datatype(elem):
    """Verifies that the type of elem is allowable in superset
    Whether a datatype is allowable is determined by the builtin json.dumps method, and superset's json_int_dttm_ser found in superset/utils/core.py
    NOTE: This method does not allow for inheritance, elem that inherit from an allowable type will not be seen as allowable
    
    If the type is allowable, it is returned without modification
    If the type is not allowable, the repr string of the elem is returned
    NOTE: This may need to be changed, particularity with consideration to GIS data, which may be better presented as a list
    
    """
    if type(elem) in _superset_conversion_dict:
        return _superset_conversion_dict[type(elem)](elem)
    return elem
    
class OcientEngineSpec(BaseEngineSpec):
    """Engine spec for the Ocient Database

         Modify label to syntax supported by Ocient:
             - 'count' changed to '"count"'
             - label containing ')' and '(' wrapped with double-quotes
             - Add an 'A' to a Label beginning with '_'

    """

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
        data = super(OcientEngineSpec, cls).fetch_data(cursor)
        if len(data) != 0 and type(data[0]).__name__ == 'Row':
            data = [list(map(_verify_datatype, r)) for r in data]
        return data
