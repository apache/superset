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
    def _database_schemas(self) -> dict[str, object]:
        from marshmallow import fields, Schema

        class DatabaseSchema(Schema):
            uuid = fields.UUID(required=True)
            database_name = fields.String(required=True)
            sqlalchemy_uri = fields.String(required=True)
            password = fields.String(required=False, allow_none=True)

        return {"databases/": DatabaseSchema()}

    @patch("superset.commands.importers.v1.utils.db")
    def test_missing_uuid_appends_validation_error(self, mock_db: object) -> None:
        """A databases config missing `uuid` must not raise a raw KeyError;
        it should be excluded from the returned configs and a ValidationError
        appended to the exceptions list instead."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs

        mock_db.session.query.return_value.all.return_value = []

        # No `uuid` and no `password`, so the code reaches
        # `config["uuid"] in db_passwords` and would raise KeyError pre-fix.
        contents = {
            "databases/bad.yaml": (
                "database_name: bad\nsqlalchemy_uri: postgres://localhost\n"
            ),
        }
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents,
            self._database_schemas(),
            {},
            exceptions,
            {},
            {},
            {},
            {},
        )

        assert "databases/bad.yaml" not in configs
        assert len(exceptions) == 1
        assert isinstance(exceptions[0], ValidationError)
        assert "databases/bad.yaml" in exceptions[0].messages

    @patch("superset.commands.importers.v1.utils.db")
    def test_uuid_present_loads_successfully(self, mock_db: object) -> None:
        """Control: a well-formed databases config loads with no exceptions."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs

        mock_db.session.query.return_value.all.return_value = []

        contents = {
            "databases/good.yaml": (
                "uuid: 6ff1d5b3-4b0f-4c6a-9d2f-9c8b7a6e5d4c\n"
                "database_name: good\n"
                "sqlalchemy_uri: postgres://localhost\n"
                "password: secret\n"
            ),
        }
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents,
            self._database_schemas(),
            {},
            exceptions,
            {},
            {},
            {},
            {},
        )

        assert "databases/good.yaml" in configs
        assert exceptions == []
