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
Storage API for superset-core extensions.

Provides storage tiers for extensions with different persistence characteristics:

Tier 1 - Local State (Frontend Only):
    - localState: Browser localStorage - persists across sessions
    - sessionState: Browser sessionStorage - cleared on tab close
    These are frontend-only and cannot be imported in backend code.

Tier 2 - Ephemeral State (Server Cache):
    - ephemeral_state: Short-lived KV storage backed by server-side cache
    - Supports TTL, not guaranteed to survive server restarts
    - Use for temporary state like job progress or intermediate results

Tier 3 - Persistent State (Database) [Future]:
    - persistent_state: Durable KV storage backed by database table
    - Survives server restarts, supports encryption and resource linking
    - Use for user preferences, extension config, per-resource settings

All tiers follow the same API pattern:
    - User-scoped by default (private to current user)
    - `shared` accessor for data visible to all users

Usage:
    from superset_core.extensions.storage import ephemeral_state

    # User-scoped state (default - private to current user)
    ephemeral_state.get('preference')
    ephemeral_state.set('preference', 'compact', ttl=3600)

    # Shared state (explicit opt-in - visible to all users)
    ephemeral_state.shared.get('job_progress')
    ephemeral_state.shared.set('job_progress', {'pct': 42}, ttl=3600)

    # Future: Persistent state
    # from superset_core.extensions.storage import persistent_state
    # persistent_state.get('config')
    # persistent_state.for_resource('dashboard', uuid).get('settings')
"""

from superset_core.extensions.storage import ephemeral_state

# Future: Tier 3
# from superset_core.extensions.storage import persistent_state

__all__ = [
    "ephemeral_state",
    # Future: "persistent_state",
]
