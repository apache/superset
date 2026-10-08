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

import logging
from datetime import datetime
from typing import Any, cast, Literal

from flask import current_app
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum
from superset.daos.key_value import KeyValueDAO
from superset.extensions import db, feature_flag_manager
from superset.key_value.types import (
    FIXED_RESOURCE_KEYS,
    JsonKeyValueCodec,
    KeyValueResource,
)
from superset.reports.filters import ReportScheduleFilter
from superset.reports.models import (
    ReportConfigKey,
    ReportExecutionLog,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.reports.types import ReportConfigDocument, ReportConfigSettings
from superset.reports.utils import find_disallowed_addresses
from superset.utils import json
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER = "Notification sent with error"


class ReportScheduleDAO(BaseDAO[ReportSchedule]):
    base_filter = ReportScheduleFilter

    @classmethod
    def apply_column_operators(
        cls,
        query: Any,
        column_operators: list[ColumnOperator] | None = None,
    ) -> Any:
        """Override to handle editor self-filters via subqueries.

        - editor: filters reports by editor user ID via report_schedule_editors
        - created_by_fk_or_editor: OR(created_by_fk == value, id IN editor_subq)
        """
        if not column_operators:
            return query

        remaining_operators: list[ColumnOperator] = []
        for c in column_operators:
            if not isinstance(c, ColumnOperator):
                c = ColumnOperator.model_validate(c)
            if c.col == "editor":
                from superset.subjects.models import report_schedule_editors, Subject

                operator_enum = ColumnOperatorEnum(c.opr)
                subq = (
                    select(report_schedule_editors.c.report_schedule_id)
                    .join(
                        Subject.__table__,
                        Subject.__table__.c.id == report_schedule_editors.c.subject_id,
                    )
                    .where(
                        Subject.__table__.c.type == 1,
                        operator_enum.apply(Subject.__table__.c.user_id, c.value),
                    )
                )
                query = query.filter(ReportSchedule.id.in_(subq))
            elif c.col == "created_by_fk_or_editor":
                if c.opr != "eq":
                    raise ValueError(
                        f"created_by_fk_or_editor only supports 'eq'; got '{c.opr}'"
                    )
                from superset.subjects.models import report_schedule_editors, Subject

                editor_subq = (
                    select(report_schedule_editors.c.report_schedule_id)
                    .join(
                        Subject.__table__,
                        Subject.__table__.c.id == report_schedule_editors.c.subject_id,
                    )
                    .where(
                        Subject.__table__.c.type == 1,
                        Subject.__table__.c.user_id == c.value,
                    )
                )
                query = query.filter(
                    or_(
                        ReportSchedule.created_by_fk == c.value,
                        ReportSchedule.id.in_(editor_subq),
                    )
                )
            else:
                remaining_operators.append(c)

        if remaining_operators:
            query = super().apply_column_operators(query, remaining_operators)
        return query

    @staticmethod
    def find_by_chart_id(chart_id: int) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.chart_id == chart_id)
            .all()
        )

    @staticmethod
    def find_by_chart_ids(chart_ids: list[int]) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.chart_id.in_(chart_ids))
            .all()
        )

    @staticmethod
    def find_by_dashboard_id(dashboard_id: int) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.dashboard_id == dashboard_id)
            .all()
        )

    @staticmethod
    def find_by_dashboard_ids(dashboard_ids: list[int]) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.dashboard_id.in_(dashboard_ids))
            .all()
        )

    @staticmethod
    def find_by_database_id(database_id: int) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.database_id == database_id)
            .all()
        )

    @staticmethod
    def find_by_database_ids(database_ids: list[int]) -> list[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.database_id.in_(database_ids))
            .all()
        )

    @staticmethod
    def find_by_extra_metadata(slug: str) -> list[ReportSchedule]:
        """
        Searches extra_json for a substring.

        Matching is a plain substring scan that ignores which dashboard a
        report belongs to, so callers acting on a single dashboard have to
        narrow the results on ``dashboard_id`` themselves.
        """
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.extra_json.contains(slug, autoescape=True))
            .all()
        )

    @staticmethod
    def find_by_native_filter_id(native_filter_id: str) -> list[ReportSchedule]:
        """
        Searches extra_json for a filter ID string.

        Carries the same caveat as :meth:`find_by_extra_metadata`: results span
        every dashboard, not just the one owning the filter.
        """
        return (
            db.session.query(ReportSchedule)
            .filter(
                ReportSchedule.extra_json.contains(native_filter_id, autoescape=True)
            )
            .all()
        )

    @staticmethod
    def validate_unique_creation_method(
        dashboard_id: int | None = None,
        chart_id: int | None = None,
        creation_method: str | None = None,
    ) -> bool:
        """
        Validate if the user already has a chart or dashboard with a report
        attached that was created via the same creation method as the one
        being validated. Only reports created through the same method (e.g.
        two "charts"-sourced reports) compete for the one-per-object slot --
        an unrelated self-subscribed alert/report (creation method
        "alerts_reports") on the same chart or dashboard doesn't count
        against it.
        """

        query = db.session.query(ReportSchedule).filter_by(created_by_fk=get_user_id())
        if dashboard_id is not None:
            query = query.filter(ReportSchedule.dashboard_id == dashboard_id)

        if creation_method is not None:
            query = query.filter(ReportSchedule.creation_method == creation_method)

        if chart_id is not None:
            query = query.filter(ReportSchedule.chart_id == chart_id)

        return not db.session.query(query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(
        name: str, report_type: ReportScheduleType, expect_id: int | None = None
    ) -> bool:
        """
        Validate if this name and type is unique.

        :param name: The report schedule name
        :param report_type: The report schedule type
        :param expect_id: The id of the expected report schedule with the
          name + type combination. Useful for validating existing report schedule.
        :return: bool
        """
        found_id = (
            db.session.query(ReportSchedule.id)
            .filter(ReportSchedule.name == name, ReportSchedule.type == report_type)
            .limit(1)
            .scalar()
        )
        return found_id is None or found_id == expect_id

    @classmethod
    def create(
        cls,
        item: ReportSchedule | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> ReportSchedule:
        """
        Create a report schedule with nested recipients.

        :param item: The object to create
        :param attributes: The attributes associated with the object to create
        """

        # TODO(john-bodley): Determine why we need special handling for recipients.
        if not item:
            item = ReportSchedule()

        if attributes:
            if recipients := attributes.pop("recipients", None):
                attributes["recipients"] = [
                    ReportRecipients(
                        type=recipient["type"],
                        recipient_config_json=json.dumps(
                            recipient["recipient_config_json"]
                        ),
                        report_schedule=item,
                    )
                    for recipient in recipients
                ]

        return super().create(item, attributes)

    @classmethod
    def update(
        cls,
        item: ReportSchedule | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> ReportSchedule:
        """
        Update a report schedule with nested recipients.

        :param item: The object to update
        :param attributes: The attributes associated with the object to update
        """

        # TODO(john-bodley): Determine why we need special handling for recipients.
        if not item:
            item = ReportSchedule()

        if attributes:
            if "recipients" in attributes:
                recipients = attributes.pop("recipients")
                attributes["recipients"] = [
                    ReportRecipients(
                        type=recipient["type"],
                        recipient_config_json=json.dumps(
                            recipient["recipient_config_json"]
                        ),
                        report_schedule=item,
                    )
                    for recipient in recipients
                ]

        return super().update(item, attributes)

    @staticmethod
    def find_active() -> list[ReportSchedule]:
        """
        Find all active reports.
        """
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.active.is_(True))
            .all()
        )

    @staticmethod
    def find_last_success_log(
        report_schedule: ReportSchedule,
    ) -> ReportExecutionLog | None:
        """
        Finds last success execution log for a given report
        """
        return (
            db.session.query(ReportExecutionLog)
            .filter(
                ReportExecutionLog.state == ReportState.SUCCESS,
                ReportExecutionLog.report_schedule == report_schedule,
            )
            .order_by(ReportExecutionLog.end_dttm.desc())
            .first()
        )

    @staticmethod
    def find_last_entered_working_log(
        report_schedule: ReportSchedule,
    ) -> ReportExecutionLog | None:
        """
        Finds last success execution log for a given report
        """
        return (
            db.session.query(ReportExecutionLog)
            .filter(
                ReportExecutionLog.state == ReportState.WORKING,
                ReportExecutionLog.report_schedule == report_schedule,
                ReportExecutionLog.error_message.is_(None),
            )
            .order_by(ReportExecutionLog.end_dttm.desc())
            .first()
        )

    @staticmethod
    def find_last_error_notification(
        report_schedule: ReportSchedule,
    ) -> ReportExecutionLog | None:
        """
        Finds last error email sent
        """
        last_error_email_log = (
            db.session.query(ReportExecutionLog)
            .filter(
                ReportExecutionLog.error_message
                == REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER,
                ReportExecutionLog.report_schedule == report_schedule,
            )
            .order_by(ReportExecutionLog.end_dttm.desc())
            .first()
        )
        if not last_error_email_log:
            return None
        # Checks that only errors have occurred since the last email
        report_from_last_email = (
            db.session.query(ReportExecutionLog)
            .filter(
                ReportExecutionLog.state.notin_(
                    [ReportState.ERROR, ReportState.WORKING]
                ),
                ReportExecutionLog.report_schedule == report_schedule,
                ReportExecutionLog.end_dttm < last_error_email_log.end_dttm,
            )
            .order_by(ReportExecutionLog.end_dttm.desc())
            .first()
        )
        return last_error_email_log if not report_from_last_email else None

    @staticmethod
    def bulk_delete_logs(model: ReportSchedule, from_date: datetime) -> int | None:
        return (
            db.session.query(ReportExecutionLog)
            .filter(
                ReportExecutionLog.report_schedule == model,
                ReportExecutionLog.end_dttm < from_date,
            )
            .delete(synchronize_session="fetch")
        )

    @staticmethod
    def find_with_email_recipients() -> list[ReportSchedule]:
        """
        Find every schedule (active or not) with at least one e-mail recipient.
        """
        return (
            db.session.query(ReportSchedule)
            .join(
                ReportRecipients,
                ReportRecipients.report_schedule_id == ReportSchedule.id,
            )
            .filter(ReportRecipients.type == ReportRecipientType.EMAIL)
            .options(selectinload(ReportSchedule.recipients))
            .distinct()
            .all()
        )

    @staticmethod
    def find_by_type(report_type: ReportScheduleType) -> list[ReportSchedule]:
        """
        Find every schedule (active or not) of the given type.
        """
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.type == report_type)
            .all()
        )


class ReportConfigDAO:
    """
    Access to the global Alerts & Reports configuration in ``key_value``.

    One versioned document stores only settings explicitly saved by an admin.
    Missing settings resolve to legacy application config or feature flag values.
    """

    VERSION: Literal[1] = 1

    @staticmethod
    def lock_for_update() -> None:
        """Serialize configuration validation and merging within a transaction."""
        KeyValueDAO.get_entry(
            KeyValueResource.ALERT_REPORT_CONFIG,
            FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
            for_update=True,
        )

    @staticmethod
    def get_stored_values() -> dict[str, Any]:
        """
        Return explicitly saved settings from the versioned document.

        A stored null is distinct from a missing setting key.
        """
        document: ReportConfigDocument | None = KeyValueDAO.get_value(
            KeyValueResource.ALERT_REPORT_CONFIG,
            FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
            JsonKeyValueCodec(),
        )
        if document is None:
            return {}
        return dict(document["settings"])

    @staticmethod
    def get_fallback_value(key: ReportConfigKey) -> Any:
        """Return the legacy application config / feature flag value for ``key``."""
        if key == ReportConfigKey.ALERTS_ATTACH_REPORTS:
            return feature_flag_manager.is_feature_enabled("ALERTS_ATTACH_REPORTS")
        if key == ReportConfigKey.DATE_FORMAT_IN_EMAIL_SUBJECT:
            return feature_flag_manager.is_feature_enabled(
                "DATE_FORMAT_IN_EMAIL_SUBJECT"
            )
        if key in (
            ReportConfigKey.ALERT_MINIMUM_INTERVAL,
            ReportConfigKey.REPORT_MINIMUM_INTERVAL,
        ):
            value = current_app.config.get(key.upper(), 0)
            return value() if callable(value) else value
        # These are new configs, no legacy fallback
        if key == ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS:
            return False
        if key == ReportConfigKey.ALLOWED_EMAIL_DOMAINS:
            return []
        return None

    @staticmethod
    def get_effective_value(key: ReportConfigKey) -> Any:
        """
        Return the value in effect for ``key``: the stored value when present,
        otherwise the legacy fallback.
        """
        if key in (stored := ReportConfigDAO.get_stored_values()):
            return stored[key]
        return ReportConfigDAO.get_fallback_value(key)

    @staticmethod
    def get_effective_config() -> dict[str, Any]:
        """Return the value in effect for every ``ReportConfigKey``."""
        stored = ReportConfigDAO.get_stored_values()
        return {
            key.value: (
                stored[key]
                if key in stored
                else ReportConfigDAO.get_fallback_value(key)
            )
            for key in ReportConfigKey
        }

    @staticmethod
    def upsert(values: dict[str, Any]) -> None:
        """
        Merge submitted settings into the shared document without committing.
        Only absent keys inherit application configuration; null stays explicit.
        """
        stored = ReportConfigDAO.get_stored_values()
        for key, value in values.items():
            stored[key] = value
        document: ReportConfigDocument = {
            "version": ReportConfigDAO.VERSION,
            "settings": cast(ReportConfigSettings, stored),
        }
        KeyValueDAO.update_entry(
            KeyValueResource.ALERT_REPORT_CONFIG,
            document,
            JsonKeyValueCodec(),
            FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
        )

    @staticmethod
    def get_known_user_emails(addresses: list[str]) -> set[str]:
        """
        Return the lower-cased e-mails, among ``addresses``, that belong to
        active users.
        """
        from superset import security_manager  # noqa: PLC0415

        if not addresses:
            return set()
        user_model = security_manager.user_model
        lowered = sorted({address.lower() for address in addresses})
        known: set[str] = set()
        # Bound IN clauses for metadata databases with parameter limits.
        for offset in range(0, len(lowered), 500):
            rows = (
                db.session.query(func.lower(user_model.email))
                .filter(
                    func.lower(user_model.email).in_(lowered[offset : offset + 500]),
                    user_model.active.is_(True),
                )
                .all()
            )
            known.update(row[0] for row in rows)
        return known

    @staticmethod
    def find_disallowed_addresses(
        addresses: list[str],
        *,
        allowed_domains: list[str] | None = None,
        limit_to_users: bool | None = None,
        known_emails: set[str] | None = None,
    ) -> list[str]:
        """
        Return the addresses violating the recipient policy.

        ``allowed_domains`` and ``limit_to_users`` override the effective
        configuration when provided, which lets the configuration command
        validate a proposed policy before saving it. ``known_emails`` reuses a
        batch lookup when validating multiple schedules under users-only policy.
        """
        if not addresses:
            return []
        if allowed_domains is None:
            allowed_domains = ReportConfigDAO.get_effective_value(
                ReportConfigKey.ALLOWED_EMAIL_DOMAINS
            )
        if limit_to_users is None:
            limit_to_users = ReportConfigDAO.get_effective_value(
                ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS
            )
        if not allowed_domains and not limit_to_users:
            return []
        if limit_to_users and known_emails is None:
            known_emails = ReportConfigDAO.get_known_user_emails(addresses)
        if not limit_to_users:
            known_emails = None
        return find_disallowed_addresses(
            addresses,
            allowed_domains=allowed_domains,
            known_emails=known_emails,
        )
