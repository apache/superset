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
"""Constants for the MCP service."""

from typing import Literal

from superset.errors import SupersetErrorType

# Supported model types for schema discovery and MCP tools
ModelType = Literal["chart", "dataset", "dashboard", "database", "report"]

# Pagination defaults
DEFAULT_PAGE_SIZE = 10  # Default number of items per page
MAX_PAGE_SIZE = 100  # Maximum allowed page_size to prevent oversized responses

# Response size guard defaults
DEFAULT_MAX_RESPONSE_BYTES = 50_000  # ~50KB preserves the former 25K-token guard
DEFAULT_WARN_THRESHOLD_PCT = 80  # Log warnings above 80% of limit
# Phase 2 list-field truncation cap; matches MAX_PAGE_SIZE
DEFAULT_MAX_LIST_ITEMS = 100

# Error types that mean the connection to the analytics database failed, as
# opposed to the query being malformed. Shared by chart compilation (which
# retries/reports connection trouble separately) and the MCP error handler
# (which must not blame the caller for an unreachable datasource).
#
# GENERIC_DB_ENGINE_ERROR is included because many engines (BigQuery,
# Snowflake, Athena, Databricks, Trino) lack specific CONNECTION_* regex
# patterns in their engine specs — all their connection failures fall back
# to this generic type.
CONNECTION_ERROR_TYPES = frozenset(
    {
        SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
        SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
        SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
        SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
        SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
        SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
        SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
        SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
        SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
        SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
        SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
    }
)
