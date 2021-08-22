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

class SecurityException(Exception):
    message: str

    def __init__(
        self, message: str = "Encounter general security issue",
    ) -> None:
        super().__init__(self.message)
        self.message = message


class AccessDeniedException(SecurityException):
    permission_name: str
    view_name: str

    def __init__(self, permission_name: str, view_name: str):
        exception_msg = "can't '{}' on '{}'".format(permission_name, view_name)
        super().__init__(exception_msg)
        self.permission_name = permission_name
        self.view_name = view_name
