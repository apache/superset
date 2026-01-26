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
"""TaskSubscriber model for tracking multi-user task subscriptions"""

from datetime import datetime

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from superset_core.api.models import TaskSubscriber as CoreTaskSubscriber

from superset.models.helpers import AuditMixinNullable


class TaskSubscriber(CoreTaskSubscriber, AuditMixinNullable, Model):
    """
    Model for tracking task subscriptions in shared tasks.

    This model enables multi-user collaboration on async tasks. When a user
    schedules a shared task with the same parameters as an existing task,
    they are automatically subscribed to that task instead of creating a
    duplicate.

    Subscribers can unsubscribe from shared tasks. When the last subscriber
    unsubscribes, the task is automatically aborted.
    """

    __tablename__ = "task_subscribers"

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False
    )
    subscribed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    task = relationship("Task", back_populates="subscribers")
    # Explicitly specify foreign_keys to avoid ambiguity with audit fields
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_subscribers_task_user"),
    )

    def __repr__(self) -> str:
        return f"<TaskSubscriber user_id={self.user_id} task_id={self.task_id}>"
