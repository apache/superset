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
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

from flask import current_app, Flask
from flask_babel import lazy_gettext as _
from sqlalchemy import Table, text, TypeDecorator
from sqlalchemy.engine import Connection, Dialect, Row
from sqlalchemy_utils import EncryptedType as SqlaEncryptedType
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine, AesGcmEngine


class EncryptedType(SqlaEncryptedType):
    cache_ok = True


# Named encryption engines selectable via the ``SQLALCHEMY_ENCRYPTED_FIELD_ENGINE``
# config. "aes" (AES-CBC) is the historical default; "aes-gcm" is authenticated
# encryption (recommended for new deployments). NOTE: switching an existing
# deployment from "aes" to "aes-gcm" requires re-encrypting all stored secrets
# first — see the SIP referenced in the docs. Changing this on a populated
# database without that migration will make existing secrets undecryptable.
ENCRYPTION_ENGINES = {
    "aes": AesEngine,
    "aes-gcm": AesGcmEngine,
}


ENC_ADAPTER_TAG_ATTR_NAME = "__created_by_enc_field_adapter__"
logger = logging.getLogger(__name__)


@dataclass
class ReEncryptStats:
    """Per-value outcome counts for a SecretsMigrator.run() invocation."""

    re_encrypted: int = 0
    skipped: int = 0
    null: int = 0
    failed: int = 0


class AbstractEncryptedFieldAdapter(ABC):  # pylint: disable=too-few-public-methods
    @abstractmethod
    def create(
        self,
        app_config: Optional[dict[str, Any]],
        *args: list[Any],
        **kwargs: Optional[dict[str, Any]],
    ) -> TypeDecorator:
        pass


class SQLAlchemyUtilsAdapter(  # pylint: disable=too-few-public-methods
    AbstractEncryptedFieldAdapter
):
    def create(
        self,
        app_config: Optional[dict[str, Any]],
        *args: list[Any],
        **kwargs: Optional[dict[str, Any]],
    ) -> TypeDecorator:
        if app_config:
            # Select the encryption engine from config, defaulting to the
            # historical AES-CBC engine for backward compatibility. An explicit
            # ``engine`` kwarg (e.g. from the migrator) always takes precedence.
            if "engine" not in kwargs:
                engine_name = app_config.get("SQLALCHEMY_ENCRYPTED_FIELD_ENGINE", "aes")
                if engine_name not in ENCRYPTION_ENGINES:
                    # Do not log the configured value itself: it originates from
                    # the app config (which also holds the SECRET_KEY), and
                    # static analysis flags interpolating any config-sourced
                    # value into a log as potential clear-text secret logging.
                    # The set of valid engines is enough to diagnose the typo.
                    logger.warning(
                        "Unrecognized SQLALCHEMY_ENCRYPTED_FIELD_ENGINE;"
                        " falling back to AES-CBC. Valid engines: %s",
                        ", ".join(sorted(ENCRYPTION_ENGINES)),
                    )
                kwargs["engine"] = ENCRYPTION_ENGINES.get(engine_name, AesEngine)
            return EncryptedType(*args, lambda: app_config["SECRET_KEY"], **kwargs)

        raise Exception(  # pylint: disable=broad-exception-raised
            "Missing app_config kwarg"
        )


class EncryptedFieldFactory:
    def __init__(self) -> None:
        self._concrete_type_adapter: Optional[AbstractEncryptedFieldAdapter] = None
        self._config: Optional[dict[str, Any]] = None

    def init_app(self, app: Flask) -> None:
        self._config = app.config
        self._concrete_type_adapter = app.config[
            "SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER"
        ]()

    def create(
        self, *args: list[Any], **kwargs: Optional[dict[str, Any]]
    ) -> TypeDecorator:
        if self._concrete_type_adapter:
            adapter = self._concrete_type_adapter.create(self._config, *args, **kwargs)
            setattr(adapter, ENC_ADAPTER_TAG_ATTR_NAME, True)
            return adapter

        raise Exception(  # pylint: disable=broad-exception-raised
            "App not initialized yet. Please call init_app first"
        )

    @staticmethod
    def created_by_enc_field_factory(field: TypeDecorator) -> bool:
        return getattr(field, ENC_ADAPTER_TAG_ATTR_NAME, False)


class SecretsMigrator:
    """Re-encrypts every app-encrypted column in the ORM.

    Two modes, which can also be combined:

    - **Key rotation** — pass ``previous_secret_key``. Values are decrypted
      under the previous key and re-encrypted under the current ``SECRET_KEY``
      using the currently-configured engine.
    - **Engine migration** — pass ``target_engine`` (e.g. ``AesGcmEngine``).
      Values are decrypted under the current ``SECRET_KEY`` with the source
      engine and re-encrypted with the target engine. This is how an existing
      install moves from AES-CBC to authenticated AES-GCM without bricking
      stored secrets; the ``SECRET_KEY`` itself is unchanged.

    Both modes share the same all-or-nothing transaction and per-column
    idempotency: a value already readable in the target form is left untouched,
    so a run can be safely repeated or resumed.
    """

    def __init__(
        self,
        previous_secret_key: Optional[str] = None,
        target_engine: Optional[type[Any]] = None,
    ) -> None:
        from superset import db  # pylint: disable=import-outside-toplevel

        self._db = db
        self._secret_key = current_app.config["SECRET_KEY"]
        self._target_engine = target_engine
        # In engine-migration mode the SECRET_KEY does not change: the source
        # ciphertext is decrypted under the current key (with the source
        # engine), so default the "previous" key to the current one when the
        # caller only asked for an engine change.
        if target_engine is not None and not previous_secret_key:
            previous_secret_key = self._secret_key
        self._previous_secret_key = previous_secret_key
        self._dialect: Dialect = db.engine.url.get_dialect()

    def discover_encrypted_fields(
        self,
    ) -> dict[str, tuple[Table, dict[str, EncryptedType]]]:
        """
        Iterates over ORM-mapped tables, looking for EncryptedType columns
        along the way. Builds up a dict of
        table_name -> (Table, dict of col_name: enc type instance)

        Superset's ORM models inherit from Flask-AppBuilder's declarative base
        (`flask_appbuilder.Model`), whose MetaData is distinct from
        `db.metadata`. We combine both sources so encrypted columns are found
        regardless of which base a model uses. FAB's metadata takes precedence
        when a table name appears in both registries.

        The Table object is returned alongside the encrypted columns so callers
        can introspect the schema (notably the primary key) without assuming a
        conventional `id` column — some tables (e.g. `semantic_layers`) use a
        `uuid` primary key instead.

        :return: mapping of table name to (Table, {column name: EncryptedType})
        """
        from flask_appbuilder import (  # pylint: disable=import-outside-toplevel
            Model as FABModel,
        )

        meta_info: dict[str, tuple[Table, dict[str, EncryptedType]]] = {}

        tables: dict[str, Any] = dict(FABModel.metadata.tables)
        for table_name, table in self._db.metadata.tables.items():
            tables.setdefault(table_name, table)

        for table_name, table in tables.items():
            for col_name, col in table.columns.items():
                if isinstance(col.type, EncryptedType):
                    _, cols = meta_info.get(table_name, (table, {}))
                    cols[col_name] = col.type
                    meta_info[table_name] = (table, cols)

        return meta_info

    @staticmethod
    def _read_bytes(col_name: str, value: Any) -> Optional[bytes]:
        if value is None or isinstance(value, bytes):
            return value
        # Note that the Postgres Driver returns memoryview's for BLOB types
        if isinstance(value, memoryview):
            return value.tobytes()
        if isinstance(value, str):
            return bytes(value.encode("utf8"))

        # Just bail if we haven't seen this type before...
        raise ValueError(
            _(
                "DB column %(col_name)s has unknown type: %(value_type)s",
                col_name=col_name,
                value_type=type(value),
            )
        )

    @staticmethod
    def _select_columns_from_table(
        conn: Connection,
        pk_columns: list[str],
        column_names: list[str],
        table_name: str,
    ) -> Row:
        cols = ",".join(pk_columns + column_names)
        return conn.execute(f"SELECT {cols} FROM {table_name}")  # noqa: S608

    def _target_type(self, encrypted_type: EncryptedType) -> EncryptedType:
        """The EncryptedType to re-encrypt a value *into*.

        For a key rotation this is the column's own configured type (current
        engine + lazily-resolved current key). For an engine migration it is a
        type pinned to the requested target engine under the current key.
        """
        if self._target_engine is None:
            return encrypted_type
        return EncryptedType(
            type_in=encrypted_type.underlying_type,
            key=self._secret_key,
            engine=self._target_engine,
        )

    def _source_decryptors(self, encrypted_type: EncryptedType) -> list[EncryptedType]:
        """Candidate decryptors, tried in order, to recover a value's plaintext.

        1. The column's configured type — current key + currently-configured
           engine. During an engine migration this reads the source ciphertext
           while the config still points at the source engine.
        2. The previous key under each supported engine. Trying the column's
           configured engine covers ``SECRET_KEY`` rotation for any engine
           (including AES-GCM); also trying the historical AES-CBC engine
           covers an engine migration whose config was flipped to the target
           engine *before* the migrator ran (the source data is still CBC under
           the current key, which the previous key defaults to in
           engine-migration mode).
        """
        decryptors = [encrypted_type]
        if self._previous_secret_key:
            # Try the column's own engine first, then any remaining supported
            # engines (notably the historical AES-CBC), de-duplicated so we
            # never build the same decryptor twice.
            engines: list[type[Any]] = [type(encrypted_type.engine)]
            for engine in ENCRYPTION_ENGINES.values():
                if engine not in engines:
                    engines.append(engine)
            decryptors.extend(
                EncryptedType(
                    type_in=encrypted_type.underlying_type,
                    key=self._previous_secret_key,
                    engine=engine,
                )
                for engine in engines
            )
        return decryptors

    def _re_encrypt_row(
        self,
        conn: Connection,
        row: Row,
        table_name: str,
        columns: dict[str, EncryptedType],
        pk_columns: list[str],
        stats: ReEncryptStats,
    ) -> None:
        """
        Re-encrypts all columns in a Row into the target form.

        The "target form" is current-key + currently-configured engine for a
        ``SECRET_KEY`` rotation, or current-key + the requested engine for an
        engine migration (see ``_target_type``).

        Re-encryption is idempotent per column: a value that can already be
        read in the target form is left untouched. This keeps ``run()``
        idempotent regardless of what ``previous_secret_key`` the caller
        supplies, and lets an interrupted engine migration be resumed.
        Otherwise the plaintext is recovered from the first candidate source
        decryptor that can read it (see ``_source_decryptors``) and re-encrypted
        into the target form.

        NULL values are never encrypted, so they are reported separately
        (neither re-encrypted nor "skipped because already current").

        Per-column outcomes are accumulated onto ``stats`` so the caller can
        report a summary. Columns whose ciphertext is unreadable under any
        candidate key/engine are counted as failures and logged; the exception
        is not propagated, so processing continues. The caller is responsible
        for raising once all rows have been scanned.

        If no columns need re-encryption, no UPDATE is issued.

        :param row: Current row to reencrypt
        :param columns: Meta info from columns
        :param pk_columns: Primary key column names used to target the row
        :param stats: Mutable counters updated per column
        """
        re_encrypted_columns = {}

        for column_name, encrypted_type in columns.items():
            raw_value = self._read_bytes(column_name, row[column_name])

            # NULL values aren't encrypted; there is nothing to migrate.
            if raw_value is None:
                stats.null += 1
                continue

            target_type = self._target_type(encrypted_type)

            # Fast path: if the value can already be read in the target form,
            # leave it untouched. A failure here simply means we need to try the
            # source decryptors below — not a condition worth logging.
            try:
                target_type.process_result_value(raw_value, self._dialect)
            except Exception:  # noqa: BLE001, S110  # pylint: disable=broad-except
                pass
            else:
                stats.skipped += 1
                continue

            # Recover the plaintext from the first source decryptor that can
            # read the value (current engine/key, then previous key).
            unencrypted_value = None
            decrypted = False
            last_error: Optional[Exception] = None
            for decryptor in self._source_decryptors(encrypted_type):
                try:
                    unencrypted_value = decryptor.process_result_value(
                        raw_value, self._dialect
                    )
                except Exception as ex:  # noqa: BLE001  # pylint: disable=broad-except
                    last_error = ex
                    continue
                decrypted = True
                break

            if not decrypted:
                logger.error(
                    "Column [%s.%s] cannot be decrypted under any known"
                    " key/engine (%s: %s)",
                    table_name,
                    column_name,
                    type(last_error).__name__ if last_error else "None",
                    last_error,
                )
                stats.failed += 1
                continue

            re_encrypted_columns[column_name] = target_type.process_bind_param(
                unencrypted_value,
                self._dialect,
            )
            stats.re_encrypted += 1

        if not re_encrypted_columns:
            return

        set_cols = ",".join(f"{name} = :{name}" for name in re_encrypted_columns)
        where_clause = " AND ".join(f"{pk} = :_pk_{pk}" for pk in pk_columns)
        pk_bind = {f"_pk_{pk}": row[pk] for pk in pk_columns}
        conn.execute(
            text(
                f"UPDATE {table_name} SET {set_cols} WHERE {where_clause}"  # noqa: S608
            ),
            **pk_bind,
            **re_encrypted_columns,
        )

    def run(self) -> ReEncryptStats:
        """
        Re-encrypt every encrypted column in the ORM into the target form
        (current ``SECRET_KEY`` and, for an engine migration, the target
        engine).

        Returns per-value counts of re-encrypted, skipped (already in the
        target form), null, and failed (undecryptable) outcomes. If any
        failures occurred the transaction is rolled back by raising after the
        summary is logged, so partial re-encryption never commits.
        """
        encrypted_meta_info = self.discover_encrypted_fields()
        stats = ReEncryptStats()

        with self._db.engine.begin() as conn:
            logger.info("Collecting info for re encryption")
            for table_name, (table, columns) in encrypted_meta_info.items():
                pk_columns = [c.name for c in table.primary_key.columns]
                if not pk_columns:
                    logger.warning(
                        "Skipping %s: no primary key, cannot target rows for update",
                        table_name,
                    )
                    continue
                column_names = list(columns.keys())
                rows = self._select_columns_from_table(
                    conn, pk_columns, column_names, table_name
                )

                for row in rows:
                    self._re_encrypt_row(
                        conn, row, table_name, columns, pk_columns, stats
                    )

            logger.info(
                "Re-encryption summary: %d re-encrypted, %d skipped,"
                " %d null, %d failed",
                stats.re_encrypted,
                stats.skipped,
                stats.null,
                stats.failed,
            )
            if stats.failed:
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"Re-encryption failed for {stats.failed} value(s); "
                    "transaction rolled back"
                )

        logger.info("All tables processed")
        return stats
