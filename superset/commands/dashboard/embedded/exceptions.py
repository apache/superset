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


class EmbeddedDashboardNotFoundError(ObjectNotFoundError):
    def __init__(
        self,
        embedded_dashboard_uuid: Optional[str] = None,
        exception: Optional[Exception] = None,
    ) -> None:
        super().__init__("EmbeddedDashboard", embedded_dashboard_uuid, exception)


class EmbeddedDashboardAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this embedded dashboard config.")
