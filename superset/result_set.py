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
"""Superset wrapper around pyarrow.Table."""

import datetime
import logging
from decimal import Decimal
from typing import Any, Optional

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
from numpy.typing import NDArray

from superset.db_engine_specs import BaseEngineSpec
from superset.superset_typing import DbapiDescription, DbapiResult, ResultSetColumnType
from superset.utils import core as utils, json
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)


def dedup(l: list[str], suffix: str = "__", case_sensitive: bool = True) -> list[str]:  # noqa: E741
    """De-duplicates a list of string by suffixing a counter

    Always returns the same number of entries as provided, and always returns
    unique values. Case sensitive comparison by default.

    >>> print(','.join(dedup(['foo', 'bar', 'bar', 'bar', 'Bar'])))
    foo,bar,bar__1,bar__2,Bar
    >>> print(
        ','.join(dedup(['foo', 'bar', 'bar', 'bar', 'Bar'], case_sensitive=False))
    )
    foo,bar,bar__1,bar__2,Bar__3
    """
    new_l: list[str] = []
    seen: dict[str, int] = {}
    reserved = {item if case_sensitive else item.lower() for item in l}
    fixed_case_suffix = suffix if case_sensitive else suffix.lower()
    for item in l:
        s_fixed_case = item if case_sensitive else item.lower()
        if s_fixed_case in seen:
            seen[s_fixed_case] += 1
            while (
                s_fixed_case + fixed_case_suffix + str(seen[s_fixed_case]) in reserved
            ):
                seen[s_fixed_case] += 1
            reserved.add(s_fixed_case + fixed_case_suffix + str(seen[s_fixed_case]))
            item += suffix + str(seen[s_fixed_case])
        else:
            seen[s_fixed_case] = 0
        new_l.append(item)
    return new_l


def stringify(obj: Any) -> str:
    # ensure_ascii=False so non-ASCII characters in array/struct/JSON column
    # values (e.g. Cyrillic or CJK text from array_agg) render verbatim in the
    # result grid instead of as \uXXXX escape sequences. This only affects the
    # query result payload, not metadata persisted to the database.
    return json.dumps(obj, default=json.json_iso_dttm_ser, ensure_ascii=False)


def stringify_values(array: NDArray[Any]) -> NDArray[Any]:
    result = np.copy(array)

    with np.nditer(result, flags=["refs_ok"], op_flags=[["readwrite"]]) as it:
        for obj in it:
            if na_obj := pd.isna(obj):
                # pandas <NA> type cannot be converted to string
                obj[na_obj] = None
            else:
                try:
                    val = obj.item()
                    if isinstance(val, (dict, list)):
                        try:
                            # Use json.dumps for valid double-quoted JSON.
                            # str() gives single-quoted repr like {'a': 1}
                            # which breaks the frontend cell viewer.
                            obj[...] = stringify(val)
                        except TypeError:
                            # Non-JSON-serializable value (e.g. bytes, custom
                            # objects): fall back to str() to avoid crashing.
                            obj[...] = str(val)
                    elif isinstance(val, Decimal):
                        # str() switches to scientific notation for small or
                        # large exponents (-1.0E-7), which CSV export would
                        # formula-escape. NaN and Infinity have no exact value.
                        obj[...] = format(val, "f") if val.is_finite() else None
                    else:
                        # for simple string conversions
                        # this handles odd character types better
                        obj[...] = obj.astype(str)
                except ValueError:
                    obj[...] = stringify(obj)

    return result


def destringify(obj: str) -> Any:
    return json.loads(obj)


def stringify_extension_columns(table: pa.Table) -> pa.Table:
    """
    Replace Arrow extension-typed columns with their string representation.

    Superset cannot render Arrow extension types natively (see
    ``superset.utils.core.GenericDataType``). The most common case is the
    canonical ``uuid`` type: PyArrow >= 21 infers Python ``uuid.UUID`` values as
    that extension type (16-byte binary), which ``Table.to_pandas()`` surfaces as
    raw bytes. Stringifying here keeps such columns readable (UUID values become
    their canonical hex form). Plain binary/BLOB columns are not extension types
    and are left untouched.
    """
    for index in range(table.num_columns):
        field = table.schema.field(index)
        if isinstance(field.type, pa.BaseExtensionType):
            stringified = pa.array(
                [
                    None if value is None else str(value)
                    for value in table.column(index).to_pylist()
                ],
                type=pa.string(),
            )
            table = table.set_column(index, field.name, stringified)
    return table


def _opaque_numeric_to_decimal(column: pa.ChunkedArray) -> pa.ChunkedArray:
    """
    Cast an ``arrow.opaque`` NUMERIC column (string storage) to a decimal type.

    Some drivers, including the ADBC PostgreSQL driver, return NUMERIC as text
    rather than as ``decimal128``. The row path receives ``Decimal`` objects.

    * NaN / Infinity become NULL, as ``stringify_values`` does for a
      non-finite ``Decimal`` ("NaN and Infinity have no exact value").
    * ``decimal128(38, s)`` is tried first, then ``decimal256(76, s)``.
      Values that fit neither keep their exact string form.
    """
    storage = pa.chunked_array(
        [chunk.storage for chunk in column.chunks], type=column.type.storage_type
    )
    finite = pc.match_substring_regex(storage, pattern=r"^[+-]?[0-9]*\.?[0-9]+$")
    storage = pc.if_else(finite, storage, pa.scalar(None, pa.string()))
    if storage.null_count == len(storage):
        return storage
    fraction = pc.replace_substring_regex(storage, pattern=r"^[^.]*\.?", replacement="")
    scale = pc.max(pc.utf8_length(fraction)).as_py() or 0
    for decimal_type in (pa.decimal128, pa.decimal256):
        precision = 38 if decimal_type is pa.decimal128 else 76
        if scale > precision:
            continue
        try:
            return pc.cast(storage, decimal_type(precision, scale))
        except (pa.ArrowInvalid, pa.ArrowNotImplementedError):
            continue
    return storage


_HEX_DIGITS = np.frombuffer(b"0123456789abcdef", dtype=np.uint8)


def _uuid_to_string(column: pa.ChunkedArray) -> pa.ChunkedArray:
    """
    Vectorized ``arrow.uuid`` to the canonical 36-character string.

    ``stringify_extension_columns`` does this with a Python loop over
    ``to_pylist()``. The bytes are the same as ``str(uuid.UUID)``.
    """
    chunks = []
    for chunk in column.chunks:
        storage = chunk.storage
        length = len(storage)
        if length == 0:
            chunks.append(pa.array([], type=pa.string()))
            continue
        raw = np.frombuffer(
            storage.buffers()[1], dtype=np.uint8, count=(storage.offset + length) * 16
        )[storage.offset * 16 :].reshape(length, 16)
        hexed = np.empty((length, 32), dtype=np.uint8)
        hexed[:, 0::2] = _HEX_DIGITS[raw >> 4]
        hexed[:, 1::2] = _HEX_DIGITS[raw & 0x0F]
        dashed = np.insert(hexed, [8, 12, 16, 20], ord("-"), axis=1)
        mask = storage.is_null().to_numpy(zero_copy_only=False)
        values = pa.array(
            np.ascontiguousarray(dashed).view("S36").ravel(),
            mask=mask,
            type=pa.binary(36),
        )
        chunks.append(values.cast(pa.string()))
    return pa.chunked_array(chunks, type=pa.string())


def _uint64_over_int64_to_string(column: pa.ChunkedArray) -> pa.ChunkedArray:
    """
    Stringify a uint64 column when any value does not fit in int64.

    ``fetchall`` returns Python ints. ``pa.array`` raises ``OverflowError``
    above 2**63 - 1 and the row constructor then stringifies that whole
    column (see ``test_integers_outside_int64_are_stringified``). Values that
    fit stay uint64; the row path would infer int64, which is the same width
    difference already accepted for int32.
    """
    if len(column) == 0:
        return column
    limit = pa.scalar(2**63 - 1, type=column.type)
    exceeds = pc.fill_null(pc.greater(column, limit), False)
    if pc.any(exceeds).as_py():
        return pc.cast(column, pa.string())
    return column


def convert_to_string(value: Any) -> str:
    """
    Used to ensure column names from the cursor description are strings.
    """
    if isinstance(value, str):
        return value

    if isinstance(value, bytes):
        return value.decode("utf-8")

    return str(value)


def normalize_cursor_description_names(
    cursor_description: DbapiDescription,
) -> list[str]:
    """
    Replace empty cursor.description names with synthetic names that do not
    collide with any explicit column names.
    """
    normalized_names: list[str] = []
    unavailable_names = {
        convert_to_string(col[0])
        for col in cursor_description
        if convert_to_string(col[0])
    }
    synthetic_index = 0

    for col in cursor_description:
        column_name = convert_to_string(col[0])
        if column_name:
            normalized_names.append(column_name)
            continue

        while True:
            synthetic_name = f"_col_{synthetic_index}"
            synthetic_index += 1
            if synthetic_name not in unavailable_names:
                unavailable_names.add(synthetic_name)
                normalized_names.append(synthetic_name)
                break

    return normalized_names


class SupersetResultSet:
    def __init__(  # pylint: disable=too-many-locals  # noqa: C901
        self,
        data: DbapiResult,
        cursor_description: DbapiDescription,
        db_engine_spec: type[BaseEngineSpec],
        *,
        truncated: bool = False,
    ):
        self.truncated = truncated
        self.db_engine_spec = db_engine_spec
        data = data or []
        column_names: list[str] = []
        pa_data: list[pa.Array] = []
        deduped_cursor_desc: list[tuple[Any, ...]] = []
        numpy_dtype: list[tuple[str, ...]] = []
        stringified_arr: NDArray[Any]
        # Track columns with nested/JSON data to preserve them as objects
        self._nested_columns: dict[str, list[Any]] = {}
        # Arrow-native path only: JSON text parsed on first sync access.
        self._lazy_json_columns: dict[str, pa.ChunkedArray] = {}

        if cursor_description:
            # get deduped list of column names
            # Some databases (e.g. SQL Server) return an empty string as the
            # column name for un-aliased expressions like SELECT COUNT(*).
            # An empty field name is illegal in NumPy structured arrays and in
            # PyArrow tables, so we substitute a synthetic name when needed.
            # Synthetic names are chosen to avoid colliding with any explicit
            # column names before deduplication runs.
            # See https://github.com/apache/superset/issues/23848
            column_names = dedup(normalize_cursor_description_names(cursor_description))

            # fix cursor descriptor with the deduped names
            deduped_cursor_desc = [
                tuple([column_name, *list(description)[1:]])  # noqa: C409
                for column_name, description in zip(
                    column_names, cursor_description, strict=False
                )
            ]

            # generate numpy structured array dtype
            numpy_dtype = [(column_name, "object") for column_name in column_names]

        # only do expensive recasting if datatype is not standard list of tuples
        if data and (not isinstance(data, list) or not isinstance(data[0], tuple)):
            data = [tuple(row) for row in data]
        columns = np.array(data, dtype=numpy_dtype)

        for column in column_names:
            col_values = columns[column].tolist()
            if db_engine_spec.requires_column_value_normalization:
                col_values = db_engine_spec.normalize_column_values(col_values)
            try:
                pa_data.append(pa.array(col_values))
            except (
                pa.lib.ArrowInvalid,
                pa.lib.ArrowTypeError,
                pa.lib.ArrowNotImplementedError,
                ValueError,
                TypeError,  # this is super hackey,
                # https://issues.apache.org/jira/browse/ARROW-7855
                # Integers outside int64, e.g. BIGINT UNSIGNED above 2**63 - 1.
                OverflowError,
            ):
                # Check if original data has nested types (lists/dicts)
                # before stringifying, since stringification removes
                # the nested structure that the second loop relies on
                # to detect via pa.types.is_nested().
                original_values = columns[column].tolist()
                if any(
                    isinstance(v, (list, dict))
                    for v in original_values
                    if v is not None
                ):
                    self._nested_columns[column] = original_values
                # attempt serialization of values as strings
                stringified_arr = stringify_values(columns[column])
                pa_data.append(pa.array(stringified_arr.tolist()))

        if pa_data:  # pylint: disable=too-many-nested-blocks
            for i, column in enumerate(column_names):
                if pa.types.is_nested(pa_data[i].type):
                    # Preserve nested/JSON data as Python objects for use in
                    # templates like Handlebars. Store original values before
                    # stringifying for PyArrow compatibility.
                    # See: https://github.com/apache/superset/issues/25125
                    self._nested_columns[column] = columns[column].tolist()
                    stringified_arr = stringify_values(columns[column])
                    pa_data[i] = pa.array(stringified_arr.tolist())

                elif pa.types.is_temporal(pa_data[i].type):
                    # workaround for bug converting
                    # `psycopg2.tz.FixedOffsetTimezone` tzinfo values.
                    # related: https://issues.apache.org/jira/browse/ARROW-5248
                    sample = self.first_nonempty(columns[column])
                    if sample and isinstance(sample, datetime.datetime):
                        try:
                            if sample.tzinfo:
                                tz = sample.tzinfo
                                series = pd.Series(columns[column])
                                series = pd.to_datetime(
                                    series, utc=True, errors="coerce"
                                )
                                # Match the just-converted series' own
                                # resolution instead of hardcoding "ns": a
                                # far-future timestamp valid only at a wider
                                # resolution (e.g. "us") would otherwise raise
                                # ArrowInvalid casting down to nanoseconds for
                                # no reason. pandas itself already picked
                                # whatever resolution represents this data
                                # losslessly (narrower only when the value
                                # actually needs it), so reusing it is always
                                # safe -- unlike the original column's own
                                # pre-conversion unit, which can be coarser
                                # than this data's real precision (e.g. "us"
                                # inferred from an empty/all-null sample) and
                                # would lose precision being cast down to it.
                                pa_data[i] = pa.Array.from_pandas(
                                    series,
                                    type=pa.timestamp(series.dtype.unit, tz=tz),
                                )
                        except Exception as ex:  # pylint: disable=broad-except
                            logger.exception(ex)

        if not pa_data:
            column_names = []

        # PyArrow >= 21 infers Python `uuid.UUID` values as the Arrow `uuid`
        # extension type rather than raising (which previously routed them
        # through the stringification fallback above). Stringify any extension
        # columns so they render as readable text instead of raw bytes.
        self.table = stringify_extension_columns(
            pa.Table.from_arrays(pa_data, names=column_names)
        )
        self._type_dict: dict[str, Any] = {}
        try:
            # The driver may not be passing a cursor.description
            self._type_dict = {
                col: db_engine_spec.get_datatype(deduped_cursor_desc[i][1])
                for i, col in enumerate(column_names)
                if deduped_cursor_desc
            }
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)

    @classmethod
    def from_arrow(
        cls,
        table: pa.Table,
        db_engine_spec: type[BaseEngineSpec],
        *,
        truncated: bool = False,
    ) -> "SupersetResultSet":
        """
        Build a result set from a ``pyarrow.Table``.

        The table may come from any producer: an ADBC cursor, DuckDB's
        ``to_arrow_table``, Flight SQL, or a SQLAlchemy execution that already
        returned a Table. ADBC is not required, and this constructor does not
        fetch anything.

        Normalization follows the row constructor, column by column:

        * names are normalized and de-duplicated the same way;
        * dictionary-encoded columns are decoded (the row path never sees
          categoricals);
        * ``arrow.opaque`` NUMERIC becomes a decimal, with NaN/Infinity NULL;
        * ``arrow.json`` keeps the server's JSON text and parses objects
          lazily through ``nested_columns`` / ``to_pandas_df()``;
        * nested list/struct/map values are stringified as JSON and kept in
          ``nested_columns``, as the row path does for list/dict cells;
        * ``arrow.uuid`` is stringified; other extension types still go
          through ``stringify_extension_columns``;
        * uint64 values above 2**63 - 1 stringify the column, matching the
          row constructor's ``OverflowError`` fallback.
        """
        result_set = cls.__new__(cls)
        result_set.truncated = truncated
        result_set.db_engine_spec = db_engine_spec
        result_set._nested_columns = {}
        result_set._lazy_json_columns = {}

        column_names = dedup(
            normalize_cursor_description_names(
                [(name,) for name in table.column_names]  # type: ignore[misc]
            )
        )
        if column_names != table.column_names:
            table = table.rename_columns(column_names)

        type_dict: dict[str, Any] = {}
        for index, field in enumerate(table.schema):
            column = table.column(index)
            name = column_names[index]
            logical_type = (
                field.type.value_type
                if pa.types.is_dictionary(field.type)
                else field.type
            )
            # Vendor metadata wins, same as a cursor description. Otherwise use
            # the same Arrow-type names as ``convert_pa_dtype`` (what the row
            # path uses when the cursor type is missing). Captured before
            # normalization so a uint64 column stringified for overflow still
            # reports INT, matching a cursor type of int.
            if db_type := db_engine_spec.get_datatype_from_arrow_field(field):
                type_dict[name] = db_type
            elif inferred := cls.convert_pa_dtype(logical_type):
                type_dict[name] = inferred
            column = result_set._normalize_arrow_column(name, field, column)
            if column is not table.column(index):
                table = table.set_column(index, name, column)

        result_set.table = stringify_extension_columns(table)
        result_set._type_dict = type_dict
        return result_set

    def _normalize_arrow_column(
        self, name: str, field: pa.Field, column: pa.ChunkedArray
    ) -> pa.ChunkedArray:
        """Per-column normalization for ``from_arrow``."""
        if pa.types.is_dictionary(field.type):
            column = column.cast(field.type.value_type)
            field = field.with_type(field.type.value_type)
        # Engine specs opt in. Postgres rewrites interval/duration to the
        # milliseconds ``fetch_data`` already produces. Other specs, including
        # the default, leave the column alone.
        normalize = getattr(self.db_engine_spec, "normalize_arrow_column", None)
        if normalize is not None:
            replaced = normalize(field, column)
            if replaced is not None:
                return replaced
        if isinstance(field.type, pa.BaseExtensionType):
            extension_name = getattr(field.type, "extension_name", "")
            if extension_name == "arrow.json":
                column = pa.chunked_array(
                    [chunk.storage for chunk in column.chunks],
                    type=field.type.storage_type,
                )
                self._lazy_json_columns[name] = column
                return column
            if extension_name == "arrow.opaque" and (
                getattr(field.type, "type_name", "") == "numeric"
            ):
                return _opaque_numeric_to_decimal(column)
            if extension_name == "arrow.uuid":
                return _uuid_to_string(column)
            return column
        if pa.types.is_nested(field.type):
            values = column.to_pylist()
            self._nested_columns[name] = values
            return pa.chunked_array(
                [
                    pa.array(
                        [
                            None if value is None else stringify(value)
                            for value in values
                        ],
                        type=pa.string(),
                    )
                ]
            )
        if pa.types.is_unsigned_integer(field.type) and field.type.bit_width == 64:
            return _uint64_over_int64_to_string(column)
        return column

    def _materialize_lazy_json_columns(self) -> None:
        for column, values in self._lazy_json_columns.items():
            parsed = [
                None if value is None else json.loads(value)
                for value in values.to_pylist()
            ]
            # Same rule as the row path: only containers count as nested.
            if any(isinstance(value, (list, dict)) for value in parsed):
                self._nested_columns[column] = parsed
                continue
            try:
                scalars = pa.array(parsed)
            except (pa.ArrowInvalid, pa.ArrowTypeError, OverflowError):
                scalars = pa.array(
                    [None if value is None else str(value) for value in parsed],
                    type=pa.string(),
                )
            index = self.table.schema.get_field_index(column)
            self.table = self.table.set_column(index, column, scalars)
        self._lazy_json_columns = {}

    @staticmethod
    def convert_pa_dtype(pa_dtype: pa.DataType) -> Optional[str]:
        if pa.types.is_boolean(pa_dtype):
            return "BOOL"
        if pa.types.is_integer(pa_dtype):
            return "INT"
        if pa.types.is_floating(pa_dtype):
            return "FLOAT"
        if pa.types.is_string(pa_dtype):
            return "STRING"
        if pa.types.is_temporal(pa_dtype):
            return "DATETIME"
        return None

    @staticmethod
    def convert_table_to_df(table: pa.Table) -> pd.DataFrame:
        try:
            return table.to_pandas(integer_object_nulls=True)
        except pa.lib.ArrowInvalid:
            return table.to_pandas(integer_object_nulls=True, timestamp_as_object=True)

    @staticmethod
    def first_nonempty(items: NDArray[Any]) -> Any:
        return next((i for i in items if i), None)

    def is_temporal(self, db_type_str: Optional[str]) -> bool:
        column_spec = self.db_engine_spec.get_column_spec(db_type_str)
        if column_spec is None:
            return False
        return column_spec.is_dttm

    def type_generic(
        self, db_type_str: Optional[str]
    ) -> Optional[utils.GenericDataType]:
        column_spec = self.db_engine_spec.get_column_spec(db_type_str)
        if column_spec is None:
            return None

        if column_spec.is_dttm:
            return GenericDataType.TEMPORAL

        return column_spec.generic_type

    def data_type(self, col_name: str, pa_dtype: pa.DataType) -> Optional[str]:
        """Given a pyarrow data type, Returns a generic database type"""
        set_type = self._type_dict.get(col_name)
        pa_mapped = self.convert_pa_dtype(pa_dtype)
        return self.db_engine_spec.resolve_column_type(set_type, pa_mapped)

    def to_pandas_df(self) -> pd.DataFrame:
        self._materialize_lazy_json_columns()
        df = self.convert_table_to_df(self.table)
        # Restore nested/JSON columns as Python objects instead of strings
        # This allows JSON data to be used directly in templates like Handlebars.
        # Nested column keys are drawn from the same column_names used to build
        # the table/df, so every key is guaranteed to be present as a column.
        for column, values in self._nested_columns.items():
            assert column in df.columns
            df[column] = values
        return df

    @property
    def nested_columns(self) -> dict[str, list[Any]]:
        """Original nested values restored by the synchronous DataFrame path."""
        self._materialize_lazy_json_columns()
        return self._nested_columns

    @property
    def pa_table(self) -> pa.Table:
        return self.table

    @property
    def size(self) -> int:
        return self.table.num_rows

    @property
    def columns(self) -> list[ResultSetColumnType]:
        if not self.table.column_names:
            return []

        columns = []
        for col in self.table.schema:
            db_type_str = self.data_type(col.name, col.type)
            column: ResultSetColumnType = {
                "column_name": col.name,
                "name": col.name,
                "type": db_type_str,
                "type_generic": self.type_generic(db_type_str),
                "is_dttm": self.is_temporal(db_type_str) or False,
            }
            columns.append(column)
        return columns
