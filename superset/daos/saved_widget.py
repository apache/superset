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
from __future__ import annotations

from uuid import UUID

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.saved_widget import SavedWidget


class SavedWidgetDAO(BaseDAO[SavedWidget]):
    id_column_name = "uuid"

    @classmethod
    def find_by_uuid(cls, ref: str) -> SavedWidget | None:
        try:
            parsed = UUID(str(ref))
        except ValueError:
            return None
        return (
            db.session.query(SavedWidget)
            .filter(SavedWidget.uuid == parsed)
            .one_or_none()
        )

    @classmethod
    def find_by_creator(cls, user_id: int) -> list[SavedWidget]:
        return (
            db.session.query(SavedWidget)
            .filter(SavedWidget.created_by_fk == user_id)
            .order_by(SavedWidget.changed_on.desc())
            .all()
        )
