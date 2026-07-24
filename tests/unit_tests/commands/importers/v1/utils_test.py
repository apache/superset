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
"""Tests for superset/commands/dataset/importers/v1/utils.py temporal helpers."""

import logging
from unittest.mock import patch

import pandas as pd
import pytest
from jsonpath_ng import parse
from marshmallow import Schema
from marshmallow.exceptions import ValidationError

from superset.constants import PASSWORD_MASK
from superset.utils import json


class TestConvertTemporalColumns:
    def test_normal_dates_converted(self) -> None:
        """Valid in-range dates are converted to datetime64 normally."""
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": ["2023-01-01", "2024-06-15"]})
        _convert_temporal_columns(df, {"ts": DateTime()})
        assert pd.api.types.is_datetime64_any_dtype(df["ts"])

    def test_out_of_bounds_coerced_to_nat(self) -> None:
        """
        Dates beyond ~2262-04-11 overflow pandas' int64 nanosecond limit.
        load_data() must coerce them to NaT and warn, not raise.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": ["3118-01-01"]})
        with patch(
            "superset.commands.dataset.importers.v1.utils.logger"
        ) as mock_logger:
            _convert_temporal_columns(df, {"ts": DateTime()})

        assert pd.isna(df["ts"].iloc[0])
        mock_logger.warning.assert_called_once()
        warning_msg = mock_logger.warning.call_args[0][0]
        assert "out-of-bounds" in warning_msg

    def test_malformed_dates_still_raise(self) -> None:
        """
        Completely malformed date strings are NOT silently coerced — only
        out-of-bounds timestamps are. This preserves the original import-fail
        behavior for bad data.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": ["not-a-date"]})
        with pytest.raises((ValueError, pd.errors.ParserError)):
            _convert_temporal_columns(df, {"ts": DateTime()})

    @pytest.mark.parametrize(
        "values",
        [
            ["3118-01-01", "not-a-date"],
            ["not-a-date", "3118-01-01"],
        ],
    )
    def test_mixed_out_of_bounds_and_malformed_still_raises(
        self, values: list[str]
    ) -> None:
        """
        A column mixing out-of-bounds and malformed dates must raise, not silently
        coerce the malformed value to NaT. Both orderings are tested to ensure the
        invariant holds regardless of which error pandas encounters first.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": values})
        with pytest.raises((ValueError, pd.errors.ParserError)):
            _convert_temporal_columns(df, {"ts": DateTime()})

    def test_warning_count_excludes_preexisting_nulls(self) -> None:
        """
        The warning count reflects only net-new NaTs from coercion,
        not nulls that were already present in the source data.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": [None, "3118-01-01", "3119-06-01"]})
        with patch(
            "superset.commands.dataset.importers.v1.utils.logger"
        ) as mock_logger:
            _convert_temporal_columns(df, {"ts": DateTime()})

        call_args = mock_logger.warning.call_args[0]
        assert call_args[1] == 2  # 2 out-of-bounds, 1 pre-existing null


class TestLoadConfigs:
    def test_load_configs_caught_exception_and_log_redacted_configs(self) -> None:
        logging.basicConfig(level=logging.DEBUG)
        from superset.commands.importers.v1.utils import (
            load_configs,
        )

        with (
            patch("superset.db") as mock_db,
            patch("yaml.safe_load") as mock_yaml_safe_load,
            patch("superset.commands.importers.v1.utils.logger") as mock_logger,
        ):
            mock_yaml_safe_load.return_value = {
                "masked_encrypted_extra": json.dumps(
                    {"oauth2_client_info": {"secret": "MASKED"}}
                ),
                "ssh_tunnel": {},
            }
            mock_db.session.query.return_value = {"uuid-1": "SECRET_TO_BE_SEEN"}

            class RaiseValidationSchema(Schema):
                def load(self, value):
                    raise ValidationError("Exception when validating config")

            failed_schema = RaiseValidationSchema()

            load_configs(
                contents={"file1/": "here is some content"},
                schemas={
                    "file1/": failed_schema,
                },
                passwords={"file1/": "PASSWORD"},
                exceptions=[],
                ssh_tunnel_passwords={"file1/": "SECRET_SSH_TUNNEL_PASSWORD"},
                ssh_tunnel_private_keys={"file1/": "SECRET_SSH_TUNNEL_PRIVATE_KEY"},
                ssh_tunnel_priv_key_passwords={
                    "file1/": "SECRET_SSH_TUNNEL_PRIV_KEY_PASSWORD"
                },
                encrypted_extra_secrets={
                    "file1/": {
                        "$.oauth2_client_info.secret": "SECRET_OAUTH2_CLIENT_INFO"
                    }
                },
            )

            logged_config = mock_logger.debug.call_args[0][1]

            for redacted_field in [
                "$.password",
                "$.ssh_tunnel.password",
                "$.ssh_tunnel.private_key",
                "$.ssh_tunnel.private_key_password",
                "$.masked_encrypted_extra",
            ]:
                jsonpath_expr = parse(redacted_field)
                for match in jsonpath_expr.find(logged_config):
                    assert match.value == PASSWORD_MASK
