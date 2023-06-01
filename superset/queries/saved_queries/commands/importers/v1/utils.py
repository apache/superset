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

from typing import Any

from sqlalchemy.orm import Session

from superset.models.sql_lab import SavedQuery


def import_saved_query(
    session: Session, config: dict[str, Any], overwrite: bool = False
) -> SavedQuery:
    existing = session.query(SavedQuery).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    saved_query = SavedQuery.import_from_dict(session, config, recursive=False)
    if saved_query.id is None:
        session.flush()

    return saved_query
