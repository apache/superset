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

from typing import Any

from flask_appbuilder.security.sqla.models import Group

from superset.daos.base import BaseDAO
from superset.extensions import db


class GroupDAO(BaseDAO[Group]):
    @classmethod
    def create(
        cls,
        item: Group | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> Group:
        group = super().create(item=item, attributes=attributes)
        db.session.flush()
        cls._sync_subject(group)
        return group

    @classmethod
    def update(
        cls,
        item: Group | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> Group:
        group = super().update(item=item, attributes=attributes)
        cls._sync_subject(group)
        return group

    @classmethod
    def delete(cls, items: list[Group]) -> None:
        for item in items:
            cls._delete_subject(item.id)
        super().delete(items)

    @staticmethod
    def _sync_subject(group: Group) -> None:
        from superset.subjects.sync import sync_group_subject

        sync_group_subject(group)

    @staticmethod
    def _delete_subject(group_id: int) -> None:
        from superset.subjects.sync import delete_group_subject

        delete_group_subject(group_id)
