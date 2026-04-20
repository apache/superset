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
Shared helper functions for MCP chart tools.

This module contains reusable utility functions for common operations
across chart tools: chart lookup, cached form data retrieval, and
URL parameter extraction. Config mapping logic lives in chart_utils.py.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

if TYPE_CHECKING:
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def find_chart_by_identifier(identifier: int | str) -> Slice | None:
    """Find a chart by numeric ID or UUID string.

    Accepts an integer ID, a string that looks like a digit (e.g. "123"),
    or a UUID string. Returns the Slice model instance or None.
    """
    from superset.daos.chart import ChartDAO  # avoid circular import

    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        chart_id = int(identifier) if isinstance(identifier, str) else identifier
        return ChartDAO.find_by_id(chart_id)
    return ChartDAO.find_by_id(identifier, id_column="uuid")


def get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    # avoid circular import — commands depend on app initialization
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except (KeyError, ValueError, CommandException) as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


def extract_form_data_key_from_url(url: str | None) -> str | None:
    """Extract the form_data_key query parameter from an explore URL.

    Returns the form_data_key value or None if not found or URL is empty.
    """
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get("form_data_key", [])
    return values[0] if values else None
