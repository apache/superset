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
    ReportState,
)

logger = logging.getLogger(__name__)


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
        except SQLAlchemyError:
            if commit:
                db.session.rollback()
            raise DAODeleteFailedError()

    @staticmethod
    def validate_update_uniqueness(
        name: str, report_schedule_id: Optional[int] = None
    ) -> bool:
        """
        Validate if this name is unique.

        :param name: The report schedule name
        :param report_schedule_id: The report schedule current id
        (only for validating on updates)
        :return: bool
        """
        query = db.session.query(ReportSchedule).filter(ReportSchedule.name == name)
        if report_schedule_id:
            query = query.filter(ReportSchedule.id != report_schedule_id)
        return not db.session.query(query.exists()).scalar()

    @classmethod
    def create(cls, properties: Dict[str, Any], commit: bool = True) -> Model:
        """
        create a report schedule and nested recipients
        :raises: DAOCreateFailedError
        """
        import json

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
        except SQLAlchemyError:
            db.session.rollback()
            raise DAOCreateFailedError

    @classmethod
    def update(
        cls, model: Model, properties: Dict[str, Any], commit: bool = True
    ) -> Model:
        """
        create a report schedule and nested recipients
        :raises: DAOCreateFailedError
        """
        import json

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
        except SQLAlchemyError:
            db.session.rollback()
            raise DAOCreateFailedError

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
        report_schedule: ReportSchedule, session: Optional[Session] = None,
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
    def bulk_delete_logs(
        model: ReportSchedule,
        from_date: datetime,
        session: Optional[Session] = None,
        commit: bool = True,
    ) -> None:
        session = session or db.session
        try:
            session.query(ReportExecutionLog).filter(
                ReportExecutionLog.report_schedule == model,
                ReportExecutionLog.end_dttm < from_date,
            ).delete(synchronize_session="fetch")
            if commit:
                session.commit()
        except SQLAlchemyError as ex:
            if commit:
                session.rollback()
            raise ex
