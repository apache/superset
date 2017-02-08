""" Superset wrapper around pandas.DataFrame.

TODO(bkyryliuk): add support for the conventions like: *_dim or dim_*
                 dimensions, *_ts, ts_*, ds_*, *_ds - datetime, etc.
TODO(bkyryliuk): recognize integer encoded enums.

"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import pandas as pd
import numpy as np


INFER_COL_TYPES_THRESHOLD = 95
INFER_COL_TYPES_SAMPLE_SIZE = 100


class SupersetDataFrame(object):
    def __init__(self, df):
        self.__df = df.where((pd.notnull(df)), None)

    @property
    def size(self):
        return len(self.__df.index)

    @property
    def data(self):
        return self.__df.to_dict(orient='records')

    @property
    def columns_dict(self):
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
            column = {
                'name': col,
                'type': self.__df.dtypes[col].name,
                'is_date': is_date(self.__df.dtypes[col]),
                'is_dim': is_dimension(self.__df.dtypes[col], col),
            }
            agg = agg_func(self.__df.dtypes[col], col)
            if agg_func:
                column['agg'] = agg

            if column['type'] == 'object':
                # check if encoded datetime
                if (datetime_conversion_rate(sample[col]) >
                        INFER_COL_TYPES_THRESHOLD):
                    column.update({
                        'type': 'datetime_string',
                        'is_date': True,
                        'is_dim': False,
                        'agg': None
                    })
            # 'agg' is optional attribute
            if not column['agg']:
                column.pop('agg', None)
            columns.append(column)

        return columns


# It will give false positives on the numbers that are stored as strings.
# It is hard to distinguish integer numbers and timestamps
def datetime_conversion_rate(data_series):
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


def is_date(dtype):
    if dtype.name:
        return dtype.name.startswith('datetime')


def is_dimension(dtype, column_name):
    if is_id(column_name):
        return False
    return dtype.name in ('object', 'bool')


def is_id(column_name):
    return column_name.startswith('id') or column_name.endswith('id')


def agg_func(dtype, column_name):
    # consider checking for key substring too.
    if is_id(column_name):
        return 'count_distinct'
    if np.issubdtype(dtype, np.number):
        return 'sum'
    return None
