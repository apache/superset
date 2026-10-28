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

"""Host-supplied execution identity; independent of host frameworks and secrets."""

from dataclasses import dataclass
from enum import Enum


class ExecutionOrigin(str, Enum):
    """Server-established entry point; providers must reject unrecognized origins."""

    REQUEST = "request"
    MCP = "mcp"
    ASYNC_QUERY = "async_query"
    EXPORT = "export"
    CONFIG = "config"
    BACKGROUND = "background"


class ExecutionMethod(str, Enum):
    """Execution methods implemented by the host."""

    CONNECTION = "connection"


@dataclass(frozen=True, kw_only=True)
class SemanticExecutionContext:
    """One trusted binding identity; per-view RLS is separate cache material.

    For unchanged identity inputs, identity_digest is stable within an installation
    across processes and requests. It is non-reversible, rotates with the host
    secret, and is only an opaque partition token, never a durable user identifier.
    It partitions installation, principal, roles and guest status, not individual
    guest tokens, and must not be used as a guest partition key. Guest restrictions,
    if supported, belong in result-cache restriction material, not catalog keys.
    """

    principal_id: str | None
    role_ids: tuple[str, ...]
    origin: ExecutionOrigin
    is_guest: bool
    namespace: str
    identity_digest: str


class SemanticCredentials:
    """Reserved channel for future non-connection credentials; never key material."""
