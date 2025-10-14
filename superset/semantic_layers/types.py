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

import enum
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import total_ordering

__all__ = [
    "BINARY",
    "BOOLEAN",
    "DATE",
    "DATETIME",
    "DECIMAL",
    "DateGrain",
    "Dimension",
    "INTEGER",
    "INTERVAL",
    "NUMBER",
    "OBJECT",
    "STRING",
    "TIME",
    "TimeGrain",
]


class Type:
    """
    Base class for types.
    """


class INTEGER(Type):
    """
    Represents an integer type.
    """


class NUMBER(Type):
    """
    Represents a number type.
    """


class DECIMAL(Type):
    """
    Represents a decimal type.
    """


class STRING(Type):
    """
    Represents a string type.
    """


class BOOLEAN(Type):
    """
    Represents a boolean type.
    """


class DATE(Type):
    """
    Represents a date type.
    """


class TIME(Type):
    """
    Represents a time type.
    """


class DATETIME(DATE, TIME):
    """
    Represents a datetime type.
    """


class INTERVAL(Type):
    """
    Represents an interval type.
    """


class OBJECT(Type):
    """
    Represents an object type.
    """


class BINARY(Type):
    """
    Represents a binary type.
    """


@total_ordering
class ComparableEnum(enum.Enum):
    def __eq__(self, other: object) -> bool:
        if isinstance(other, enum.Enum):
            return self.value == other.value
        return NotImplemented

    def __lt__(self, other: object) -> bool:
        if isinstance(other, enum.Enum):
            return self.value < other.value
        return NotImplemented

    def __hash__(self):
        return hash((self.__class__, self.name))


class TimeGrain(ComparableEnum):
    second = timedelta(seconds=1)
    minute = timedelta(minutes=1)
    hour = timedelta(hours=1)


class DateGrain(ComparableEnum):
    day = timedelta(days=1)
    week = timedelta(weeks=1)
    month = timedelta(days=30)
    quarter = timedelta(days=90)
    year = timedelta(days=365)


@dataclass(frozen=True)
class Dimension:
    id: str
    name: str
    type: type[Type]

    description: str | None = None
    definition: str | None = None
    grain: DateGrain | TimeGrain | None = None


@dataclass(frozen=True)
class Metric:
    id: str
    name: str
    type: type[Type]

    # Metric definitions could be SQL expressions, SQL queries, or even a DSL
    definition: str

    description: str | None = None


class Operator(enum.Enum):
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN_OR_EQUAL = "<="
    IN = "IN"
    NOT_IN = "NOT IN"
    LIKE = "LIKE"
    NOT_LIKE = "NOT LIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"


FilterTypes = str | int | float | bool | datetime | date | time | timedelta | None


@dataclass(frozen=True)
class Filter:
    column: Dimension | Metric
    operator: Operator
    value: FilterTypes | set[FilterTypes]


@dataclass(frozen=True)
class NativeFilter:
    definition: str
