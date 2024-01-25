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
"""Contains the logic to create cohesive forms on the explore view"""
import json
import os
from typing import Any, Optional

from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_babel import gettext as _
from wtforms import Field, ValidationError


class JsonListField(Field):
    widget = BS3TextFieldWidget()
    data: list[str] = []

    def _value(self) -> str:
        return json.dumps(self.data)

    def process_formdata(self, valuelist: list[str]) -> None:
        if valuelist and valuelist[0]:
            self.data = json.loads(valuelist[0])
        else:
            self.data = []


class CommaSeparatedListField(Field):
    widget = BS3TextFieldWidget()
    data: list[str] = []

    def _value(self) -> str:
        if self.data:
            return ", ".join(self.data)

        return ""

    def process_formdata(self, valuelist: list[str]) -> None:
        if valuelist:
            self.data = [x.strip() for x in valuelist[0].split(",")]
        else:
            self.data = []


class FileSizeLimit:  # pylint: disable=too-few-public-methods
    """Imposes an optional maximum filesize limit for uploaded files"""

    def __init__(self, max_size: Optional[int]):
        self.max_size = max_size

    def __call__(self, form: dict[str, Any], field: Any) -> None:
        if self.max_size is None:
            return

        field.data.flush()
        size = os.fstat(field.data.fileno()).st_size
        if size > self.max_size:
            raise ValidationError(
                _(
                    "File size must be less than or equal to %(max_size)s bytes",
                    max_size=self.max_size,
                )
            )


def filter_not_empty_values(values: Optional[list[Any]]) -> Optional[list[Any]]:
    """Returns a list of non empty values or None"""
    if not values:
        return None
    data = [value for value in values if value]
    if not data:
        return None
    return data
