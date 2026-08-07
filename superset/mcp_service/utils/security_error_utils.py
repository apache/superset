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
Shared helper for surfacing structured SupersetError info from exceptions
caught while running MCP chart/data tools.
"""

from typing import Any


def extract_error_type_and_extra(
    data_error: Exception,
) -> tuple[str | None, dict[str, Any] | None]:
    """Pull the SupersetError's error_type value and extra payload off an exception.

    ``SupersetErrorException`` (e.g. ``SupersetSecurityException``, raised by
    the security manager when row/column/table-level governance denies
    access to a query's underlying resource) carries a ``.error`` attribute
    (a ``SupersetError``) with the real ``error_type`` (e.g.
    ``TABLE_SECURITY_ACCESS_ERROR``, ``DATASOURCE_SECURITY_ACCESS_ERROR``) and
    an ``extra`` dict (e.g. access-request details). Plain exceptions
    (``ValueError``, a bare ``CommandException`` raised without a
    ``SupersetError``) have neither, so both return values are ``None`` for
    them -- callers should fall back to a generic error_type in that case.
    """
    error_obj = getattr(data_error, "error", None)
    extra = getattr(error_obj, "extra", None)
    raw_error_type = getattr(error_obj, "error_type", None)
    error_type = getattr(raw_error_type, "value", raw_error_type)
    return error_type, extra
