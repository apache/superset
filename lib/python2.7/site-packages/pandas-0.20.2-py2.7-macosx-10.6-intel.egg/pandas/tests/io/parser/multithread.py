# -*- coding: utf-8 -*-

"""
Tests multithreading behaviour for reading and
parsing files for each parser defined in parsers.py
"""

from __future__ import division
from multiprocessing.pool import ThreadPool

import numpy as np
import pandas as pd
import pandas.util.testing as tm

from pandas import DataFrame
from pandas.compat import BytesIO, range


def _construct_dataframe(num_rows):

    df = DataFrame(np.random.rand(num_rows, 5), columns=list('abcde'))
    df['foo'] = 'foo'
    df['bar'] = 'bar'
    df['baz'] = 'baz'
    df['date'] = pd.date_range('20000101 09:00:00',
                               periods=num_rows,
                               freq='s')
    df['int'] = np.arange(num_rows, dtype='int64')
    return df


class MultithreadTests(object):

    def _generate_multithread_dataframe(self, path, num_rows, num_tasks):

        def reader(arg):
            start, nrows = arg

            if not start:
                return self.read_csv(path, index_col=0, header=0,
                                     nrows=nrows, parse_dates=['date'])

            return self.read_csv(path,
                                 index_col=0,
                                 header=None,
                                 skiprows=int(start) + 1,
                                 nrows=nrows,
                                 parse_dates=[9])

        tasks = [
            (num_rows * i // num_tasks,
             num_rows // num_tasks) for i in range(num_tasks)
        ]

        pool = ThreadPool(processes=num_tasks)

        results = pool.map(reader, tasks)

        header = results[0].columns
        for r in results[1:]:
            r.columns = header

        final_dataframe = pd.concat(results)

        return final_dataframe

    def test_multithread_stringio_read_csv(self):
        # see gh-11786
        max_row_range = 10000
        num_files = 100

        bytes_to_df = [
            '\n'.join(
                ['%d,%d,%d' % (i, i, i) for i in range(max_row_range)]
            ).encode() for j in range(num_files)]
        files = [BytesIO(b) for b in bytes_to_df]

        # read all files in many threads
        pool = ThreadPool(8)
        results = pool.map(self.read_csv, files)
        first_result = results[0]

        for result in results:
            tm.assert_frame_equal(first_result, result)

    def test_multithread_path_multipart_read_csv(self):
        # see gh-11786
        num_tasks = 4
        file_name = '__threadpool_reader__.csv'
        num_rows = 100000

        df = _construct_dataframe(num_rows)

        with tm.ensure_clean(file_name) as path:
            df.to_csv(path)

            final_dataframe = self._generate_multithread_dataframe(
                path, num_rows, num_tasks)
            tm.assert_frame_equal(df, final_dataframe)
