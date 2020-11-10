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
from typing import Any, Dict, List, Optional

from flask_appbuilder import Model
from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAOCreateFailedError, DAODeleteFailedError
from superset.extensions import db
from superset.models.reports import ReportRecipients, ReportSchedule

logger = logging.getLogger(__name__)


class ReportScheduleDAO(BaseDAO):
    model_cls = ReportSchedule

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
