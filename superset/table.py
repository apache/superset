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
        # TODO: port metadata from SupersetDataFrame implementation
        if not self.table.columns:
            return None

        columns = []
        for col in self.table.column_names:
            # db_type_str = self._type_dict.get(col) # or self.db_type(self.df.dtypes[col])
            column = {
                "name": col,
                # "agg": self.agg_func(self.df.dtypes[col], col),
                "type": None,
                "is_date": False, #self.is_date(self.df.dtypes[col], db_type_str),
                "is_dim": False, #self.is_dimension(self.df.dtypes[col], col),
            }

            columns.append(column)

        return columns
