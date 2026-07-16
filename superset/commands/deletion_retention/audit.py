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
"""Write-ahead purge audit record (FR-PURGE-012 / C19).

Every purge — time-based or force — writes an immutable record that
**survives** the entity it names, on a **dedicated session** outside the
purge transaction so it neither entangles with the ``DBEventLogger``
(which shares ``db.session`` and commits mid-request) nor vanishes if the
purge rolls back. The record is written ``pending`` *before* the purge and
flipped to ``confirmed`` *after* it commits, so a crash leaves at most a
``pending`` row, never a missing one. ``pending`` rows are reconciled on the
next run (the purge is convergent).

H4 (audit storage sink) is resolved here as a dedicated ``purge_audit_log``
table — the spec's leading, unencumbered candidate. It is content-free (no
name/PII; only action, actor, UTC time, entity type + UUID, and affected
referrers) and is never removed by the purge cascade.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Session, sessionmaker

from superset import db

logger = logging.getLogger(__name__)


def _dedicated_session() -> Session:
    """A fresh session on its own connection, independent of the request /
    task ``db.session`` (FR-PURGE-012): the audit write must commit on its own
    so it survives a rolled-back or crashed purge."""
    return sessionmaker(bind=db.engine)()


STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"

TRIGGER_RETENTION = "retention"
TRIGGER_FORCE = "force"

ACTOR_SYSTEM = "system"


class PurgeAuditLog(Model):
    """Immutable, content-free record of a purge (FR-PURGE-012)."""

    __tablename__ = "purge_audit_log"

    id = Column(Integer, primary_key=True)
    status = Column(String(16), nullable=False, default=STATUS_PENDING)
    trigger = Column(String(16), nullable=False)
    actor = Column(String(256), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_uuid = Column(String(36), nullable=True, index=True)
    # Comma-joined UUIDs of charts left dangling / dashboards that lost a join
    # row (force-purge visibility). Free text, content-free.
    affected_referrers = Column(Text, nullable=True)
    created_on = Column(DateTime, nullable=False)
    confirmed_on = Column(DateTime, nullable=True)


def write_ahead(
    *,
    trigger: str,
    actor: str,
    entity_type: str,
    entity_uuid: Optional[str],
) -> Optional[int]:
    """Insert a ``pending`` audit row on a dedicated session, before the
    purge runs. Returns the row id to confirm later, or ``None`` if the audit
    write itself fails (which must not block the purge)."""
    session = _dedicated_session()
    try:
        record = PurgeAuditLog(
            status=STATUS_PENDING,
            trigger=trigger,
            actor=actor,
            entity_type=entity_type,
            entity_uuid=entity_uuid,
            created_on=datetime.utcnow(),
        )
        session.add(record)
        session.commit()
        return record.id
    except Exception:  # pylint: disable=broad-except
        session.rollback()
        logger.warning(
            "deletion_retention: failed to write pending audit row", exc_info=True
        )
        return None
    finally:
        session.close()


def confirm(record_id: Optional[int], **details: Any) -> None:
    """Flip a ``pending`` row to ``confirmed`` after the purge commits,
    recording any affected referrers. Best-effort: a failure here leaves a
    ``pending`` row that the next run reconciles."""
    if record_id is None:
        return
    session = _dedicated_session()
    try:
        record = session.query(PurgeAuditLog).get(record_id)
        if record is None:
            return
        record.status = STATUS_CONFIRMED
        record.confirmed_on = datetime.utcnow()
        referrers = details.get("affected_referrers")
        if referrers:
            record.affected_referrers = ",".join(referrers)
        session.commit()
    except Exception:  # pylint: disable=broad-except
        session.rollback()
        logger.warning(
            "deletion_retention: failed to confirm audit row %s",
            record_id,
            exc_info=True,
        )
    finally:
        session.close()
