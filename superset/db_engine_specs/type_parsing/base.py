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
from typing import Any, Optional

ARRAY = "ARRAY"
MAP = "MAP"
ROW = "ROW"


class Type:  # pylint: disable=too-few-public-methods
    """Wraps the concept of a type, allowing describing structural types"""

    def __init__(self, typedef: str):
        self.type = typedef

    def __eq__(self, other: Any) -> bool:
        return self.to_dict() == other.to_dict()

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type}


class Row(Type):  # pylint: disable=too-few-public-methods
    """
    Represents a row type, containing typed, ordered, and optionally named
    children
    """

    def __init__(self, children: list[tuple[Optional[str], Type]]):
        super().__init__(ROW)
        self.children = children

    def to_dict(self) -> dict[str, Any]:
        return super().to_dict() | {
            "children": [(k, v.to_dict()) for k, v in self.children]
        }


class Map(Type):  # pylint: disable=too-few-public-methods
    """Represents a map type, with key and value types"""

    def __init__(self, key_type: Type, value_type: Type):
        super().__init__(MAP)
        self.key_type = key_type
        self.value_type = value_type

    def to_dict(self) -> dict[str, Any]:
        return super().to_dict() | {
            "key_type": self.key_type.to_dict(),
            "value_type": self.value_type.to_dict(),
        }


class Array(Type):  # pylint: disable=too-few-public-methods
    """
    Represents an array type, i.e. containing an arbitrary number of unnamed
    children of a single type
    """

    def __init__(self, child_type: Type):
        super().__init__(ARRAY)
        self.child_type = child_type

    def to_dict(self) -> dict[str, Any]:
        return super().to_dict() | {"child_type": self.child_type.to_dict()}


class TypeParser:  # pylint: disable=too-few-public-methods
    """Superclass for type parsers, containing database-specific logic"""

    def parse_type(self, typedef: str) -> Type:
        """
        Parse a potentially complex type and return a structured type
        representing a full breakdown of the type. For a simple type like
        varchar this will just return a simple wrapper around the original
        string, whereas for a complex type like row(foo varchar, bar varchar)
        we'll produce a Row type which models the child types nested beneath.
        """
        return Type(typedef)
