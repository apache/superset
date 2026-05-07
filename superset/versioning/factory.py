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
from typing import Any

import sqlalchemy as sa
import sqlalchemy.orm as sa_orm
from sqlalchemy_continuum import is_modified, version_class
from sqlalchemy_continuum.operation import Operation
from sqlalchemy_continuum.plugins.base import Plugin
from sqlalchemy_continuum.plugins.flask import FlaskPlugin
from sqlalchemy_continuum.transaction import TransactionFactory
from sqlalchemy_continuum.utils import versioned_column_properties

logger = logging.getLogger(__name__)


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


class SkipUnmodifiedPlugin(Plugin):
    """Skip creating version rows for UPDATE operations whose post-flush
    column values are byte-identical to the previous live version row.

    Continuum creates a version row for every entity in ``session.dirty``,
    including saves where the SQLAlchemy ORM marked a column dirty (because
    Superset re-serialised ``json_metadata`` via ``json.dumps`` on the save
    path, or AuditMixin auto-bumped ``changed_on``) but the resulting value
    is unchanged from the previous version. Those rows pollute the version
    history with no-op entries.

    ``is_modified()`` from Continuum is not enough: it consults SQLAlchemy's
    attribute history, which is "did setattr produce a different value?",
    not "did the final stored value change?". So we compare each
    non-excluded versioned column on ``operation.target`` against the
    previous live version row's value; if all are equal, the operation
    is marked ``processed`` and Continuum skips it (see
    ``UnitOfWork.create_version_objects``).

    The associated transaction is not removed; if every operation is a
    no-op the transaction becomes an orphan in ``version_transaction``
    and is swept by the retention task.
    """

    def before_create_version_objects(self, uow: Any, session: Any) -> None:
        # ``uow.operations`` is a custom Continuum ``Operations`` collection;
        # use its ``.items()`` method (not ``.values()``) to iterate.
        # INSERTs always create a row (no prior to compare against);
        # DELETEs can't be no-ops. Only UPDATE operations are candidates.
        for _key, operation in uow.operations.items():
            if operation.processed or operation.type != Operation.UPDATE:
                continue
            try:
                if self._is_no_op_update(operation.target, session):
                    operation.processed = True
            except Exception:  # pylint: disable=broad-except
                # Defensive — if introspection fails for any reason, fall
                # back to creating the version row.
                logger.exception(
                    "SkipUnmodifiedPlugin: skip-check raised for %s",
                    type(operation.target).__name__,
                )

    @classmethod
    def _is_no_op_update(cls, target: Any, session: Any) -> bool:
        """Return ``True`` when this UPDATE produces no observable change to
        any non-excluded versioned column.

        Two-stage check:

        1. ``is_modified(target)`` — cheap SQLAlchemy attribute-history check.
           Returns ``False`` when only excluded columns/relationships
           (``owners``, ``changed_on``, …) are dirty. This is the common
           case (every save auto-bumps ``changed_on``); short-circuiting
           here saves the DB round-trip in stage 2.
        2. Compare post-flush column values against the previous live
           version row's stored values. Catches the case where SQLAlchemy
           sees a column as dirty (e.g. ``set_dash_metadata`` re-serialised
           ``json_metadata`` to a different byte sequence) but the
           resulting parsed content matches the prior version.
        """
        if not is_modified(target):
            return True
        return cls._matches_previous_version(target, session)

    @staticmethod
    def _matches_previous_version(target: Any, session: Any) -> bool:
        """Return ``True`` when every non-excluded versioned column on
        *target* matches the value stored in its previous live version row
        (i.e., the row with ``end_transaction_id IS NULL``).

        Returns ``False`` for entities with no prior version row — letting
        Continuum create the first one. In practice this case is rare:
        ``register_baseline_listener`` (in ``superset.versioning.baseline``)
        runs ahead of Continuum's ``before_flush`` and inserts a baseline
        row for any entity being saved for the first time, so the second
        save (and beyond) is what flows through this path.
        """
        cls = type(target)
        try:
            ver_cls = version_class(cls)
        except Exception:  # pylint: disable=broad-except
            return False
        ver_table = ver_cls.__table__

        col_keys = [prop.key for prop in versioned_column_properties(target)]
        if not col_keys:
            return False

        select_stmt = (
            sa.select(*[ver_table.c[c] for c in col_keys])
            .where(ver_table.c.id == target.id)
            .where(ver_table.c.end_transaction_id.is_(None))
            .order_by(ver_table.c.transaction_id.desc())
            .limit(1)
        )
        row = session.connection().execute(select_stmt).first()
        if row is None:
            return False  # no previous version → let Continuum create one

        for col_name, prev_value in zip(col_keys, row, strict=False):
            if getattr(target, col_name, None) != prev_value:
                return False
        return True
