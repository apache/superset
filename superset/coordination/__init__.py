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
"""Centralized coordination service.

Provides one connection (``DISTRIBUTED_COORDINATION_CONFIG``) and one interface for
the Valkey/Redis coordination primitives Superset relies on: **pub/sub**, **key/value**,
and event **streams**, plus a higher-level **await/notify** layer (``wait_for_signal`` /
``listen_for_signal``) built on top of them. Distributed **locking** is served by
:class:`~superset.distributed_lock.DistributedLock`, which draws on this service's
backend when one is configured and falls back to a database-backed lock otherwise.

Historically these were wired up independently: the Global Task Framework used
``DISTRIBUTED_COORDINATION_CONFIG`` (pub/sub and locking) while Global Async Queries
used a separate cache backend for their event streams, and each caller hand-rolled
its own pub/sub-vs-poll wait loops. Consolidating them here keeps the architecture
modular, gives other components (e.g. the extensions framework) a single reusable
coordination surface, and reduces the number of moving parts. All coordination —
including async chart-data queries, which now run on the Global Task Framework —
uses ``DISTRIBUTED_COORDINATION_CONFIG`` exclusively.

Import concrete classes directly from their modules:
:class:`~superset.coordination.base.CoordinationService`,
:class:`~superset.coordination.types.SignalListener`, and
:class:`~superset.coordination.exceptions.CoordinationBackendUnavailableError`.
"""
