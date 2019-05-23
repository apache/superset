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
# pylint: disable=C,R,W
"""Models for scheduled execution of jobs"""

import enum

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean, Column, Enum, ForeignKey, Integer, String, Text,
)
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable, ImportMixin


metadata = Model.metadata  # pylint: disable=no-member


class ScheduleType(enum.Enum):
    slice = 'slice'
    dashboard = 'dashboard'


class EmailDeliveryType(enum.Enum):
    attachment = 'Attachment'
    inline = 'Inline'


class SliceEmailReportFormat(enum.Enum):
    visualization = 'Visualization'
    data = 'Raw data'


class EmailSchedule():

    """Schedules for emailing slices / dashboards"""

    __tablename__ = 'email_schedules'

    id = Column(Integer, primary_key=True)
    active = Column(Boolean, default=True, index=True)
    crontab = Column(String(50))

    @declared_attr
    def user_id(self):
        return Column(Integer, ForeignKey('ab_user.id'))

    @declared_attr
    def user(self):
        return relationship(
            security_manager.user_model,
            backref=self.__tablename__,
            foreign_keys=[self.user_id],
        )

    recipients = Column(Text)
    deliver_as_group = Column(Boolean, default=False)
    delivery_type = Column(Enum(EmailDeliveryType))


class DashboardEmailSchedule(Model,
                             AuditMixinNullable,
                             ImportMixin,
                             EmailSchedule):
    __tablename__ = 'dashboard_email_schedules'
    dashboard_id = Column(Integer, ForeignKey('dashboards.id'))
    dashboard = relationship(
        'Dashboard',
        backref='email_schedules',
        foreign_keys=[dashboard_id],
    )


class SliceEmailSchedule(Model,
                         AuditMixinNullable,
                         ImportMixin,
                         EmailSchedule):
    __tablename__ = 'slice_email_schedules'
    slice_id = Column(Integer, ForeignKey('slices.id'))
    slice = relationship(
        'Slice',
        backref='email_schedules',
        foreign_keys=[slice_id],
    )
    email_format = Column(Enum(SliceEmailReportFormat))


def get_scheduler_model(report_type):
    if report_type == ScheduleType.dashboard.value:
        return DashboardEmailSchedule
    elif report_type == ScheduleType.slice.value:
        return SliceEmailSchedule
