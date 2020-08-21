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
from typing import Any, List, Optional

from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from wtforms import Field


class JsonListField(Field):
    widget = BS3TextFieldWidget()
    data: List[str] = []

    def _value(self) -> str:
        return json.dumps(self.data)

    def process_formdata(self, valuelist: List[str]) -> None:
        if valuelist and valuelist[0]:
            self.data = json.loads(valuelist[0])
        else:
            self.data = []


class CommaSeparatedListField(Field):
    widget = BS3TextFieldWidget()
    data: List[str] = []

    def _value(self) -> str:
        if self.data:
            return ", ".join(self.data)

        return ""

    def process_formdata(self, valuelist: List[str]) -> None:
        if valuelist:
            self.data = [x.strip() for x in valuelist[0].split(",")]
        else:
            self.data = []


def filter_not_empty_values(values: Optional[List[Any]]) -> Optional[List[Any]]:
    """Returns a list of non empty values or None"""
    if not values:
        return None
    data = [value for value in values if value]
    if not data:
        return None
    return data
