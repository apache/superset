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

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import ContextBuilderTask


class ContextBuilderTaskDAO(BaseDAO[ContextBuilderTask]):
    @staticmethod
    def find_by_task_id(task_id: int) -> ContextBuilderTask | None:
        return (
            db.session.query(ContextBuilderTask)
            .filter_by(task_id=task_id)
            .one_or_none()
        )

    @staticmethod
    def get_latest_task_for_database(database_id: int) -> ContextBuilderTask:
        return (
            db.session.query(ContextBuilderTask)
            .filter(ContextBuilderTask.database_id == database_id)
            .order_by(ContextBuilderTask.started_time.desc())
            .first()
        )

    @staticmethod
    def get_last_successful_task_for_database(database_id: int) -> ContextBuilderTask:
        return (
            db.session.query(ContextBuilderTask)
            .filter(
                ContextBuilderTask.database_id == database_id,
                ContextBuilderTask.status == "SUCCESS",
            )
            .order_by(ContextBuilderTask.started_time.desc())
            .first()
        )

    @staticmethod
    def get_last_two_tasks_for_database(database_id: int) -> list[ContextBuilderTask]:
        return (
            db.session.query(ContextBuilderTask)
            .filter(ContextBuilderTask.database_id == database_id)
            .order_by(ContextBuilderTask.started_time.desc())
            .limit(2)
            .all()
        )
