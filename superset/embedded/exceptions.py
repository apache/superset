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
from typing import Optional

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import ForbiddenError, ObjectNotFoundError


# make this class abstract
class EmbeddedObjectNotFoundError(ObjectNotFoundError):
    def __init__(
        self,
        embedded_object_type: Optional[str] = None,
        embedded_object_uuid: Optional[str] = None,
        exception: Optional[Exception] = None,
    ) -> None:
        super().__init__(embedded_object_type, embedded_object_uuid, exception)


class EmbeddedDashboardNotFoundError(EmbeddedObjectNotFoundError):
    def __init__(
        self,
        embedded_object_uuid: Optional[str] = None,
        exception: Optional[Exception] = None,
    ) -> None:
        super().__init__("EmbeddedDashboard", embedded_object_uuid, exception)


class EmbeddedChartNotFoundError(EmbeddedObjectNotFoundError):
    def __init__(
        self,
        embedded_object_uuid: Optional[str] = None,
        exception: Optional[Exception] = None,
    ) -> None:
        super().__init__("EmbeddedChart", embedded_object_uuid, exception)


class EmbeddedObjectAccessDeniedError(ForbiddenError):
    pass


class EmbeddedDashboardAccessDeniedError(EmbeddedObjectAccessDeniedError):
    message = _("You don't have access to this embedded dashboard config.")


class EmbeddedChartAccessDeniedError(EmbeddedObjectAccessDeniedError):
    message = _("You don't have access to this embedded chart config.")
