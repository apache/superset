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
# pylint: disable=C,R,W
""" Superset wrapper around pyarrow.Table.
"""
import datetime
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Type

import numpy as np
import pandas as pd
import pyarrow as pa

from superset import db_engine_specs
from superset.utils import core as utils


def dedup(l: List[str], suffix: str = "__", case_sensitive: bool = True) -> List[str]:
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
    new_l: List[str] = []
    seen: Dict[str, int] = {}
    for s in l:
        s_fixed_case = s if case_sensitive else s.lower()
        if s_fixed_case in seen:
            seen[s_fixed_case] += 1
            s += suffix + str(seen[s_fixed_case])
        else:
            seen[s_fixed_case] = 0
        new_l.append(s)
    return new_l


def stringify(obj: Any) -> str:
    return json.dumps(obj, default=utils.json_iso_dttm_ser)


def stringify_values(array: np.ndarray) -> np.ndarray:
    vstringify: Callable = np.vectorize(stringify)
    return vstringify(array)


class SupersetResultSet:
    def __init__(
        self,
        data: List[Tuple[Any, ...]],
        cursor_description: Tuple[Any, ...],
        db_engine_spec: Type[db_engine_specs.BaseEngineSpec],
    ):
        data = data or []
        column_names: List[str] = []
        pa_data: List[pa.Array] = []
        deduped_cursor_desc: List[Tuple[Any, ...]] = []
        numpy_dtype: List[Tuple[str, ...]] = []
        stringified_arr: np.ndarray

        if cursor_description:
            # get deduped list of column names
            column_names = dedup([col[0] for col in cursor_description])

            # fix cursor descriptor with the deduped names
            deduped_cursor_desc = [
                tuple([column_name, *list(description)[1:]])
                for column_name, description in zip(column_names, cursor_description)
            ]

            # generate numpy structured array dtype
            numpy_dtype = [(column_name, "object") for column_name in column_names]

        # put data in a structured array so we can efficiently access each column.
        # cast `data` as list due to MySQL (others?) wrapping results with a tuple.
        array = np.array(list(data), dtype=numpy_dtype)
        if array.size > 0:
            for column in column_names:
                try:
                    pa_data.append(pa.array(array[column].tolist()))
                except (
                    pa.lib.ArrowInvalid,
                    pa.lib.ArrowTypeError,
                    pa.lib.ArrowNotImplementedError,
                ):
                    # attempt serialization of values as strings
                    stringified_arr = stringify_values(array[column])
                    pa_data.append(pa.array(stringified_arr.tolist()))

        if pa_data:
            for i, column in enumerate(column_names):
                if pa.types.is_nested(pa_data[i].type):
                    # TODO: revisit nested column serialization once PyArrow updated with:
                    # https://github.com/apache/arrow/pull/6199
                    # Related issue: https://github.com/apache/incubator-superset/issues/8978
                    stringified_arr = stringify_values(array[column])
                    pa_data[i] = pa.array(stringified_arr.tolist())

                elif pa.types.is_temporal(pa_data[i].type):
                    # workaround for bug converting `psycopg2.tz.FixedOffsetTimezone` tzinfo values.
                    # related: https://issues.apache.org/jira/browse/ARROW-5248
                    sample = self.first_nonempty(array[column])
                    if sample and isinstance(sample, datetime.datetime):
                        try:
                            if sample.tzinfo:
                                tz = sample.tzinfo
                                series = pd.Series(
                                    array[column], dtype="datetime64[ns]"
                                )
                                series = pd.to_datetime(series).dt.tz_localize(tz)
                                pa_data[i] = pa.Array.from_pandas(
                                    series, type=pa.timestamp("ns", tz=tz)
                                )
                        except Exception as e:
                            logging.exception(e)

        self.table = pa.Table.from_arrays(pa_data, names=column_names)
        self._type_dict: Dict[str, Any] = {}
        try:
            # The driver may not be passing a cursor.description
            self._type_dict = {
                col: db_engine_spec.get_datatype(deduped_cursor_desc[i][1])
                for i, col in enumerate(column_names)
                if deduped_cursor_desc
            }
        except Exception as e:
            logging.exception(e)

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
        return table.to_pandas(integer_object_nulls=True)

    @staticmethod
    def first_nonempty(items: List) -> Any:
        return next((i for i in items if i), None)

    @staticmethod
    def is_date(db_type_str: Optional[str]) -> bool:
        return db_type_str in ("DATETIME", "TIMESTAMP")

    def data_type(self, col_name: str, pa_dtype: pa.DataType) -> Optional[str]:
        """Given a pyarrow data type, Returns a generic database type"""
        set_type = self._type_dict.get(col_name)
        if set_type:
            return set_type

        mapped_type = self.convert_pa_dtype(pa_dtype)
        if mapped_type:
            return mapped_type

        return None

    def to_pandas_df(self) -> pd.DataFrame:
        return self.convert_table_to_df(self.table)

    @property
    def pa_table(self) -> pa.Table:
        return self.table

    @property
    def size(self) -> int:
        return self.table.num_rows

    @property
    def columns(self) -> List[Dict[str, Any]]:
        if not self.table.column_names:
            return []

        columns = []
        for col in self.table.schema:
            db_type_str = self.data_type(col.name, col.type)
            column = {
                "name": col.name,
                "type": db_type_str,
                "is_date": self.is_date(db_type_str),
            }
            columns.append(column)

        return columns
