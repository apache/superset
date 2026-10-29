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

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.models.sql_lab import SavedQuery
from superset.utils.core import get_user


def import_saved_query(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> SavedQuery:
    """Import a saved query from a config dict, handling existing matches.

    A saved query is a personal, per-user asset: the REST API scopes read,
    update and delete to ``created_by == g.user`` (``SavedQueryFilter``).
    The same object-level rule is enforced here on the overwrite path so an
    importer cannot replace another user's saved query (and the SQL the
    victim will later run under their own grants) by reusing its UUID in an
    import bundle -- matching the permission checks every sibling importer
    (chart, dashboard, dataset, database, theme) already performs.
    """
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "SavedQuery",
    )
    existing = db.session.query(SavedQuery).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite or not can_write:
            return existing
        # ``user`` is None on background paths (no Flask request user);
        # combined with ``can_write`` (typically from
        # ``ignore_permissions=True``) the ownership check is skipped there
        # because the caller has already established trust -- mirroring the
        # chart importer.
        user = get_user()
        if user and not (security_manager.is_admin() or existing.created_by == user):
            raise ImportFailedError(
                f"Saved query (uuid {config['uuid']}) already exists and "
                "user doesn't have permissions to overwrite it"
            )
        config["id"] = existing.id
    elif not can_write:
        raise ImportFailedError(
            "Saved query doesn't exist and user doesn't have permission to "
            "create saved queries"
        )

    saved_query = SavedQuery.import_from_dict(config, recursive=False)
    if saved_query.id is None:
        db.session.flush()

    return saved_query
