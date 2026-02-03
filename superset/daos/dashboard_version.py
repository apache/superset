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
"""DAO for dashboard version snapshots."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import desc, func

from superset.extensions import db
from superset.models.dashboard_version import DashboardVersion


class DashboardVersionDAO:
    @staticmethod
    def create(
        dashboard_id: int,
        version_number: int,
        position_json: Optional[str],
        json_metadata: Optional[str],
        created_by_fk: Optional[int] = None,
        comment: Optional[str] = None,
    ) -> DashboardVersion:
        v = DashboardVersion(
            dashboard_id=dashboard_id,
            version_number=version_number,
            position_json=position_json,
            json_metadata=json_metadata,
            created_at=datetime.utcnow(),
            created_by_fk=created_by_fk,
            comment=comment,
        )
        db.session.add(v)
        db.session.flush()
        return v

    @staticmethod
    def get_next_version_number(dashboard_id: int) -> int:
        r = (
            db.session.query(
                func.coalesce(func.max(DashboardVersion.version_number), 0)
            )
            .filter(DashboardVersion.dashboard_id == dashboard_id)
            .scalar()
        )
        return int(r) + 1

    @staticmethod
    def get_versions_for_dashboard(dashboard_id: int) -> list[DashboardVersion]:
        return (
            db.session.query(DashboardVersion)
            .filter(DashboardVersion.dashboard_id == dashboard_id)
            .order_by(desc(DashboardVersion.version_number))
            .all()
        )

    @staticmethod
    def get_by_id(version_id: int) -> Optional[DashboardVersion]:
        return (
            db.session.query(DashboardVersion)
            .filter(DashboardVersion.id == version_id)
            .one_or_none()
        )

    @staticmethod
    def update_comment(
        version_id: int,
        dashboard_id: int,
        comment: Optional[str],
    ) -> Optional[DashboardVersion]:
        version = (
            db.session.query(DashboardVersion)
            .filter(
                DashboardVersion.id == version_id,
                DashboardVersion.dashboard_id == dashboard_id,
            )
            .one_or_none()
        )
        if not version:
            return None
        version.comment = (comment or "").strip() or None
        db.session.flush()
        return version

    @staticmethod
    def delete_older_than(dashboard_id: int, keep_n: int) -> None:
        ids_to_keep = (
            db.session.query(DashboardVersion.id)
            .filter(DashboardVersion.dashboard_id == dashboard_id)
            .order_by(desc(DashboardVersion.version_number))
            .limit(keep_n)
            .all()
        )
        keep_ids = [row[0] for row in ids_to_keep]
        if keep_ids:
            db.session.query(DashboardVersion).filter(
                DashboardVersion.dashboard_id == dashboard_id,
                ~DashboardVersion.id.in_(keep_ids),
            ).delete(synchronize_session=False)
        else:
            db.session.query(DashboardVersion).filter(
                DashboardVersion.dashboard_id == dashboard_id
            ).delete(synchronize_session=False)
