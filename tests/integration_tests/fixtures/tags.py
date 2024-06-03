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

import pytest

from superset.tags.core import clear_sqla_event_listeners, register_sqla_event_listeners
from tests.integration_tests.test_app import app


@pytest.fixture
@pytest.mark.usefixtures("app_context")
def with_tagging_system_feature():
    is_enabled = app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"]
    if not is_enabled:
        app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"] = True
        register_sqla_event_listeners()
        yield
        app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"] = False
        clear_sqla_event_listeners()
