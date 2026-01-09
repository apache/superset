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
"""Types and options for the Global Async Task Framework (GATF)"""

from dataclasses import dataclass


@dataclass(frozen=True)
class TaskOptions:
    """
    Execution metadata for async tasks.

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
