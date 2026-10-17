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

import copy
import pickle

from superset.exceptions import (
    QueryObjectValidationError,
    QueryObjectValidationMessage,
)
from superset.utils import json


def test_validation_message_is_its_error_text() -> None:
    """Payload consumers see the same text a plain error string carried."""
    cause = QueryObjectValidationError("Semantic IN/NOT IN filters cannot be empty.")
    message = QueryObjectValidationMessage(cause)

    assert message == "Semantic IN/NOT IN filters cannot be empty."
    assert message.cause is cause
    assert json.dumps({"error": message}) == json.dumps(
        {"error": "Semantic IN/NOT IN filters cannot be empty."}
    )


def test_validation_message_copies_as_plain_text() -> None:
    """Copies and pickles carry the text without the exception."""
    message = QueryObjectValidationMessage(QueryObjectValidationError("bad grain"))

    for restored in (copy.copy(message), pickle.loads(pickle.dumps(message))):  # noqa: S301
        assert type(restored) is str
        assert restored == "bad grain"
