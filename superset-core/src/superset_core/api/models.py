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
Model API for superset-core.

Provides dependency-injected model classes and session access that will be replaced by
host implementations during initialization.

Usage:
    from superset_core.api.models import Dataset, Database, get_session

    # Use as regular model classes
    dataset = Dataset(name="My Dataset")
    db = Database(database_name="My DB")
    session = get_session()
"""

from sqlalchemy.orm import scoped_session

# Import the base models which will be replaced by host implementations
from superset_core.models.base import (
    Chart,
    CoreModel,
    Dashboard,
    Database,
    Dataset,
    KeyValue,
    Query,
    SavedQuery,
    Tag,
    User,
)


def get_session() -> scoped_session:
    """
    Retrieve the SQLAlchemy session to directly interface with the
    Superset models.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :returns: The SQLAlchemy scoped session instance.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "Dataset",
    "Database",
    "Chart",
    "Dashboard",
    "User",
    "Query",
    "SavedQuery",
    "Tag",
    "KeyValue",
    "CoreModel",
    "get_session",
]
