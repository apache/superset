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


class TINYINT(Integer):
    """
    A type for tiny ``int`` integers.
    """

    __visit_name__ = 'TINYINT'


class INTERVAL(TypeEngine):
    """
    A type for intervals.
    """

    __visit_name__ = 'INTERVAL'


class ARRAY(TypeEngine):

    """
    A type for maps.
    """

    __visit_name__ = 'ARRAY'


class MAP(TypeEngine):

    """
    A type for maps.
    """

    __visit_name__ = 'MAP'


class ROW(TypeEngine):

    """
    A type for rows.
    """

    __visit_name__ = 'ROW'


type_map = {
    'boolean': types.Boolean,
    'tinyint': TINYINT,
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
    'interval': INTERVAL,
    'array': ARRAY,
    'map': MAP,
    'row': ROW,
}
