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

from superset.commands.database.exceptions import (
    DatabaseExtraJSONValidationError,
    DatabaseExtraValidationError,
)


def test_database_extra_validation_error_interpolates_key() -> None:
    """
    The message is built with a lazy string, so a malformed placeholder only
    blows up when the error is rendered (e.g. serialized into an API response).
    Force that rendering here.
    """
    error = DatabaseExtraValidationError("metadata_params")
    message = str(error.messages[0])

    assert "metadata_params" in message
    assert "%" not in message


def test_database_extra_json_validation_error_interpolates_json_error() -> None:
    error = DatabaseExtraJSONValidationError("Expecting value: line 1 column 1")
    message = str(error.messages[0])

    assert "Expecting value: line 1 column 1" in message
    assert "%" not in message
