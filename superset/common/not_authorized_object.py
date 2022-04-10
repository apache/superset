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
from typing import Any, Optional

from superset.exceptions import SupersetException


class NotAuthorizedObject:
    def __init__(self, what_not_authorized: str):
        self._what_not_authorized = what_not_authorized

    def __getattr__(self, item: Any) -> None:
        raise NotAuthorizedException(self._what_not_authorized)

    def __getitem__(self, item: Any) -> None:
        raise NotAuthorizedException(self._what_not_authorized)


class NotAuthorizedException(SupersetException):
    def __init__(
        self, what_not_authorized: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__(
            "The user is not authorized to " + what_not_authorized, exception
        )
