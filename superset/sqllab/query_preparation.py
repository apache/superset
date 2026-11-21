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

import hashlib
from typing import Any, TYPE_CHECKING

from flask import current_app as app
from flask_babel import gettext as __

from superset import config, db
from superset.common.db_query_status import QueryStatus
from superset.exceptions import SupersetGenericErrorException
from superset.models.sql_lab import Query
from superset.utils import json
from superset.utils.core import get_user_id

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import SQLScript
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext

PREPARATION_KEY = "_warning_preparation"


def execution_inputs(context: SqlJsonExecutionContext) -> dict[str, Any]:
    """Capture execution semantics; tab labels and persistence IDs are bookkeeping."""
    return {
        "database_id": context.database_id,
        "sql": context.sql,
        "catalog": context.catalog,
        "schema": context.schema,
        "template_params": context.template_params,
        "limit": context.limit,
        "async": context.async_flag,
        "expand_data": context.expand_data,
        "ctas": context.select_as_cta,
    }


def connection_revision(database: Database) -> str:
    """Fingerprint connection changes without persisting credentials in the snapshot."""
    payload = {
        "changed_on": str(database.changed_on),
        "uri": database.sqlalchemy_uri,
        "extra": database.extra,
        "allow_dml": database.allow_dml,
        "allow_run_async": database.allow_run_async,
        "mutator": bool(app.config["SQL_QUERY_MUTATOR"]),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def preparation_error() -> SupersetGenericErrorException:
    """Require a fresh Run instead of guessing how to resume stale preparation."""
    return SupersetGenericErrorException(
        __(
            "This query preparation is no longer available or has changed. "
            "Run the query again."
        ),
        status=400,
    )


def discard_preparation(client_id: str) -> None:
    """Discard an owned, unexecuted attempt, including pending rendering."""
    db.session.query(Query).filter(
        Query.client_id == client_id,
        Query.user_id == get_user_id(),
        Query.status.in_((QueryStatus.PREPARING, QueryStatus.PREPARED)),
    ).update({Query.status: QueryStatus.DISCARDED}, synchronize_session=False)
    db.session.commit()  # pylint: disable=consider-using-transaction


def validate_prepared_sql(query: Query, script: SQLScript) -> None:
    """Refuse changed security preparation immediately before database dispatch."""
    preparation = query.extra.get(PREPARATION_KEY)
    if not preparation:
        return
    expected = preparation.get("assessed_sql")
    mutator = app.config["SQL_QUERY_MUTATOR"]
    if (
        expected is not None
        and mutator
        and mutator is not config._default_sql_query_mutator
    ):
        raise preparation_error()
    if preparation["connection_revision"] != connection_revision(query.database):
        raise preparation_error()
    if (
        expected is not None
        and script.format(comments=query.database.db_engine_spec.allows_sql_comments)
        != expected
    ):
        raise preparation_error()
