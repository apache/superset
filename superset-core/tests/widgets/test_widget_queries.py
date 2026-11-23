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
from superset_core.widgets import WidgetQueryRefusedError


def test_a_refusal_carries_its_code_message_and_status() -> None:
    refused = WidgetQueryRefusedError("CONTENT_CHANGED", "Reload to see it", 410)

    assert (refused.code, refused.message, refused.status) == (
        "CONTENT_CHANGED",
        "Reload to see it",
        410,
    )
    assert str(refused) == "Reload to see it"
    assert WidgetQueryRefusedError("CONTENT_CHANGED", "Reload").status == 409


@pytest.mark.parametrize("status", [200, 302, 401, 407, 500, 503])
def test_a_refusal_answers_a_client_error_other_than_sign_in(status: int) -> None:
    with pytest.raises(ValueError, match=str(status)):
        WidgetQueryRefusedError("CONTENT_CHANGED", "Reload", status)


def test_a_refusal_needs_a_code() -> None:
    with pytest.raises(ValueError, match="needs a code"):
        WidgetQueryRefusedError("", "Reload")
