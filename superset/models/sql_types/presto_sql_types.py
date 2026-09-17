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

# pylint: disable=abstract-method
from typing import Any, Optional

from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.sqltypes import DATE, Integer, TIMESTAMP
from sqlalchemy.sql.type_api import TypeEngine
from sqlalchemy.sql.visitors import Visitable
from sqlalchemy.types import TypeDecorator

# _compiler_dispatch is defined to help with type compilation


class TinyInteger(Integer):
    """
    A type for tiny ``int`` integers.
    """

    @property
    def python_type(self) -> type[int]:
        return int

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        return "TINYINT"


class Interval(TypeEngine):
    """
    A type for intervals.
    """

    @property
    def python_type(self) -> Optional[type[Any]]:
        return None

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        return "INTERVAL"


class Array(TypeEngine):
    """
    A type for arrays.
    """

    @property
    def python_type(self) -> Optional[type[list[Any]]]:
        return list

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        return "ARRAY"


class Map(TypeEngine):
    """
    A type for maps.
    """

    @property
    def python_type(self) -> Optional[type[dict[Any, Any]]]:
        return dict

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        return "MAP"


class Row(TypeEngine):
    """
    A type for rows.
    """

    @property
    def python_type(self) -> Optional[type[Any]]:
        return None

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        return "ROW"


class TimeStamp(TypeDecorator):
    """
    A type to extend functionality of timestamp data type.
    """

    impl = TIMESTAMP

    @classmethod
    # pylint: disable=arguments-differ
    def process_bind_param(cls, value: str, dialect: Dialect) -> str:
        """
        Used for in-line rendering of TIMESTAMP data type
        as Presto does not support automatic casting.
        """
        return f"TIMESTAMP '{value}'"


class Date(TypeDecorator):
    """
    A type to extend functionality of date data type.
    """

    impl = DATE

    @classmethod
    # pylint: disable=arguments-differ
    def process_bind_param(cls, value: str, dialect: Dialect) -> str:
        """
        Used for in-line rendering of DATE data type
        as Presto does not support automatic casting.
        """
        return f"DATE '{value}'"
