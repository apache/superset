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

"""
Async Task API for superset-core.

Provides model classes and enums for async task management
that will be replaced by host implementations during initialization.

Usage:
    from superset_core.api.async_tasks import AsyncTask, TaskStatus
"""

from enum import Enum


class TaskStatus(Enum):
    """Enumeration of task execution statuses."""

    PENDING = "pending"
    RUNNING = "running"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


__all__ = [
    "TaskStatus",
]
