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
import inspect
import json
import logging
from typing import List, Optional

from marshmallow import ValidationError
from sqlalchemy import MetaData

from superset import app
from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import (
    DatabaseCertificateValidationError,
    DatabaseEncryptedExtraValidationError,
    DatabaseExtraJSONValidationError,
    DatabaseExtraValidationError,
)
from superset.exceptions import CertificateException
from superset.utils.core import parse_ssl_cert

logger = logging.getLogger(__name__)


class BaseDatabaseCommand(BaseCommand):
    @staticmethod
    def _validate_encrypted_extra(
        exceptions: List[ValidationError], encrypted_extra: Optional[str]
    ) -> None:
        if encrypted_extra:
            try:
                json.loads(encrypted_extra)
            except json.JSONDecodeError as ex:
                exceptions.append(DatabaseEncryptedExtraValidationError(str(ex)))

    @staticmethod
    def _validate_extra(
        exceptions: List[ValidationError], extra: Optional[str]
    ) -> None:
        if extra:
            try:
                extra_ = json.loads(extra)
            except json.JSONDecodeError as ex:
                exceptions.append(DatabaseExtraJSONValidationError(str(ex)))
            else:
                metadata_signature = inspect.signature(MetaData)
                for key in extra_.get("metadata_params", {}):
                    if key not in metadata_signature.parameters:
                        exceptions.append(DatabaseExtraValidationError(key))

    @staticmethod
    def _validate_server_cert(
        exceptions: List[ValidationError], server_cert: Optional[str]
    ) -> None:
        if server_cert:
            try:
                parse_ssl_cert(server_cert)
            except CertificateException:
                exceptions.append(DatabaseCertificateValidationError())

    @staticmethod
    def _validate_sqlalchemy_uri(
        exceptions: List[ValidationError], sqlalchemy_uri: Optional[str]
    ) -> None:
        if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] and sqlalchemy_uri:
            if sqlalchemy_uri.startswith("sqlite"):
                exceptions.append(DatabaseSecurityValidationError())
