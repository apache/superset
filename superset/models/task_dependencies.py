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
"""TaskDependency model for the Global Task Framework (GTF) task DAG"""

from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from superset_core.tasks.models import TaskDependency as CoreTaskDependency

from superset.models.helpers import AuditMixinNullable


class TaskDependency(CoreTaskDependency, AuditMixinNullable, Model):
    """
    A directed edge in the task dependency graph (DAG).

    The dependent task (``task_id``) waits for the prerequisite task
    (``depends_on_task_id``) to reach a terminal state before it runs. A task
    only executes once *every* prerequisite has reached a terminal SUCCESS; if
    any prerequisite ends in a non-SUCCESS terminal state the dependent fails
    without running (``all_success`` semantics), which cascades transitively to
    its own dependents.

    This is a pure edge table: prerequisite ``Task`` entities are read through
    ``Task.dependencies`` (a self-referential many-to-many over this table).
    Both foreign keys use ``ON DELETE CASCADE`` so edges are cleaned up when
    either endpoint task is pruned. This is required because
    ``TaskPruneCommand`` deletes tasks via a bulk core ``DELETE`` that bypasses
    the ORM cascade.
    """

    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True)
    task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    depends_on_task_id = Column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "task_id",
            "depends_on_task_id",
            name="uq_task_dependencies_task_depends_on",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<TaskDependency task_id={self.task_id} "
            f"depends_on_task_id={self.depends_on_task_id}>"
        )
