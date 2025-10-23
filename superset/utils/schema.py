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
from typing import Any, Union

from marshmallow import validate, ValidationError

from superset.utils import json


class OneOfCaseInsensitive(validate.OneOf):
    """
    Marshmallow validator that's based on the built-in `OneOf`, but performs
    validation case insensitively.
    """

    def __call__(self, value: Any) -> str:
        try:
            if (value.lower() if isinstance(value, str) else value) not in [
                choice.lower() if isinstance(choice, str) else choice
                for choice in self.choices
            ]:
                raise ValidationError(self._format_error(value))
        except TypeError as error:
            raise ValidationError(self._format_error(value)) from error

        return value


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    """
    JSON Validator that can be passed to a Marshmallow `Field`'s validate argument.

    :raises ValidationError: if value is not serializable to JSON
    :param value: an object that should be parseable to JSON
    """
    try:
        json.validate_json(value)
    except json.JSONDecodeError as ex:
        raise ValidationError("JSON not valid") from ex


def validate_query_context_metadata(value: bytes | bytearray | str | None) -> None:
    """
    Validator for query_context field to ensure it contains required metadata.

    Validates that the query_context JSON contains the required 'datasource' and
    'queries' fields needed for chart data retrieval.

    :raises ValidationError: if value is not valid JSON or missing required fields
    :param value: a JSON string that should contain datasource and queries metadata
    """
    if value is None or not value:
        return  # Allow None values and empty strings

    try:
        parsed_data = json.loads(value)
    except json.JSONDecodeError as ex:
        raise ValidationError("JSON not valid") from ex

    # Validate required fields exist in the query_context
    if not isinstance(parsed_data, dict):
        raise ValidationError("Query context must be a valid JSON object")

    missing_fields = []

    # When query_context is provided (not None), validate it has required fields
    if "datasource" not in parsed_data:
        missing_fields.append("datasource")

    if "queries" not in parsed_data:
        missing_fields.append("queries")

    if missing_fields:
        error_msg = (
            f"Query context is missing required fields: {', '.join(missing_fields)}"
        )
        raise ValidationError(
            error_msg,
        )
