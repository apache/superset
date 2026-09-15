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
"""Exceptions raised by the coordination service."""

from __future__ import annotations


class CoordinationBackendUnavailableError(Exception):
    """Raised when a Valkey/Redis-only primitive is used without a backend.

    Pub/sub, streams, and key/value operations have no in-service fallback, so
    calling them without a configured coordination backend is a programming or
    configuration error rather than a silently-ignored no-op. Callers that have
    their own fallback (e.g. database polling) should gate on
    :meth:`superset.coordination.base.CoordinationService.is_backend_defined` instead of
    catching this.
    """
