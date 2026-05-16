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

from flask import Flask
from flask_babel import lazy_gettext as _
from sqlalchemy import Table, text, TypeDecorator
from sqlalchemy.engine import Connection, Dialect, Row
from sqlalchemy_utils import EncryptedType as SqlaEncryptedType


class EncryptedType(SqlaEncryptedType):
    cache_ok = True


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
    def __init__(self, previous_secret_key: str) -> None:
        from superset import db  # pylint: disable=import-outside-toplevel

        self._db = db
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
        Re encrypts all columns in a Row

        Re-encryption is idempotent per column: we first ask whether the
        current key can already decrypt the value, and skip if so. Only if
        the current key fails do we fall back to decrypting with the
        previous key and re-encrypting. Checking the current key first
        keeps ``run()`` idempotent regardless of what ``previous_secret_key``
        the caller supplies — even re-running with the same (unchanged)
        ``SECRET_KEY`` will not rewrite rows.

        NULL values are never encrypted, so they are reported separately
        (neither re-encrypted nor "skipped because already current").

        Per-column outcomes are accumulated onto ``stats`` so the caller can
        report a summary. Columns whose ciphertext is unreadable under both
        keys are counted as failures and logged; the exception is not
        propagated, so processing continues. The caller is responsible for
        raising once all rows have been scanned.

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

            # Fast path: if the current key can already read the value,
            # leave it untouched. A failure here simply means we need to try
            # the previous key below — not a condition worth logging.
            try:
                encrypted_type.process_result_value(raw_value, self._dialect)
            except Exception:  # noqa: BLE001, S110  # pylint: disable=broad-except
                pass
            else:
                stats.skipped += 1
                continue

            # Current key cannot decrypt — try the previous key.
            previous_encrypted_type = EncryptedType(
                type_in=encrypted_type.underlying_type, key=self._previous_secret_key
            )
            try:
                unencrypted_value = previous_encrypted_type.process_result_value(
                    raw_value, self._dialect
                )
            except Exception as prev_ex:  # noqa: BLE001  # pylint: disable=broad-except
                logger.error(
                    "Column [%s.%s] cannot be decrypted under the previous"
                    " or current secret key (%s: %s)",
                    table_name,
                    column_name,
                    type(prev_ex).__name__,
                    prev_ex,
                )
                stats.failed += 1
                continue

            re_encrypted_columns[column_name] = encrypted_type.process_bind_param(
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
        Re-encrypt every encrypted column in the ORM under the current
        ``SECRET_KEY``.

        Returns per-value counts of re-encrypted, skipped (already under the
        current key), and failed (undecryptable) outcomes. If any failures
        occurred the transaction is rolled back by raising after the
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
