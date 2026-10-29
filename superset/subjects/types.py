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
from enum import IntEnum
from typing import Literal, TypedDict


class SubjectType(IntEnum):
    USER = 1
    ROLE = 2
    GROUP = 3


class ActionType(IntEnum):
    EDIT = 1
    VIEW = 2


class PrincipalReference(TypedDict):
    """An explicitly named ID namespace, never inferred from its integer value."""

    type: Literal["user", "role", "group", "subject"]
    id: int


SubjectReference = int | PrincipalReference
