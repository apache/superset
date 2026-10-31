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
import logging
import lzma
import struct
import zipfile
import zlib
from typing import Any, Callable
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from marshmallow.exceptions import ValidationError
from pandas.errors import OutOfBoundsDatetime
from sqlalchemy.orm import Session


class TestConvertTemporalColumns:
    @pytest.mark.parametrize("out_of_bounds", [False, True])
    def test_mixed_offsets_preserved(self, out_of_bounds: bool) -> None:
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        values = ["2024-10-27T02:30:00+02:00", "2024-10-27T02:30:00+01:00"]
        if out_of_bounds:
            values.append("3118-01-01T00:00:00+01:00")
        frame = pd.DataFrame({"ts": values}, index=range(10, 10 + len(values)))
        _convert_temporal_columns(frame, {"ts": DateTime()})

        assert frame["ts"].iloc[0] == pd.Timestamp(values[0])
        assert frame["ts"].iloc[1] == pd.Timestamp(values[1])
        assert frame["ts"].iloc[0].utcoffset() != frame["ts"].iloc[1].utcoffset()
        assert list(frame.index) == list(range(10, 10 + len(values)))
        if out_of_bounds:
            assert frame["ts"].iloc[2] == pd.Timestamp(values[2])

    def test_normal_dates_converted(self) -> None:
        """Valid in-range dates are converted to datetime64 normally."""
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": ["2023-01-01", "2024-06-15"]})
        _convert_temporal_columns(df, {"ts": DateTime()})
        assert pd.api.types.is_datetime64_any_dtype(df["ts"])

    def test_far_future_date_strings_convert_successfully(self) -> None:
        """
        Dates beyond ~2262-04-11 overflow pandas' int64 *nanosecond* limit, but
        pandas 3's wider non-nanosecond datetime64 dtypes (e.g. ``datetime64[us]``)
        represent a string date like this correctly instead of needing the
        OutOfBoundsDatetime/NaT fallback below.
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

        assert df["ts"].iloc[0] == pd.Timestamp("3118-01-01")
        mock_logger.warning.assert_not_called()

    def test_out_of_bounds_numeric_epoch_coerced_to_nat(self) -> None:
        """
        A numeric (epoch) value is always interpreted in nanosecond units, so --
        unlike a far-future date *string* -- it can still overflow regardless of
        pandas 3's wider datetime64 resolutions. load_data() must coerce such a
        value to NaT and warn, not raise.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        df = pd.DataFrame({"ts": [10**30]})
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

        Nothing a real driver hands back can still trigger pandas 3's
        OutOfBoundsDatetime for both the whole-column *and* the row-level
        fallback conversion (pandas 3's wider datetime64 resolutions parse a
        far-future date string directly; see
        ``test_far_future_date_strings_convert_successfully``), so
        ``to_datetime`` is faked here to force both code paths and isolate
        this test from that pandas-version-specific date-range behavior.
        """
        from sqlalchemy import DateTime

        from superset.commands.dataset.importers.v1.utils import (
            _convert_temporal_columns,
        )

        real_to_datetime = pd.to_datetime
        oob_markers = {"oob1", "oob2"}

        def fake_to_datetime(value: Any) -> Any:
            if isinstance(value, pd.Series) or value in oob_markers:
                raise OutOfBoundsDatetime("forced for test")
            return real_to_datetime(value)

        df = pd.DataFrame({"ts": [None, "oob1", "oob2"]})
        with (
            patch("superset.commands.dataset.importers.v1.utils.logger") as mock_logger,
            patch(
                "superset.commands.dataset.importers.v1.utils.pd.to_datetime",
                side_effect=fake_to_datetime,
            ),
        ):
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


def _assert_logged_as_warning(caplog: pytest.LogCaptureFixture, fragment: str) -> None:
    """Expected, user-input validation failures are already surfaced to the
    client as a 422; they must be logged at WARNING, never ERROR, so they do
    not show up as error events in log-based alerting."""
    matching = [r for r in caplog.records if fragment in r.getMessage()]
    assert matching, f"no log record containing {fragment!r}"
    assert all(r.levelno == logging.WARNING for r in matching)
    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]


class TestLoadConfigs:
    """
    Per-file failures inside load_configs() must be collected as
    ValidationErrors rather than propagating as raw exceptions (opaque 500s):

    - A malformed ``masked_encrypted_extra`` (into which caller-supplied
      ``encrypted_extra_secrets`` are merged before schema validation) used to
      raise a raw simplejson.JSONDecodeError.
    - A config missing its ``uuid`` used to raise a raw KeyError when the
      password/ssh-tunnel validation looked up ``config["uuid"]``.
    """

    @staticmethod
    def _trivial_schema():
        from marshmallow import EXCLUDE, Schema

        class TrivialSchema(Schema):
            class Meta:
                unknown = EXCLUDE

        return TrivialSchema()

    def _database_schemas(self) -> dict[str, object]:
        from marshmallow import fields, Schema

        class DatabaseSchema(Schema):
            uuid = fields.UUID(required=True)
            database_name = fields.String(required=True)
            sqlalchemy_uri = fields.String(required=True)
            password = fields.String(required=False, allow_none=True)

        return {"databases/": DatabaseSchema()}

    @patch("superset.commands.importers.v1.utils.db")
    def test_invalid_json_in_masked_encrypted_extra_is_collected(
        self, mock_db: object, caplog: pytest.LogCaptureFixture
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

        caplog.set_level(logging.WARNING)
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
        _assert_logged_as_warning(caplog, "Invalid JSON in masked_encrypted_extra")

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

    @patch("superset.commands.importers.v1.utils.db")
    def test_missing_uuid_appends_validation_error(self, mock_db: MagicMock) -> None:
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
    def test_missing_key_read_before_validation_logged_as_warning(
        self, mock_db: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """An SSH tunnel password supplied for a config that has no
        ``ssh_tunnel`` section hits a raw KeyError before schema validation;
        it is collected as a ValidationError and logged at WARNING."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs

        mock_db.session.query.return_value.all.return_value = []

        file_name = "databases/no_tunnel.yaml"
        contents = {
            file_name: (
                "uuid: 6ff1d5b3-4b0f-4c6a-9d2f-9c8b7a6e5d4c\n"
                "database_name: no_tunnel\n"
                "sqlalchemy_uri: postgres://localhost\n"
                "password: secret\n"
            ),
        }
        exceptions: list[ValidationError] = []

        caplog.set_level(logging.WARNING)
        configs = load_configs(
            contents,
            self._database_schemas(),
            {},
            exceptions,
            {file_name: "tunnel_secret"},
            {},
            {},
            {},
        )

        assert file_name not in configs
        assert len(exceptions) == 1
        assert exceptions[0].messages == {
            file_name: {"ssh_tunnel": ["Missing data for required field."]}
        }
        _assert_logged_as_warning(caplog, "Missing required key")

    @patch("superset.commands.importers.v1.utils.db")
    def test_schema_validation_failure_logged_as_warning(
        self, mock_db: MagicMock, caplog: pytest.LogCaptureFixture
    ) -> None:
        """A config failing marshmallow schema validation (e.g. a missing
        required field) is collected and logged at WARNING, not ERROR."""
        from marshmallow.exceptions import ValidationError

        from superset.commands.importers.v1.utils import load_configs

        mock_db.session.query.return_value.all.return_value = []

        contents = {
            "databases/incomplete.yaml": (
                "uuid: 6ff1d5b3-4b0f-4c6a-9d2f-9c8b7a6e5d4c\n"
                "database_name: incomplete\n"
                "password: secret\n"
            ),
        }
        exceptions: list[ValidationError] = []

        caplog.set_level(logging.WARNING)
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

        assert "databases/incomplete.yaml" not in configs
        assert len(exceptions) == 1
        assert exceptions[0].messages == {
            "databases/incomplete.yaml": {
                "sqlalchemy_uri": ["Missing data for required field."]
            }
        }
        _assert_logged_as_warning(caplog, "Schema validation failed")

    @patch("superset.commands.importers.v1.utils.db")
    def test_uuid_present_loads_successfully(self, mock_db: MagicMock) -> None:
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

    def test_unparseable_yaml_is_reported_as_validation_error(
        self, session: Session
    ) -> None:
        """YAML that ``load_yaml`` cannot parse raises a ValidationError
        *before* ``config`` is assigned. The ``except ValidationError``
        handler's ``isinstance(config, dict)`` diagnostic must not then crash
        with an UnboundLocalError (regression for SUPERSET-PYTHON-176W)."""
        from superset.commands.importers.v1.utils import load_configs
        from superset.databases.schemas import ImportV1DatabaseSchema
        from superset.models.core import Database

        engine = session.get_bind()
        Database.metadata.create_all(engine)  # pylint: disable=no-member

        # An unterminated quoted scalar raises yaml.scanner.ScannerError,
        # mirroring the malformed chart YAML seen in the Sentry report.
        contents = {"databases/malformed.yaml": 'key: "unterminated string'}
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


def _make_bundle() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as bundle:
        bundle.writestr("bundle/metadata.yaml", "version: 1.0.0\n")
    return buf.getvalue()


def test_open_import_bundle_valid_zip() -> None:
    """A valid ZIP is opened and its contents are readable."""
    from superset.commands.importers.v1.utils import (
        get_contents_from_bundle,
        open_import_bundle,
    )

    with open_import_bundle(io.BytesIO(_make_bundle())) as bundle:
        contents = get_contents_from_bundle(bundle)

    assert contents == {"metadata.yaml": "version: 1.0.0\n"}


def test_open_import_bundle_corrupt_central_directory() -> None:
    """
    A ZIP with a corrupt central directory must raise ``IncorrectFormatError``
    instead of ``BadZipFile`` when opened.
    """
    from superset.commands.importers.exceptions import IncorrectFormatError
    from superset.commands.importers.v1.utils import open_import_bundle

    corrupt = io.BytesIO(_make_bundle().replace(b"PK\x01\x02", b"XXXX"))

    with pytest.raises(IncorrectFormatError) as excinfo:
        with open_import_bundle(corrupt):
            pass

    assert excinfo.value.message == "Invalid or corrupted ZIP file"
    assert isinstance(excinfo.value.__cause__, zipfile.BadZipFile)


def test_open_import_bundle_bad_member() -> None:
    """``BadZipFile`` raised while reading members is also converted."""
    from superset.commands.importers.exceptions import IncorrectFormatError
    from superset.commands.importers.v1.utils import open_import_bundle

    with pytest.raises(IncorrectFormatError):
        with open_import_bundle(io.BytesIO(_make_bundle())):
            raise zipfile.BadZipFile("Bad CRC-32 for file 'bundle/metadata.yaml'")


def _make_compressed_bundle(compression: int = zipfile.ZIP_DEFLATED) -> bytearray:
    """Build a single-member bundle large enough to be compressed."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=compression) as bundle:
        bundle.writestr("bundle/metadata.yaml", "version: 1.0.0\n" * 20)
    return bytearray(buf.getvalue())


def _member_data_offset(data: bytearray) -> int:
    """Return the offset of the first member's data, after its local header."""
    name_length, extra_length = struct.unpack("<HH", data[26:30])
    return 30 + name_length + extra_length


def _corrupt_deflate() -> bytes:
    data = _make_compressed_bundle(zipfile.ZIP_DEFLATED)
    # 0xFF starts a deflate block with the reserved (invalid) block type
    data[_member_data_offset(data)] = 0xFF
    return bytes(data)


def _unsupported_compression() -> bytes:
    data = _make_compressed_bundle(zipfile.ZIP_DEFLATED)
    central_directory = data.find(b"PK\x01\x02")
    # 99 (AES) is a compression method ``zipfile`` does not implement
    data[8:10] = struct.pack("<H", 99)
    data[central_directory + 10 : central_directory + 12] = struct.pack("<H", 99)
    return bytes(data)


def _encrypted_member() -> bytes:
    data = _make_compressed_bundle(zipfile.ZIP_DEFLATED)
    central_directory = data.find(b"PK\x01\x02")
    # bit 0 of the general purpose flags marks the member as encrypted
    data[6] |= 0x01
    data[central_directory + 8] |= 0x01
    return bytes(data)


def _corrupt_bzip2() -> bytes:
    data = _make_compressed_bundle(zipfile.ZIP_BZIP2)
    data[_member_data_offset(data) + 4] ^= 0xFF
    return bytes(data)


def _corrupt_lzma() -> bytes:
    data = _make_compressed_bundle(zipfile.ZIP_LZMA)
    offset = _member_data_offset(data)
    data[offset + 4 : offset + 12] = b"\xff" * 8
    return bytes(data)


@pytest.mark.parametrize(
    "make_bundle, cause",
    [
        (_corrupt_deflate, zlib.error),
        (_unsupported_compression, NotImplementedError),
        (_encrypted_member, RuntimeError),
        (_corrupt_bzip2, OSError),
        (_corrupt_lzma, lzma.LZMAError),
    ],
    ids=["corrupt-deflate", "unsupported-compression", "encrypted", "bzip2", "lzma"],
)
def test_open_import_bundle_corrupt_member(
    make_bundle: Callable[[], bytes],
    cause: type[Exception],
) -> None:
    """
    A ZIP whose central directory is intact but whose member cannot be read
    passes ``is_zipfile`` and opens fine; reading the member must raise
    ``IncorrectFormatError`` instead of the underlying decompression error.
    """
    from superset.commands.importers.exceptions import IncorrectFormatError
    from superset.commands.importers.v1.utils import (
        get_contents_from_bundle,
        open_import_bundle,
    )

    corrupt = io.BytesIO(make_bundle())
    assert zipfile.is_zipfile(corrupt)

    with pytest.raises(IncorrectFormatError) as excinfo:
        with open_import_bundle(corrupt) as bundle:
            get_contents_from_bundle(bundle)

    assert excinfo.value.message == "Invalid or corrupted ZIP file"
    assert isinstance(excinfo.value.__cause__, cause)


def _make_oversized_member_bundle() -> bytes:
    """A bundle whose single member exceeds a lowered ZIPPED_FILE_MAX_SIZE."""
    return _make_bundle()


def _make_oversized_total_bundle() -> bytes:
    """A bundle whose members together exceed a lowered ZIP_FILE_MAX_TOTAL_SIZE."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as bundle:
        bundle.writestr("bundle/metadata.yaml", "version: 1.0.0\n")
        bundle.writestr("bundle/databases/db.yaml", "version: 1.0.0\n")
    return buf.getvalue()


def _make_high_ratio_bundle() -> bytes:
    """A bundle whose compress ratio exceeds the default ZIP_FILE_MAX_COMPRESS_RATIO."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("bundle/metadata.yaml", "0" * 1024 * 1024)
    return buf.getvalue()


@pytest.mark.parametrize(
    "make_bundle, config, message",
    [
        (
            _make_oversized_member_bundle,
            {"ZIPPED_FILE_MAX_SIZE": 10},
            "Found file with size above allowed threshold",
        ),
        (
            _make_oversized_total_bundle,
            {"ZIP_FILE_MAX_TOTAL_SIZE": 20},
            "Found total uncompressed size above allowed threshold",
        ),
        (
            _make_high_ratio_bundle,
            {},
            "Zip compress ratio above allowed threshold",
        ),
    ],
    ids=["member-size", "total-size", "compress-ratio"],
)
def test_get_contents_from_bundle_unsafe_zip(
    app: Any,
    make_bundle: Callable[[], bytes],
    config: dict[str, Any],
    message: str,
) -> None:
    """
    A bundle that fails the ZIP safety checks is bad user input and must raise
    ``IncorrectFormatError`` (422) instead of a bare ``SupersetException`` (500).
    """
    from superset.commands.importers.exceptions import IncorrectFormatError
    from superset.commands.importers.v1.utils import get_contents_from_bundle
    from superset.exceptions import SupersetException

    with patch.dict(app.config, config):
        with zipfile.ZipFile(io.BytesIO(make_bundle())) as bundle:
            with pytest.raises(IncorrectFormatError) as excinfo:
                get_contents_from_bundle(bundle)

    assert excinfo.value.status == 422
    assert excinfo.value.message == message
    assert isinstance(excinfo.value.__cause__, SupersetException)


def test_get_contents_from_bundle_non_utf8_member() -> None:
    """
    A config member that is not valid UTF-8 must raise ``IncorrectFormatError``
    instead of a raw ``UnicodeDecodeError``.
    """
    from superset.commands.importers.exceptions import IncorrectFormatError
    from superset.commands.importers.v1.utils import (
        get_contents_from_bundle,
        open_import_bundle,
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as bundle:
        bundle.writestr("bundle/metadata.yaml", b"\xff\xfe\x00bad")

    with pytest.raises(IncorrectFormatError) as excinfo:
        with open_import_bundle(io.BytesIO(buf.getvalue())) as bundle:
            get_contents_from_bundle(bundle)

    assert excinfo.value.message == "File metadata.yaml is not valid UTF-8"
    assert isinstance(excinfo.value.__cause__, UnicodeDecodeError)
