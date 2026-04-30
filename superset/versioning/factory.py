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

import sqlalchemy as sa
import sqlalchemy.orm as sa_orm
from sqlalchemy_continuum.plugins.flask import FlaskPlugin
from sqlalchemy_continuum.transaction import TransactionFactory


class VersionTransactionFactory(TransactionFactory):
    """TransactionFactory that renames the transaction table and adds a bare
    ``user_id`` integer column so the FlaskPlugin can record the acting user
    without requiring a FK relationship to ``ab_user``.

    Continuum only adds ``user_id`` when ``user_cls`` is set on the manager.
    We add it unconditionally (no FK) so that both the FlaskPlugin's
    ``transaction_args()`` and our ``baseline.py`` direct inserts can record
    which user triggered the version event.
    """

    def create_class(self, manager: Any) -> Any:
        cls = super().create_class(manager)
        cls.__table__.name = "version_transaction"
        # Rename the PostgreSQL sequence for consistent naming.
        for col in cls.__table__.columns:
            if col.name == "id" and col.default is not None:
                col.default.name = "version_transaction_id_seq"
        # Add user_id INTEGER (no FK) for user tracking.  The mapper has not
        # been configured yet at this point, so append_column + add_property
        # is safe here.
        user_id_col = sa.Column("user_id", sa.Integer, nullable=True)
        cls.__table__.append_column(user_id_col)
        cls.__mapper__.add_property("user_id", sa_orm.column_property(user_id_col))
        return cls


class VersioningFlaskPlugin(FlaskPlugin):
    """FlaskPlugin subclass that uses Superset's :func:`get_user_id` (which
    reads ``g.user``) instead of Flask-Login's ``current_user``. Superset's
    JWT auth for API routes populates ``g.user`` but leaves
    ``flask_login.current_user`` anonymous, so the upstream plugin would
    record ``user_id=NULL`` on version_transaction rows created by API
    calls. Returns an empty dict (so the transaction row is written
    anyway) when no user is available — e.g. CLI, Celery, import/export.
    """

    def transaction_args(self, uow: Any, session: Any) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from flask import has_request_context, request

        from superset.utils.core import get_user_id

        user_id = get_user_id()
        if user_id is None:
            return {}

        remote_addr: str | None
        try:
            remote_addr = request.remote_addr if has_request_context() else None
        except RuntimeError:
            remote_addr = None

        return {"user_id": user_id, "remote_addr": remote_addr}
