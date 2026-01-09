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
"""Utility functions for the Global Async Task Framework (GATF)"""

import hashlib
import uuid
from typing import Any

from superset.utils import json


def generate_task_key_from_args(
    task_type: str, args: tuple[Any, ...], kwargs: dict[str, Any]
) -> str:
    """
    Generate a task_key from task type and arguments for deduplication.

    This is a HELPER function that can be used to create custom task keys
    based on task arguments. It is NOT used by default - tasks get random UUIDs
    unless an explicit task_key is provided.

    :param task_type: Type of the task
    :param args: Positional arguments passed to the task
    :param kwargs: Keyword arguments passed to the task
    :returns: A task ID string in the format "task_type:hash"

    Example:
        >>> # Explicit deduplication when needed
        >>> task_key = generate_task_key_from_args("thumbnail", (123,), {"force": True})
        >>> task.schedule(123, force=True, options=TaskOptions(task_key=task_key))
    """
    # Create a deterministic representation of the task inputs
    data = {
        "type": task_type,
        "args": args,
        "kwargs": sorted(kwargs.items()),  # Sort for deterministic ordering
    }

    # Serialize to JSON with sorted keys for consistency
    json_str = json.dumps(data, sort_keys=True, default=str)

    # Hash and truncate to reasonable length (16 chars = 64 bits)
    hash_val = hashlib.sha256(json_str.encode()).hexdigest()[:16]

    return f"{task_type}:{hash_val}"


def generate_random_task_key() -> str:
    """
    Generate a random task key.

    This is the default behavior - each task submission gets a unique UUID
    unless an explicit task_key is provided in TaskOptions.

    :returns: A random UUID string
    """
    return str(uuid.uuid4())
