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

from sqlalchemy.orm import scoped_session


class CoreModelsApi(ABC):
    """
    Abstract interface for accessing Superset data models.

    This class defines the contract for retrieving SQLAlchemy sessions
    and model instances for datasets and databases within Superset.
    """

    @staticmethod
    @abstractmethod
    def get_session() -> scoped_session:
        """
        Retrieve the SQLAlchemy session to directly interface with the
        Superset models.

        :returns: The SQLAlchemy scoped session instance.
        """
        ...
