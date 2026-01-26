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

from dataclasses import asdict, dataclass, fields as dataclass_fields
from typing import Any, NamedTuple

from superset.utils import json
from superset.utils.backports import StrEnum


class FixedExecutor(NamedTuple):
    username: str


class ExecutorType(StrEnum):
    """
    Which user should async tasks be executed as. Used as follows:
    For Alerts & Reports: the "model" refers to the AlertSchedule object
    For Thumbnails: The "model" refers to the Slice or Dashboard object
    """

    # A fixed user account. Note that for assigning a fixed user you should use the
    # FixedExecutor class.
    FIXED_USER = "fixed_user"
    # The creator of the model
    CREATOR = "creator"
    # The creator of the model, if found in the owners list
    CREATOR_OWNER = "creator_owner"
    # The currently logged in user. In the case of Alerts & Reports, this is always
    # None. For Thumbnails, this is the user that requested the thumbnail
    CURRENT_USER = "current_user"
    # The last modifier of the model
    MODIFIER = "modifier"
    # The last modifier of the model, if found in the owners list
    MODIFIER_OWNER = "modifier_owner"
    # An owner of the model. If the last modifier is in the owners list, returns that
    # user. If the modifier is not found, returns the creator if found in the owners
    # list. Finally, if neither are present, returns the first user in the owners list.
    OWNER = "owner"


Executor = FixedExecutor | ExecutorType


# Alias type to represent the executor that was chosen from a list of Executors
ChosenExecutor = tuple[ExecutorType, str]


@dataclass(frozen=True)
class TaskOptions:
    """
    Execution options for tasks.

    NOTE: This is intentionally minimal for the initial implementation.
    Additional options (queue, priority, run_at, delay_s, timeout_s,
    max_retries, retry_backoff_s, tags, etc.) can be added later when needed.

    Future enhancements will include:
    - Options merging (decorator defaults + call-time overrides)
    - Validation (e.g., run_at vs delay_s mutual exclusion)
    - Queue routing and priority management
    - Retry policies and backoff strategies
    """

    task_key: str | None = None


@dataclass
class TaskProperties:
    """
    Typed properties for task execution state and configuration.

    Stored as JSON in the database `properties` column, deserialized into this
    dataclass for type safety. The API returns this as a dict for frontend use.

    Properties are divided into:
    - Runtime state: Values set by the framework during execution
    - Error info: Exception details when task fails
    - Execution config: Values set by the task creator/scheduler

    Frontend derives warnings from these values (e.g., timeout set without
    abort handler, retry in progress) for i18n support.
    """

    # Runtime state - set by framework during execution
    is_abortable: bool | None = None  # Has abort handler registered
    progress_percent: float | None = None  # Progress 0.0-1.0
    progress_current: int | None = None  # Current iteration count
    progress_total: int | None = None  # Total iterations (if known)

    # Error info - set when task fails
    error_message: str | None = None  # Human-readable error message
    exception_type: str | None = None  # Exception class name (e.g., "ValueError")
    stack_trace: str | None = None  # Full formatted traceback

    # Execution config - set at task creation/scheduling
    timeout: int | None = None  # Timeout in seconds (soft limit)
    max_retries: int | None = None  # Maximum retry attempts
    retry_count: int | None = None  # Current retry count

    @classmethod
    def from_json(cls, json_str: str | None) -> TaskProperties:
        """
        Deserialize from JSON string.

        :param json_str: JSON string or None
        :returns: TaskProperties instance with parsed values
        """
        if not json_str:
            return cls()
        try:
            data = json.loads(json_str)
            # Only pass known fields to avoid errors on unknown keys
            known_fields = {f.name for f in dataclass_fields(cls)}
            filtered = {k: v for k, v in data.items() if k in known_fields}
            return cls(**filtered)
        except (json.JSONDecodeError, TypeError):
            return cls()

    def to_json(self) -> str:
        """
        Serialize to JSON string.

        Excludes None values to keep JSON compact.

        :returns: JSON string representation
        """
        return json.dumps({k: v for k, v in asdict(self).items() if v is not None})

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary for API responses.

        Includes all fields, even if None, for consistent API shape.

        :returns: Dictionary representation
        """
        return asdict(self)
