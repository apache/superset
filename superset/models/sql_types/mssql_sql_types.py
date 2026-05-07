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
import uuid
from typing import Any, Optional

from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.sqltypes import CHAR
from sqlalchemy.sql.visitors import Visitable
from sqlalchemy.types import TypeDecorator

# _compiler_dispatch is defined to help with type compilation


class GUID(TypeDecorator):
    """
    A type for SQL Server's uniqueidentifier, stored as stringified UUIDs.
    """

    impl = CHAR

    @property
    def python_type(self) -> type[uuid.UUID]:
        """The Python type for this SQL type is `uuid.UUID`."""
        return uuid.UUID

    @classmethod
    def _compiler_dispatch(cls, _visitor: Visitable, **_kw: Any) -> str:
        """Return the SQL type for the GUID type, which is CHAR(36) in SQL Server."""
        return "CHAR(36)"

    def process_bind_param(self, value: str, dialect: Dialect) -> Optional[str]:
        """Prepare the UUID value for binding to the database."""
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(value))  # Convert to string UUID if needed
        return str(value)

    def process_result_value(
        self, value: Optional[str], dialect: Dialect
    ) -> Optional[uuid.UUID]:
        """Convert the string back to a UUID when retrieving from the database."""
        if value is None:
            return None
        return uuid.UUID(value)
