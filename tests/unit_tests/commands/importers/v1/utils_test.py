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

from unittest.mock import patch

import pandas as pd
import pytest


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


class TestLoadYaml:
    def test_parser_error_raises_validation_error(self) -> None:
        """A malformed flow sequence raises yaml.parser.ParserError."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_yaml

        with pytest.raises(ValidationError):
            load_yaml("test.yaml", "key: [unclosed")

    def test_scanner_error_raises_validation_error(self) -> None:
        """An unterminated quoted scalar raises yaml.scanner.ScannerError,
        a sibling of ParserError under yaml.error.YAMLError."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_yaml

        with pytest.raises(ValidationError):
            load_yaml("test.yaml", 'key: "unterminated string')


class TestLoadConfigs:
    """
    load_configs() merges caller-supplied ``encrypted_extra_secrets`` into the
    ``masked_encrypted_extra`` field of each config, which comes straight from
    the imported YAML (before schema validation). A malformed value there used
    to raise a raw simplejson.JSONDecodeError that escaped uncaught (opaque
    500); it must instead be collected as a ValidationError like every other
    per-file failure.
    """

    @staticmethod
    def _trivial_schema():  # type: ignore[no-untyped-def]
        from marshmallow import EXCLUDE, Schema

        class TrivialSchema(Schema):
            class Meta:
                unknown = EXCLUDE

        return TrivialSchema()

    @patch("superset.commands.importers.v1.utils.db")
    def test_invalid_json_in_masked_encrypted_extra_is_collected(
        self, mock_db: object
    ) -> None:
        """A non-JSON ``masked_encrypted_extra`` is converted into a
        ValidationError appended to ``exceptions`` rather than raising."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs

        # No existing databases / ssh tunnels in the (mocked) metadata DB.
        mock_db.session.query.return_value.all.return_value = []  # type: ignore[attr-defined]

        file_name = "databases/db.yaml"
        contents = {
            file_name: (
                "uuid: abc-123\n"
                "password: secret\n"
                "masked_encrypted_extra: not valid json\n"
            )
        }
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents=contents,
            schemas={"databases/": self._trivial_schema()},
            passwords={},
            exceptions=exceptions,
            ssh_tunnel_passwords={},
            ssh_tunnel_private_keys={},
            ssh_tunnel_priv_key_passwords={},
            encrypted_extra_secrets={file_name: {"$.foo": "actual_secret"}},
        )

        # The bad file is not added to configs, and a structured error is
        # collected instead of a raw JSONDecodeError propagating out.
        assert file_name not in configs
        assert len(exceptions) == 1
        assert isinstance(exceptions[0], ValidationError)
        assert file_name in exceptions[0].messages
        assert "masked_encrypted_extra" in exceptions[0].messages[file_name]

    @patch("superset.commands.importers.v1.utils.db")
    def test_valid_json_in_masked_encrypted_extra_still_merges(
        self, mock_db: object
    ) -> None:
        """Control: valid JSON in ``masked_encrypted_extra`` still has the
        secrets merged in and produces no exceptions."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs
        from superset.utils import json

        mock_db.session.query.return_value.all.return_value = []  # type: ignore[attr-defined]

        file_name = "databases/db.yaml"
        contents = {
            file_name: (
                "uuid: abc-123\n"
                "password: secret\n"
                'masked_encrypted_extra: \'{"foo": "XXXXXXXXXX"}\'\n'
            )
        }
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents=contents,
            schemas={"databases/": self._trivial_schema()},
            passwords={},
            exceptions=exceptions,
            ssh_tunnel_passwords={},
            ssh_tunnel_private_keys={},
            ssh_tunnel_priv_key_passwords={},
            encrypted_extra_secrets={file_name: {"$.foo": "actual_secret"}},
        )

        assert exceptions == []
        assert file_name in configs
        merged = json.loads(configs[file_name]["masked_encrypted_extra"])
        assert merged == {"foo": "actual_secret"}
