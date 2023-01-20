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
from typing import Any, Dict, List, Optional, Pattern, Tuple, TYPE_CHECKING
import re

from sqlalchemy.engine.reflection import Inspector
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType
from flask_babel import gettext as __

import pyocient
from pyocient import _STPoint, _STLinestring, _STPolygon
from ipaddress import IPv4Address, IPv6Address
from superset import app

superset_log_level = app.config['LOG_LEVEL']
pyocient.logger.setLevel(superset_log_level)


# Regular expressions to catch custom errors

CONNECTION_INVALID_USERNAME_REGEX = re.compile(
    "The referenced user does not exist \(User \'(?P<username>.*?)\' not found\)"
)
CONNECTION_INVALID_PASSWORD_REGEX = re.compile(
    'The userid/password combination was not valid \(Incorrect password for user\)'
)
CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
    r"Unable to connect to (?P<host>.*?):(?P<port>.*?):"       
)
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile(
    "No database named '(?P<database>.*?)' exists"
)
CONNECTION_INVALID_PORT_ERROR = re.compile(
    "Port out of range 0-65535"
)
INVALID_CONNECTION_STRING_REGEX = re.compile(
    "An invalid connection string attribute was specified \(failed to decrypt cipher text\)"
)
SYNTAX_ERROR_REGEX = re.compile(
    r"There is a syntax error in your statement \(extraneous input '(?P<ext_input>.*?)' expecting {.*}"
)
TABLE_DOES_NOT_EXIST_REGEX = re.compile(
    "The referenced table or view '(?P<table>.*?)' does not exist"
)
COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    "The reference to column '(?P<column>.*?)' is not valid"
)

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

    custom_errors : Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        CONNECTION_INVALID_USERNAME_REGEX: (
            __('The username "%(username)s" does not exist.'),
            SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
            {},
        ),
        CONNECTION_INVALID_PASSWORD_REGEX: (
            __('The user/password combination is not valid (Incorrect password for user).'),
            SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
            {},
        ),
        CONNECTION_UNKNOWN_DATABASE_REGEX: (
            __('Could not connect to database: "%(database)s"'),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {}
        ),
        CONNECTION_INVALID_HOSTNAME_REGEX: (
            __('Could not resolve hostname: "%(host)s".'),
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            {}
        ),
        CONNECTION_INVALID_PORT_ERROR: (
            __('Port out of range 0-65535'),
            SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
            {}
        ),
        INVALID_CONNECTION_STRING_REGEX: (
            __('Invalid Connection String: Expecting String of the form \'ocient://user:pass@host:port/database\'.'),
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            {}
        ), 
        SYNTAX_ERROR_REGEX: (
            __('Extraneous input: "%(ext_input)s".'),
            SupersetErrorType.SYNTAX_ERROR,
            {}
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            __('Table or View "%(table)s" does not exist.'),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {}
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('Invalid reference to column: "%(column)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {}
        ),
}
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
