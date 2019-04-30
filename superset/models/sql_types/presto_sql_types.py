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

from sqlalchemy import types
from sqlalchemy.sql.sqltypes import Integer
from sqlalchemy.sql.type_api import TypeEngine


# _compiler_dispatch is defined to help with type compilation

class TinyInteger(Integer):
    """
    A type for tiny ``int`` integers.
    """
    def _compiler_dispatch(self, visitor, **kw):
        return 'TINYINT'


class Interval(TypeEngine):
    """
    A type for intervals.
    """
    def _compiler_dispatch(self, visitor, **kw):
        return 'INTERVAL'


class Array(TypeEngine):

    """
    A type for arrays.
    """
    def _compiler_dispatch(self, visitor, **kw):
        return 'ARRAY'


class Map(TypeEngine):

    """
    A type for maps.
    """
    def _compiler_dispatch(self, visitor, **kw):
        return 'MAP'


class Row(TypeEngine):

    """
    A type for rows.
    """
    def _compiler_dispatch(self, visitor, **kw):
        return 'ROW'


type_map = {
    'boolean': types.Boolean,
    'tinyint': TinyInteger,
    'smallint': types.SmallInteger,
    'integer': types.Integer,
    'bigint': types.BigInteger,
    'real': types.Float,
    'double': types.Float,
    'decimal': types.DECIMAL,
    'varchar': types.String,
    'char': types.CHAR,
    'varbinary': types.VARBINARY,
    'JSON': types.JSON,
    'date': types.DATE,
    'time': types.Time,
    'timestamp': types.TIMESTAMP,
    'interval': Interval,
    'array': Array,
    'map': Map,
    'row': Row,
}
