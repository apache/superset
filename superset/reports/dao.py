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
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask_appbuilder import Model
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAOCreateFailedError, DAODeleteFailedError
from superset.extensions import db
from superset.models.reports import (
    ReportExecutionLog,
    ReportRecipients,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)

logger = logging.getLogger(__name__)


REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER = "Notification sent with error"


class ReportScheduleDAO(BaseDAO):
    model_cls = ReportSchedule

    @staticmethod
    def find_by_chart_id(chart_id: int) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.chart_id == chart_id)
            .all()
        )

    @staticmethod
    def find_by_chart_ids(chart_ids: List[int]) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.chart_id.in_(chart_ids))
            .all()
        )

    @staticmethod
    def find_by_dashboard_id(dashboard_id: int) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.dashboard_id == dashboard_id)
            .all()
        )

    @staticmethod
    def find_by_dashboard_ids(dashboard_ids: List[int]) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.dashboard_id.in_(dashboard_ids))
            .all()
        )

    @staticmethod
    def find_by_database_id(database_id: int) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.database_id == database_id)
            .all()
        )

    @staticmethod
    def find_by_database_ids(database_ids: List[int]) -> List[ReportSchedule]:
        return (
            db.session.query(ReportSchedule)
            .filter(ReportSchedule.database_id.in_(database_ids))
            .all()
        )

    @staticmethod
    def bulk_delete(
        models: Optional[List[ReportSchedule]], commit: bool = True
    ) -> None:
        item_ids = [model.id for model in models] if models else []
        try:
            # Clean owners secondary table
            report_schedules = (
                db.session.query(ReportSchedule)
                .filter(ReportSchedule.id.in_(item_ids))
                .all()
            )
            for report_schedule in report_schedules:
                report_schedule.owners = []
            for report_schedule in report_schedules:
                db.session.delete(report_schedule)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            if commit:
                db.session.rollback()
            raise DAODeleteFailedError(str(ex)) from ex

    @staticmethod
    def validate_unique_creation_method(
        user_id: int, dashboard_id: Optional[int] = None, chart_id: Optional[int] = None
    ) -> bool:
        """
        Validate if the user already has a chart or dashboard
        with a report attached form the self subscribe reports
        """

        query = db.session.query(ReportSchedule).filter_by(created_by_fk=user_id)
        if dashboard_id is not None:
            query = query.filter(ReportSchedule.dashboard_id == dashboard_id)

        if chart_id is not None:
            query = query.filter(ReportSchedule.chart_id == chart_id)

        return not db.session.query(query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(
        name: str, report_type: ReportScheduleType, expect_id: Optional[int] = None
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
    def create(cls, properties: Dict[str, Any], commit: bool = True) -> Model:
        """
        create a report schedule and nested recipients
        :raises: DAOCreateFailedError
        """

        try:
            model = ReportSchedule()
            for key, value in properties.items():
                if key != "recipients":
                    setattr(model, key, value)
            recipients = properties.get("recipients", [])
            for recipient in recipients:
                model.recipients.append(  # pylint: disable=no-member
                    ReportRecipients(
                        type=recipient["type"],
                        recipient_config_json=json.dumps(
                            recipient["recipient_config_json"]
                        ),
                    )
                )
            db.session.add(model)
            if commit:
                db.session.commit()
            return model
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise DAOCreateFailedError(str(ex)) from ex

    @classmethod
    def update(
        cls, model: Model, properties: Dict[str, Any], commit: bool = True
    ) -> Model:
        """
        create a report schedule and nested recipients
        :raises: DAOCreateFailedError
        """

        try:
            for key, value in properties.items():
                if key != "recipients":
                    setattr(model, key, value)
            if "recipients" in properties:
                recipients = properties["recipients"]
                model.recipients = [
                    ReportRecipients(
                        type=recipient["type"],
                        recipient_config_json=json.dumps(
                            recipient["recipient_config_json"]
                        ),
                        report_schedule=model,
                    )
                    for recipient in recipients
                ]
            db.session.merge(model)
            if commit:
                db.session.commit()
            return model
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise DAOCreateFailedError(str(ex)) from ex

    @staticmethod
    def find_active(session: Optional[Session] = None) -> List[ReportSchedule]:
        """
        Find all active reports. If session is passed it will be used instead of the
        default `db.session`, this is useful when on a celery worker session context
        """
        session = session or db.session
        return (
            session.query(ReportSchedule).filter(ReportSchedule.active.is_(True)).all()
        )

    @staticmethod
    def find_last_success_log(
        report_schedule: ReportSchedule,
        session: Optional[Session] = None,
    ) -> Optional[ReportExecutionLog]:
        """
        Finds last success execution log for a given report
        """
        session = session or db.session
        return (
            session.query(ReportExecutionLog)
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
        session: Optional[Session] = None,
    ) -> Optional[ReportExecutionLog]:
        """
        Finds last success execution log for a given report
        """
        session = session or db.session
        return (
            session.query(ReportExecutionLog)
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
        session: Optional[Session] = None,
    ) -> Optional[ReportExecutionLog]:
        """
        Finds last error email sent
        """
        session = session or db.session
        last_error_email_log = (
            session.query(ReportExecutionLog)
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
            session.query(ReportExecutionLog)
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
    def bulk_delete_logs(
        model: ReportSchedule,
        from_date: datetime,
        session: Optional[Session] = None,
        commit: bool = True,
    ) -> Optional[int]:
        session = session or db.session
        try:
            row_count = (
                session.query(ReportExecutionLog)
                .filter(
                    ReportExecutionLog.report_schedule == model,
                    ReportExecutionLog.end_dttm < from_date,
                )
                .delete(synchronize_session="fetch")
            )
            if commit:
                session.commit()
            return row_count
        except SQLAlchemyError as ex:
            if commit:
                session.rollback()
            raise DAODeleteFailedError(str(ex)) from ex
