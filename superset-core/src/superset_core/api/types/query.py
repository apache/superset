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

from abc import ABC, abstractmethod
from typing import Any

from sqlglot import Dialects


class CoreQueryApi(ABC):
    """
    Abstract interface for query-related operations.

    This class defines the contract for database query operations,
    including dialect handling and query processing.
    """

    @staticmethod
    @abstractmethod
    def get_sqlglot_dialect(database: Any) -> Dialects:
        """
        Get the SQLGlot dialect for the specified database.

        :param database: The database instance to get the dialect for.
        :returns: The SQLGlot dialect enum corresponding to the database.
        """
        ...
