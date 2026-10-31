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
"""Transactional persistence for authenticated Teams installation events."""

from datetime import datetime, timezone
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from superset.integrations.teams.config import validate_team_id
from superset.integrations.teams.models import TeamsInstallation


def _identity(
    tenant_id: str, application_id: str, team_id: str
) -> tuple[UUID, UUID, str]:
    """Validate and normalize the installation identity without echoing input."""
    try:
        tenant = UUID(tenant_id)
        application = UUID(application_id)
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Teams tenant and application IDs must be UUIDs") from None
    if not tenant.int or not application.int:
        raise ValueError("Teams tenant and application IDs must be nonzero UUIDs")
    return tenant, application, validate_team_id(team_id)


def _service_url(value: str) -> str:
    """Check URL shape; the caller must verify authenticity and Microsoft ownership."""
    try:
        url = urlsplit(value)
        valid = (
            isinstance(value, str)
            and len(value) <= 2048
            and not any(
                character.isspace() or ord(character) < 32 for character in value
            )
            and url.scheme == "https"
            and bool(url.hostname)
            and url.port in (None, 443)
            and url.username is None
            and url.password is None
            and not url.query
            and not url.fragment
        )
    except (ValueError, TypeError, AttributeError):
        valid = False
    if not valid:
        raise ValueError("Teams verified service URL must be an HTTPS URL")
    return value


class TeamsInstallationStore:
    """Persist verified events without committing or modifying configured destinations.

    Callers must authenticate events, enforce the deployment tenant/application,
    and verify service URLs before invoking this store. This layer stores no
    credentials or channels and never makes a team selectable on its own.
    Events are ordered by their source timestamp, with removal winning ties.
    """

    def __init__(self, session: Session) -> None:
        """Use the caller's metadata database transaction."""
        self.session = session

    def get_active(
        self, tenant_id: str, application_id: str, team_id: str
    ) -> TeamsInstallation | None:
        """Return the active installation for exactly the supplied identity."""
        tenant, application, team = _identity(tenant_id, application_id, team_id)
        return (
            self.session.query(TeamsInstallation)
            .populate_existing()
            .filter_by(
                tenant_id=tenant, application_id=application, team_id=team, active=True
            )
            .one_or_none()
        )

    def install(
        self,
        tenant_id: str,
        application_id: str,
        team_id: str,
        verified_service_url: str,
        event_at: datetime,
    ) -> TeamsInstallation:
        """Apply an installation only if it is newer than the stored event."""
        return self._apply(
            tenant_id, application_id, team_id, verified_service_url, event_at, True
        )

    def remove(
        self,
        tenant_id: str,
        application_id: str,
        team_id: str,
        verified_service_url: str,
        event_at: datetime,
    ) -> None:
        """Retain a removal tombstone, including when the install has not arrived."""
        self._apply(
            tenant_id, application_id, team_id, verified_service_url, event_at, False
        )

    def _apply(
        self,
        tenant_id: str,
        application_id: str,
        team_id: str,
        verified_service_url: str,
        event_at: datetime,
        active: bool,
    ) -> TeamsInstallation:
        """Serialize writes per identity and ignore stale or duplicate events."""
        tenant, application, team = _identity(tenant_id, application_id, team_id)
        service_url = _service_url(verified_service_url)
        if event_at.tzinfo is None or event_at.utcoffset() is None:
            raise ValueError("Teams event timestamp must include a timezone")
        event_at = event_at.astimezone(timezone.utc).replace(tzinfo=None)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        table = TeamsInstallation.__table__
        identity = (
            table.update()
            .where(table.c.tenant_id == tenant)
            .where(table.c.application_id == application)
            .where(table.c.team_id == team)
        )
        # Lock through a write so repeatable-read databases also see insert races.
        lock = identity.values(team_id=team)
        self.session.flush()
        connection = self.session.connection()
        if not connection.execute(lock).rowcount:
            try:
                with connection.begin_nested():
                    connection.execute(
                        table.insert().values(
                            tenant_id=tenant,
                            application_id=application,
                            team_id=team,
                            service_url=service_url,
                            active=active,
                            event_at=event_at,
                            created_on=now,
                            changed_on=now,
                        )
                    )
            except IntegrityError:
                if not connection.execute(lock).rowcount:
                    raise
        newer = table.c.event_at < event_at
        if not active:
            newer |= (table.c.event_at == event_at) & table.c.active
        connection.execute(
            identity.where(newer).values(
                service_url=service_url,
                active=active,
                event_at=event_at,
                changed_on=now,
            )
        )
        return (
            self.session.query(TeamsInstallation)
            .populate_existing()
            .filter_by(tenant_id=tenant, application_id=application, team_id=team)
            .one()
        )
