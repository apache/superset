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

from flask_appbuilder import Model
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from superset_core.tasks.models import TaskSubscriber as CoreTaskSubscriber

from superset.models.helpers import AuditMixinNullable
from superset.tasks.utils import naive_utcnow


class TaskSubscriber(CoreTaskSubscriber, AuditMixinNullable, Model):
    """
    Model for tracking task subscriptions in shared tasks.

    This model enables multi-user collaboration on async tasks. When a user
    schedules a shared task with the same parameters as an existing task,
    they are automatically subscribed to that task instead of creating a
    duplicate.

    Subscribers can unsubscribe from shared tasks. When the last subscriber
    unsubscribes, the task is automatically aborted.

    A subscriber is identified by exactly one of ``user_id`` (an authenticated
    ``ab_user``) or ``guest_key`` (a stable, unguessable identity derived from an
    embedded guest token — see ``superset.tasks.guest``). Guests have no
    ``ab_user`` row, so they subscribe by ``guest_key`` and gain visibility of
    the tasks they created/joined (which SHARED-scope dedup may collapse across
    equivalent guests) through the same subscription mechanism as users.
    """

    __tablename__ = "task_subscribers"

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    # Exactly one of user_id / guest_key is set.
    user_id = Column(
        Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=True
    )
    # A guest key is ``guest:`` + a 64-char SHA256 hex digest (70 chars); the
    # column is sized with headroom (see superset.tasks.guest).
    guest_key = Column(String(128), nullable=True, index=True)
    # Callable default: evaluated per insert, not once at class definition.
    subscribed_at = Column(DateTime, nullable=False, default=naive_utcnow)

    # Relationships
    task = relationship("Task", back_populates="subscribers")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_subscribers_task_user"),
        UniqueConstraint("task_id", "guest_key", name="uq_task_subscribers_task_guest"),
        # Exactly one of user_id / guest_key is set (see the field comment above).
        CheckConstraint(
            "(user_id IS NULL) <> (guest_key IS NULL)",
            name="ck_task_subscribers_user_xor_guest",
        ),
    )

    def __repr__(self) -> str:
        subscriber = self.user_id if self.user_id is not None else self.guest_key
        return f"<TaskSubscriber subscriber={subscriber} task_id={self.task_id}>"
