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

"""The stub of render_page that the host replaces."""

from __future__ import annotations

import pytest
from superset_core.extensions.pages import render_page


def test_the_host_supplies_render_page() -> None:
    with pytest.raises(NotImplementedError, match="replaced during Superset startup"):
        render_page("extensions.acme.reports.report", {"reportId": "42"})
