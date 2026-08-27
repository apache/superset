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

import gzip
import io
from unittest.mock import patch

import pandas as pd
import pytest
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session


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


class TestReadBounded:
    """``_read_bounded`` caps the bytes materialized from a dataset import
    data URI, including after gzip decompression, so a small compressed
    payload can't expand to an unbounded in-memory allocation."""

    def test_rejects_oversized_gzip_stream(self) -> None:
        """A small compressed payload that decompresses past the cap must fail."""
        from superset.commands.dataset.importers.v1.utils import _read_bounded
        from superset.commands.exceptions import ImportFailedError

        payload = gzip.compress(b"a" * 100_000)
        stream = gzip.GzipFile(fileobj=io.BytesIO(payload))
        with pytest.raises(ImportFailedError):
            _read_bounded(stream, max_bytes=10_000)

    def test_passes_small_payload_through(self) -> None:
        from superset.commands.dataset.importers.v1.utils import _read_bounded

        buffer = _read_bounded(io.BytesIO(b"a,b\n1,2\n"), max_bytes=10_000)
        assert buffer.read() == b"a,b\n1,2\n"


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


class TestLoadConfigsNonMappingYaml:
    """A syntactically valid YAML document whose top-level value is a
    scalar or list (not a mapping) must be reported as a schema validation
    error, not raise an unhandled AttributeError from the ``config.get()``
    calls that assume a mapping."""

    def test_top_level_list_is_reported_as_validation_error(
        self, session: Session
    ) -> None:
        from superset.commands.importers.v1.utils import load_configs
        from superset.databases.schemas import ImportV1DatabaseSchema
        from superset.models.core import Database

        engine = session.get_bind()
        Database.metadata.create_all(engine)  # pylint: disable=no-member

        contents = {"databases/malformed.yaml": "- not\n- a\n- mapping\n"}
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents,
            {"databases/": ImportV1DatabaseSchema()},
            {},
            exceptions,
            {},
            {},
            {},
            {},
        )

        assert configs == {}
        assert len(exceptions) == 1
        assert "databases/malformed.yaml" in exceptions[0].messages

    def test_top_level_scalar_is_reported_as_validation_error(
        self, session: Session
    ) -> None:
        from superset.commands.importers.v1.utils import load_configs
        from superset.databases.schemas import ImportV1DatabaseSchema
        from superset.models.core import Database

        engine = session.get_bind()
        Database.metadata.create_all(engine)  # pylint: disable=no-member

        contents = {"databases/malformed.yaml": "just a string"}
        exceptions: list[ValidationError] = []

        configs = load_configs(
            contents,
            {"databases/": ImportV1DatabaseSchema()},
            {},
            exceptions,
            {},
            {},
            {},
            {},
        )

        assert configs == {}
        assert len(exceptions) == 1
        assert "databases/malformed.yaml" in exceptions[0].messages


class TestDatabaseConnectionIdentityUnchanged:
    """Stored database secrets (password, SSH tunnel key) may only be
    re-attached to an import when the incoming config still points at the
    same connection endpoint as the stored one — a UUID match alone is not
    enough, since UUIDs are not secrets (they appear in every exported
    bundle)."""

    def test_same_endpoint_differing_masked_credential_is_unchanged(self) -> None:
        from superset.commands.importers.v1.utils import (
            database_connection_identity_unchanged,
        )

        assert database_connection_identity_unchanged(
            "postgresql://user:XXXXXXXXXX@host1:5432/db",
            "postgresql://user:pass@host1:5432/db",
        )

    def test_host_change_is_changed(self) -> None:
        from superset.commands.importers.v1.utils import (
            database_connection_identity_unchanged,
        )

        assert not database_connection_identity_unchanged(
            "postgresql://user:XXXXXXXXXX@host1:5432/db",
            "postgresql://user:XXXXXXXXXX@attacker.example.com:5432/db",
        )

    def test_port_change_is_changed(self) -> None:
        from superset.commands.importers.v1.utils import (
            database_connection_identity_unchanged,
        )

        assert not database_connection_identity_unchanged(
            "postgresql://user:XXXXXXXXXX@host1:5432/db",
            "postgresql://user:XXXXXXXXXX@host1:5433/db",
        )

    def test_query_args_can_redirect_the_connection(self) -> None:
        """Query args become driver connect args (e.g. psycopg2 ``?host=``)
        and can redirect the connection just like the host segment."""
        from superset.commands.importers.v1.utils import (
            database_connection_identity_unchanged,
        )

        assert not database_connection_identity_unchanged(
            "postgresql://user:XXXXXXXXXX@host1:5432/db",
            "postgresql://user:XXXXXXXXXX@host1:5432/db?host=attacker.example.com",
        )

    def test_missing_either_side_is_never_reusable(self) -> None:
        from superset.commands.importers.v1.utils import (
            database_connection_identity_unchanged,
        )

        assert not database_connection_identity_unchanged(
            None, "postgresql://user:pass@host1:5432/db"
        )
        assert not database_connection_identity_unchanged(
            "postgresql://user:XXXXXXXXXX@host1:5432/db", None
        )
