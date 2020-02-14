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


class CommandException(Exception):
    """ Common base class for Command exceptions. """

    message = ""

    def __init__(self, message=""):
        if message:
            self.message = message
        super().__init__(self.message)


class UpdateFailedError(CommandException):
    message = "Command update failed"


class CreateFailedError(CommandException):
    message = "Command create failed"


class DeleteFailedError(CommandException):
    message = "Command delete failed"


class ForbiddenError(CommandException):
    message = "Actions is forbidden"
