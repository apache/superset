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
"""before_flush listener that captures a baseline version (version 0) for entities
being updated for the first time after the versioning migration.

VERSIONED_MODELS is populated at app startup by the initialisation code after
make_versioned() has run and all versioned model classes have been defined.
"""

import logging
from typing import Any, Optional

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Populated at app startup (superset/initialization/__init__.py) before
# register_baseline_listener() is called.
VERSIONED_MODELS: list[type] = []


def _get_user_id() -> Optional[int]:
    """Return the current Flask user's PK, or None outside a request context."""
    try:
        from flask_login import current_user  # pylint: disable=import-outside-toplevel

        if current_user.is_authenticated:
            return int(current_user.id)
    except Exception:  # pylint: disable=broad-except  # noqa: S110
        pass
    return None


def _insert_baseline_row(session: Session, obj: Any, version_table: sa.Table) -> None:
    """Insert a synthetic baseline row capturing the pre-edit DB state of *obj*.

    Creates a version_transaction entry and an operation_type=0 version row.
    All writes use the session's existing connection so they share the same
    database transaction as the triggering flush.
    """
    from sqlalchemy_continuum import (
        versioning_manager,  # pylint: disable=import-outside-toplevel
    )

    main_table = type(obj).__table__
    conn = session.connection()

    # Read the persisted (pre-edit) state of the entity.
    row = (
        conn.execute(sa.select(main_table).where(main_table.c.id == obj.id))
        .mappings()
        .first()
    )
    if row is None:
        return

    # Insert a version_transaction row for the baseline.
    tx_table = versioning_manager.transaction_cls.__table__
    result = conn.execute(
        tx_table.insert().values(
            issued_at=sa.func.now(),
            user_id=_get_user_id(),
            remote_addr=None,
        )
    )
    tx_id = result.inserted_primary_key[0]

    # Build version row using Column objects as keys to avoid name/key mismatches
    # (string-based values(**dict) raises "Unconsumed column names" when a Column's
    # .key differs from its .name, which can happen with Continuum-generated tables).
    meta_col_names = {"transaction_id", "end_transaction_id", "operation_type"}
    col_values: dict[Any, Any] = {}
    for col in version_table.columns:
        if col.name in meta_col_names:
            continue
        if col.name in row:
            col_values[col] = row[col.name]

    col_values[version_table.c.transaction_id] = tx_id
    col_values[version_table.c.end_transaction_id] = None
    col_values[version_table.c.operation_type] = 0

    conn.execute(version_table.insert().values(col_values))


def register_baseline_listener() -> None:
    """Attach the before_flush listener that captures baseline versions.

    Call this after VERSIONED_MODELS has been populated and make_versioned() has run.
    """
    from superset.extensions import db  # pylint: disable=import-outside-toplevel

    # insert=True prepends us in the listener chain so we run BEFORE
    # Continuum's before_flush. Continuum's pending Transaction object
    # (added in its own before_flush) would otherwise get a lower
    # auto-increment tx_id than our direct-SQL baseline insert, placing the
    # baseline row after the update in version_number order. Prepending
    # ensures our baseline's tx_id comes first.
    @event.listens_for(db.session, "before_flush", insert=True)
    def capture_baseline(session: Session, flush_context: Any, instances: Any) -> None:
        if not VERSIONED_MODELS:
            return

        for obj in list(session.dirty):
            if type(obj) not in VERSIONED_MODELS:
                continue

            try:
                from sqlalchemy_continuum import (
                    version_class,  # pylint: disable=import-outside-toplevel
                )

                ver_cls = version_class(type(obj))
                version_table = ver_cls.__table__
            except Exception:  # pylint: disable=broad-except  # noqa: S112
                continue

            try:
                with session.no_autoflush:
                    count = (
                        session.connection()
                        .execute(
                            sa.select(sa.func.count())
                            .select_from(version_table)
                            .where(version_table.c.id == obj.id)
                        )
                        .scalar()
                    )
            except OperationalError:
                # Version table does not yet exist (migration not yet applied).
                continue
            except Exception:  # pylint: disable=broad-except
                logger.exception(
                    "baseline_listener: unexpected error checking version count "
                    "for %s id=%s",
                    type(obj).__name__,
                    getattr(obj, "id", None),
                )
                continue

            if count == 0:
                try:
                    # no_autoflush here too: prevents ``session.connection()``
                    # inside ``_insert_baseline_row`` from triggering a
                    # flush of Continuum's pending Transaction object
                    # before our direct-SQL insert grabs its tx_id.
                    with session.no_autoflush:
                        _insert_baseline_row(session, obj, version_table)
                except Exception:  # pylint: disable=broad-except
                    logger.exception(
                        "baseline_listener: failed to insert baseline for %s id=%s",
                        type(obj).__name__,
                        getattr(obj, "id", None),
                    )
