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
import logging

from superset.dao.base import BaseDAO
from superset.databases.filters import DatabaseFilter
from superset.extensions import db
from superset.models.core import Database

logger = logging.getLogger(__name__)


class DatabaseDAO(BaseDAO):
    model_cls = Database
    base_filter = DatabaseFilter

    @staticmethod
    def validate_uniqueness(database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(database_id: int, database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name, Database.id != database_id,
        )
        return not db.session.query(database_query.exists()).scalar()
