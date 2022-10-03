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
import json
from typing import Any, Dict
from unittest.mock import Mock, patch

import pytest

import superset.config
from superset.constants import USER_AGENT
from superset.db_engine_specs.trino import TrinoEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestTrinoDbEngineSpec(TestDbEngineSpec):
    def test_get_extra_params(self):
        database = Mock()

        database.extra = json.dumps({})
        database.server_cert = None
        extra = TrinoEngineSpec.get_extra_params(database)
        expected = {"engine_params": {"connect_args": {"source": USER_AGENT}}}
        self.assertEqual(extra, expected)

        expected = {
            "first": 1,
            "engine_params": {
                "second": "two",
                "connect_args": {"source": "foobar", "third": "three"},
            },
        }
        database.extra = json.dumps(expected)
        database.server_cert = None
        extra = TrinoEngineSpec.get_extra_params(database)
        self.assertEqual(extra, expected)

    @patch("superset.utils.core.create_ssl_cert_file")
    def test_get_extra_params_with_server_cert(self, create_ssl_cert_file_func: Mock):
        database = Mock()

        database.extra = json.dumps({})
        database.server_cert = "TEST_CERT"
        create_ssl_cert_file_func.return_value = "/path/to/tls.crt"
        extra = TrinoEngineSpec.get_extra_params(database)

        connect_args = extra.get("engine_params", {}).get("connect_args", {})
        self.assertEqual(connect_args.get("http_scheme"), "https")
        self.assertEqual(connect_args.get("verify"), "/path/to/tls.crt")
        create_ssl_cert_file_func.assert_called_once_with(database.server_cert)

    @patch("trino.auth.BasicAuthentication")
    def test_auth_basic(self, auth: Mock):
        database = Mock()

        auth_params = {"username": "username", "password": "password"}
        database.encrypted_extra = json.dumps(
            {"auth_method": "basic", "auth_params": auth_params}
        )

        params: Dict[str, Any] = {}
        TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
        connect_args = params.setdefault("connect_args", {})
        self.assertEqual(connect_args.get("http_scheme"), "https")
        auth.assert_called_once_with(**auth_params)

    @patch("trino.auth.KerberosAuthentication")
    def test_auth_kerberos(self, auth: Mock):
        database = Mock()

        auth_params = {
            "service_name": "superset",
            "mutual_authentication": False,
            "delegate": True,
        }
        database.encrypted_extra = json.dumps(
            {"auth_method": "kerberos", "auth_params": auth_params}
        )

        params: Dict[str, Any] = {}
        TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
        connect_args = params.setdefault("connect_args", {})
        self.assertEqual(connect_args.get("http_scheme"), "https")
        auth.assert_called_once_with(**auth_params)

    @patch("trino.auth.CertificateAuthentication")
    def test_auth_certificate(self, auth: Mock):
        database = Mock()

        auth_params = {"cert": "/path/to/cert.pem", "key": "/path/to/key.pem"}
        database.encrypted_extra = json.dumps(
            {"auth_method": "certificate", "auth_params": auth_params}
        )

        params: Dict[str, Any] = {}
        TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
        connect_args = params.setdefault("connect_args", {})
        self.assertEqual(connect_args.get("http_scheme"), "https")
        auth.assert_called_once_with(**auth_params)

    @patch("trino.auth.JWTAuthentication")
    def test_auth_jwt(self, auth: Mock):
        database = Mock()

        auth_params = {"token": "jwt-token-string"}
        database.encrypted_extra = json.dumps(
            {"auth_method": "jwt", "auth_params": auth_params}
        )

        params: Dict[str, Any] = {}
        TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
        connect_args = params.setdefault("connect_args", {})
        self.assertEqual(connect_args.get("http_scheme"), "https")
        auth.assert_called_once_with(**auth_params)

    def test_auth_custom_auth(self):
        database = Mock()
        auth_class = Mock()

        auth_method = "custom_auth"
        auth_params = {"params1": "params1", "params2": "params2"}
        database.encrypted_extra = json.dumps(
            {"auth_method": auth_method, "auth_params": auth_params}
        )

        with patch.dict(
            "superset.config.ALLOWED_EXTRA_AUTHENTICATIONS",
            {"trino": {"custom_auth": auth_class}},
            clear=True,
        ):
            params: Dict[str, Any] = {}
            TrinoEngineSpec.update_params_from_encrypted_extra(database, params)

            connect_args = params.setdefault("connect_args", {})
            self.assertEqual(connect_args.get("http_scheme"), "https")

            auth_class.assert_called_once_with(**auth_params)

    def test_auth_custom_auth_denied(self):
        database = Mock()
        auth_method = "my.module:TrinoAuthClass"
        auth_params = {"params1": "params1", "params2": "params2"}
        database.encrypted_extra = json.dumps(
            {"auth_method": auth_method, "auth_params": auth_params}
        )

        superset.config.ALLOWED_EXTRA_AUTHENTICATIONS = {}

        with pytest.raises(ValueError) as excinfo:
            TrinoEngineSpec.update_params_from_encrypted_extra(database, {})

        assert str(excinfo.value) == (
            f"For security reason, custom authentication '{auth_method}' "
            f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
        )
