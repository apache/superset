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

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.user_ui_prefs import UserUiPref


class UserUiPrefDAO(BaseDAO[UserUiPref]):
    @classmethod
    def get_for_user(cls, user_id: int, key: str) -> UserUiPref | None:
        return (
            db.session.query(UserUiPref)
            .filter_by(user_id=user_id, key=key)
            .one_or_none()
        )

    @classmethod
    def upsert_for_user(
        cls, user_id: int, key: str, value: dict[str, Any]
    ) -> UserUiPref:
        row = cls.get_for_user(user_id, key)
        if row is None:
            row = UserUiPref(user_id=user_id, key=key, value=value)
            db.session.add(row)
        else:
            row.value = value
        db.session.flush()
        return row
