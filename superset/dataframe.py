""" Superset wrapper around pandas.DataFrame.

TODO(bkyryliuk): add support for the conventions like: *_dim or dim_*
                 dimensions, *_ts, ts_*, ds_*, *_ds - datetime, etc.
TODO(bkyryliuk): recognize integer encoded enums.

"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime, date
from past.builtins import basestring

import pandas as pd
import numpy as np


INFER_COL_TYPES_THRESHOLD = 95
INFER_COL_TYPES_SAMPLE_SIZE = 100


class SupersetDataFrame(object):
    # Mapping numpy dtype.char to generic database types
    type_map = {
        'b': 'BOOL',  # boolean
        'i': 'INT',  # (signed) integer
        'u': 'INT',  # unsigned integer
        'l': 'INT',  # 64bit integer
        'f': 'FLOAT',  # floating-point
        'c': 'FLOAT',  # complex-floating point
        'm': None,  # timedelta
        'M': 'DATETIME',  # datetime
        'O': 'OBJECT',  # (Python) objects
        'S': 'BYTE',  # (byte-)string
        'U': 'STRING',  # Unicode
        'V': None,   # raw data (void)
    }

    def __init__(self, df):
        self.__df = df.where((pd.notnull(df)), None)

    @property
    def size(self):
        return len(self.__df.index)

    @property
    def data(self):
        return self.__df.to_dict(orient='records')

    @classmethod
    def db_type(cls, dtype):
        """Given a numpy dtype, Returns a generic database type"""
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

    @classmethod
    def is_date(cls, dtype):
        if dtype.name:
            return dtype.name.startswith('datetime')

    @classmethod
    def is_dimension(cls, dtype, column_name):
        if cls.is_id(column_name):
            return False
        return dtype.name in ('object', 'bool')

    @classmethod
    def is_id(cls, column_name):
        return column_name.startswith('id') or column_name.endswith('id')

    @classmethod
    def agg_func(cls, dtype, column_name):
        # consider checking for key substring too.
        if cls.is_id(column_name):
            return 'count_distinct'
        if np.issubdtype(dtype, np.number):
            return 'sum'

    @property
    def columns(self):
        """Provides metadata about columns for data visualization.

        :return: dict, with the fields name, type, is_date, is_dim and agg.
        """
        if self.__df.empty:
            return None

        columns = []
        sample_size = min(INFER_COL_TYPES_SAMPLE_SIZE, len(self.__df.index))
        sample = self.__df
        if sample_size:
            sample = self.__df.sample(sample_size)
        for col in self.__df.dtypes.keys():
            col_db_type = self.db_type(self.__df.dtypes[col])
            column = {
                'name': col,
                'agg': self.agg_func(self.__df.dtypes[col], col),
                'type': col_db_type,
                'is_date': self.is_date(self.__df.dtypes[col]),
                'is_dim': self.is_dimension(self.__df.dtypes[col], col),
            }

            if column['type'] in ('OBJECT', None):
                v = sample[col].iloc[0] if not sample[col].empty else None
                if isinstance(v, basestring):
                    column['type'] = 'STRING'
                elif isinstance(v, int):
                    column['type'] = 'INT'
                elif isinstance(v, float):
                    column['type'] = 'FLOAT'
                elif isinstance(v, (datetime, date)):
                    column['type'] = 'DATETIME'
                    column['is_date'] = True
                    column['is_dim'] = False
                # check if encoded datetime
                if (
                        column['type'] == 'STRING' and
                        self.datetime_conversion_rate(sample[col]) >
                        INFER_COL_TYPES_THRESHOLD):
                    column.update({
                        'is_date': True,
                        'is_dim': False,
                        'agg': None
                    })
            # 'agg' is optional attribute
            if not column['agg']:
                column.pop('agg', None)
            columns.append(column)
        return columns
