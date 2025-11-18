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

"""
Query API for superset-core.

Provides dependency-injected query utility functions that will be replaced by
host implementations during initialization.

Usage:
    from superset_core.api.query import get_sqlglot_dialect

    dialect = get_sqlglot_dialect(database)
"""

from typing import TYPE_CHECKING

from sqlglot import Dialects

if TYPE_CHECKING:
    from superset_core.api.models import Database


def get_sqlglot_dialect(database: "Database") -> Dialects:
    """
    Get the SQLGlot dialect for the specified database.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param database: The database instance to get the dialect for.
    :returns: The SQLGlot dialect enum corresponding to the database.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = ["get_sqlglot_dialect"]
