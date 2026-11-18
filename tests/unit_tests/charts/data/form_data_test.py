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

from typing import Any

from flask import current_app, g

from superset.charts.data.form_data import set_form_data


def test_set_form_data_exposes_payload_on_flask_global() -> None:
    """The shared helper publishes form data for request-independent queries."""
    payload: dict[str, Any] = {"queries": [{"filters": []}]}

    with current_app.test_request_context():
        set_form_data(payload)

        assert g.form_data is payload
