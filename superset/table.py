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
import logging
import re
from datetime import date, datetime

import numpy as np
import pyarrow as pa


def dedup(l, suffix="__", case_sensitive=True):
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
    new_l = []
    seen = {}
    for s in l:
        s_fixed_case = s if case_sensitive else s.lower()
        if s_fixed_case in seen:
            seen[s_fixed_case] += 1
            s += suffix + str(seen[s_fixed_case])
        else:
            seen[s_fixed_case] = 0
        new_l.append(s)
    return new_l


class SupersetTable(object):
    # Mapping pyarrow datatypes to generic database types:
    # https://arrow.apache.org/docs/python/api/datatypes.html
    # `timestamp` is handled explictly due to variable timezone formatting.
    type_map = {
        "null": "NULL",
        "bool_": "BOOL",
        "int8": "INT",
        "int16": "INT",
        "int32": "INT",
        "int64": "INT",
        "uint8": "INT",
        "uint16": "INT",
        "uint32": "INT",
        "uint64": "INT",
        "float16": "FLOAT",
        "float32": "FLOAT",
        "float64": "FLOAT",
        "time32": "DATETIME",
        "time64": "DATETIME",
        # timestamp(unit[, tz])
        "date32": "DATETIME",
        "date64": "DATETIME",
        "binary": "BYTE",
        "string": "STRING",
        "utf8": "STRING",
        "large_binary": "BYTE",
        "large_string": "STRING",
        "large_utf8": "STRING",
        "decimal128": "FLOAT",
    }

    def __init__(self, data, cursor_description, db_engine_spec):
        data = data or []
        column_names = []

        if cursor_description:
            # get deduped list of column names
            column_names = dedup([col[0] for col in cursor_description])

            # fix cursor descriptor with the deduped names
            cursor_description = [
                tuple([column_name, *list(description)[1:]])
                for column_name, description in zip(column_names, cursor_description)
            ]

        # put data in a 2D array so we can efficiently access each column;
        array = np.array(data)

        if array.size > 0:
            data = [
                pa.array(array[:, i])
                for i, column in enumerate(column_names)
            ]
        
        self.table = pa.Table.from_arrays(data, names=column_names)

        self._type_dict = {}
        try:
            # The driver may not be passing a cursor.description
            self._type_dict = {
                col: db_engine_spec.get_datatype(cursor_description[i][1])
                for i, col in enumerate(column_names)
                if cursor_description
            }
        except Exception as e:
            logging.exception(e)

    @classmethod
    def pa_table_to_df(cls, pa_table):
        return pa_table.to_pandas(integer_object_nulls=True)

    @staticmethod
    def is_date(db_type_str):
        return db_type_str == 'DATETIME'

    @staticmethod
    def is_dimension(column_name, db_type_str):
        is_id = column_name.startswith("id") or column_name.endswith("id")
        if is_id:
            return False
        return db_type_str in ("OBJECT", "BOOL")

    @classmethod
    def is_id(cls, column_name):
        return column_name.startswith("id") or column_name.endswith("id")


    def data_type(self, col_name: str, dtype: str):
        """Given a pyarrow data type, Returns a generic database type"""
        set_type = self._type_dict.get(col_name)
        if set_type:
            return set_type

        mapped_type = self.type_map.get(dtype)
        if mapped_type:
            return mapped_type

        if re.search("^timestamp", dtype):
            return "DATETIME"

        return None

    def to_pandas_df(self):
        return self.pa_table_to_df(self.table)

    @property
    def pa_table(self):
        return self.table

    @property
    def type_dict(self):
        return self._type_dict

    @property
    def size(self):
        return self.table.num_rows

    @property
    def columns(self):
        if not self.table.columns:
            return None

        columns = []
        for col in self.table.schema:
            pa_dtype = str(col.type)
            db_type_str = self.data_type(col.name, pa_dtype)
            column = {
                "name": col.name,
                "type": db_type_str,
                "is_date": self.is_date(db_type_str),
                "is_dim": self.is_dimension(col.name, db_type_str),
            }
            columns.append(column)

        return columns
