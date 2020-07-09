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
from typing import Any, Dict, Optional

from flask_babel import gettext as _

from superset.errors import SupersetError


class SupersetException(Exception):
    status = 500
    message = ""

    def __init__(self, message: str = "", exception: Optional[Exception] = None):
        if message:
            self.message = message
        self._exception = exception
        super().__init__(self.message)

    @property
    def exception(self) -> Optional[Exception]:
        return self._exception


class SupersetTimeoutException(SupersetException):
    pass


class SupersetSecurityException(SupersetException):
    status = 401

    def __init__(
        self, error: SupersetError, payload: Optional[Dict[str, Any]] = None
    ) -> None:
        super(SupersetSecurityException, self).__init__(error.message)
        self.error = error
        self.payload = payload


class NoDataException(SupersetException):
    status = 400


class NullValueException(SupersetException):
    status = 400


class SupersetTemplateException(SupersetException):
    pass


class SpatialException(SupersetException):
    pass


class CertificateException(SupersetException):
    message = _("Invalid certificate")


class DatabaseNotFound(SupersetException):
    status = 400


class QueryObjectValidationError(SupersetException):
    status = 400


class DashboardImportException(SupersetException):
    pass
