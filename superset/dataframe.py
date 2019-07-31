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
""" Superset wrapper around pandas.DataFrame.

TODO(bkyryliuk): add support for the conventions like: *_dim or dim_*
                 dimensions, *_ts, ts_*, ds_*, *_ds - datetime, etc.
TODO(bkyryliuk): recognize integer encoded enums.

"""
from datetime import date, datetime
import logging

import numpy as np
import pandas as pd
from pandas.core.common import maybe_box_datetimelike
from pandas.core.dtypes.dtypes import ExtensionDtype

from superset.utils.core import JS_MAX_INTEGER

INFER_COL_TYPES_THRESHOLD = 95
INFER_COL_TYPES_SAMPLE_SIZE = 100


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


class SupersetDataFrame(object):
    # Mapping numpy dtype.char to generic database types
    type_map = {
        "b": "BOOL",  # boolean
        "i": "INT",  # (signed) integer
        "u": "INT",  # unsigned integer
        "l": "INT",  # 64bit integer
        "f": "FLOAT",  # floating-point
        "c": "FLOAT",  # complex-floating point
        "m": None,  # timedelta
        "M": "DATETIME",  # datetime
        "O": "OBJECT",  # (Python) objects
        "S": "BYTE",  # (byte-)string
        "U": "STRING",  # Unicode
        "V": None,  # raw data (void)
    }

    def __init__(self, data, cursor_description, db_engine_spec):
        column_names = []
        if cursor_description:
            column_names = [col[0] for col in cursor_description]

        self.column_names = dedup(column_names)

        data = data or []
        self.df = pd.DataFrame(list(data), columns=self.column_names).infer_objects()

        self._type_dict = {}
        try:
            # The driver may not be passing a cursor.description
            self._type_dict = {
                col: db_engine_spec.get_datatype(cursor_description[i][1])
                for i, col in enumerate(self.column_names)
                if cursor_description
            }
        except Exception as e:
            logging.exception(e)

    @property
    def size(self):
        return len(self.df.index)

    @property
    def data(self):
        # work around for https://github.com/pandas-dev/pandas/issues/18372
        data = [
            dict(
                (k, maybe_box_datetimelike(v))
                for k, v in zip(self.df.columns, np.atleast_1d(row))
            )
            for row in self.df.values
        ]
        for d in data:
            for k, v in list(d.items()):
                # if an int is too big for Java Script to handle
                # convert it to a string
                if isinstance(v, int):
                    if abs(v) > JS_MAX_INTEGER:
                        d[k] = str(v)
        return data

    @classmethod
    def db_type(cls, dtype):
        """Given a numpy dtype, Returns a generic database type"""
        if isinstance(dtype, ExtensionDtype):
            return cls.type_map.get(dtype.kind)
        elif hasattr(dtype, "char"):
            return cls.type_map.get(dtype.char)

    @classmethod
    def datetime_conversion_rate(cls, data_series):
        success = 0
        total = 0
        for value in data_series:
            total += 1
            try:
                pd.to_datetime(value)
                success += 1
            except Exception:
                continue
        return 100 * success / total

    @staticmethod
    def is_date(np_dtype, db_type_str):
        def looks_daty(s):
            if isinstance(s, str):
                return any([s.lower().startswith(ss) for ss in ("time", "date")])
            return False

        if looks_daty(db_type_str):
            return True
        if np_dtype and np_dtype.name and looks_daty(np_dtype.name):
            return True
        return False

    @classmethod
    def is_dimension(cls, dtype, column_name):
        if cls.is_id(column_name):
            return False
        return dtype.name in ("object", "bool")

    @classmethod
    def is_id(cls, column_name):
        return column_name.startswith("id") or column_name.endswith("id")

    @classmethod
    def agg_func(cls, dtype, column_name):
        # consider checking for key substring too.
        if cls.is_id(column_name):
            return "count_distinct"
        if (
            hasattr(dtype, "type")
            and issubclass(dtype.type, np.generic)
            and np.issubdtype(dtype, np.number)
        ):
            return "sum"
        return None

    @property
    def columns(self):
        """Provides metadata about columns for data visualization.

        :return: dict, with the fields name, type, is_date, is_dim and agg.
        """
        if self.df.empty:
            return None

        columns = []
        sample_size = min(INFER_COL_TYPES_SAMPLE_SIZE, len(self.df.index))
        sample = self.df
        if sample_size:
            sample = self.df.sample(sample_size)
        for col in self.df.dtypes.keys():
            db_type_str = self._type_dict.get(col) or self.db_type(self.df.dtypes[col])
            column = {
                "name": col,
                "agg": self.agg_func(self.df.dtypes[col], col),
                "type": db_type_str,
                "is_date": self.is_date(self.df.dtypes[col], db_type_str),
                "is_dim": self.is_dimension(self.df.dtypes[col], col),
            }

            if not db_type_str or db_type_str.upper() == "OBJECT":
                v = sample[col].iloc[0] if not sample[col].empty else None
                if isinstance(v, str):
                    column["type"] = "STRING"
                elif isinstance(v, int):
                    column["type"] = "INT"
                elif isinstance(v, float):
                    column["type"] = "FLOAT"
                elif isinstance(v, (datetime, date)):
                    column["type"] = "DATETIME"
                    column["is_date"] = True
                    column["is_dim"] = False
                # check if encoded datetime
                if (
                    column["type"] == "STRING"
                    and self.datetime_conversion_rate(sample[col])
                    > INFER_COL_TYPES_THRESHOLD
                ):
                    column.update({"is_date": True, "is_dim": False, "agg": None})
            # 'agg' is optional attribute
            if not column["agg"]:
                column.pop("agg", None)
            columns.append(column)
        return columns
