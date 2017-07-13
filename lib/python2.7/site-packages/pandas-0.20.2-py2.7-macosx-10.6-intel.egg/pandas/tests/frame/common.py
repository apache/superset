import numpy as np

from pandas import compat
from pandas.util._decorators import cache_readonly
import pandas.util.testing as tm
import pandas as pd

_seriesd = tm.getSeriesData()
_tsd = tm.getTimeSeriesData()

_frame = pd.DataFrame(_seriesd)
_frame2 = pd.DataFrame(_seriesd, columns=['D', 'C', 'B', 'A'])
_intframe = pd.DataFrame(dict((k, v.astype(int))
                              for k, v in compat.iteritems(_seriesd)))

_tsframe = pd.DataFrame(_tsd)

_mixed_frame = _frame.copy()
_mixed_frame['foo'] = 'bar'


class TestData(object):

    @cache_readonly
    def frame(self):
        return _frame.copy()

    @cache_readonly
    def frame2(self):
        return _frame2.copy()

    @cache_readonly
    def intframe(self):
        # force these all to int64 to avoid platform testing issues
        return pd.DataFrame(dict([(c, s) for c, s in
                                  compat.iteritems(_intframe)]),
                            dtype=np.int64)

    @cache_readonly
    def tsframe(self):
        return _tsframe.copy()

    @cache_readonly
    def mixed_frame(self):
        return _mixed_frame.copy()

    @cache_readonly
    def mixed_float(self):
        return pd.DataFrame({'A': _frame['A'].copy().astype('float32'),
                             'B': _frame['B'].copy().astype('float32'),
                             'C': _frame['C'].copy().astype('float16'),
                             'D': _frame['D'].copy().astype('float64')})

    @cache_readonly
    def mixed_float2(self):
        return pd.DataFrame({'A': _frame2['A'].copy().astype('float32'),
                             'B': _frame2['B'].copy().astype('float32'),
                             'C': _frame2['C'].copy().astype('float16'),
                             'D': _frame2['D'].copy().astype('float64')})

    @cache_readonly
    def mixed_int(self):
        return pd.DataFrame({'A': _intframe['A'].copy().astype('int32'),
                             'B': np.ones(len(_intframe['B']), dtype='uint64'),
                             'C': _intframe['C'].copy().astype('uint8'),
                             'D': _intframe['D'].copy().astype('int64')})

    @cache_readonly
    def all_mixed(self):
        return pd.DataFrame({'a': 1., 'b': 2, 'c': 'foo',
                             'float32': np.array([1.] * 10, dtype='float32'),
                             'int32': np.array([1] * 10, dtype='int32')},
                            index=np.arange(10))

    @cache_readonly
    def tzframe(self):
        result = pd.DataFrame({'A': pd.date_range('20130101', periods=3),
                               'B': pd.date_range('20130101', periods=3,
                                                  tz='US/Eastern'),
                               'C': pd.date_range('20130101', periods=3,
                                                  tz='CET')})
        result.iloc[1, 1] = pd.NaT
        result.iloc[1, 2] = pd.NaT
        return result

    @cache_readonly
    def empty(self):
        return pd.DataFrame({})

    @cache_readonly
    def ts1(self):
        return tm.makeTimeSeries(nper=30)

    @cache_readonly
    def ts2(self):
        return tm.makeTimeSeries(nper=30)[5:]

    @cache_readonly
    def simple(self):
        arr = np.array([[1., 2., 3.],
                        [4., 5., 6.],
                        [7., 8., 9.]])

        return pd.DataFrame(arr, columns=['one', 'two', 'three'],
                            index=['a', 'b', 'c'])

# self.ts3 = tm.makeTimeSeries()[-5:]
# self.ts4 = tm.makeTimeSeries()[1:-1]


def _check_mixed_float(df, dtype=None):
    # float16 are most likely to be upcasted to float32
    dtypes = dict(A='float32', B='float32', C='float16', D='float64')
    if isinstance(dtype, compat.string_types):
        dtypes = dict([(k, dtype) for k, v in dtypes.items()])
    elif isinstance(dtype, dict):
        dtypes.update(dtype)
    if dtypes.get('A'):
        assert(df.dtypes['A'] == dtypes['A'])
    if dtypes.get('B'):
        assert(df.dtypes['B'] == dtypes['B'])
    if dtypes.get('C'):
        assert(df.dtypes['C'] == dtypes['C'])
    if dtypes.get('D'):
        assert(df.dtypes['D'] == dtypes['D'])


def _check_mixed_int(df, dtype=None):
    dtypes = dict(A='int32', B='uint64', C='uint8', D='int64')
    if isinstance(dtype, compat.string_types):
        dtypes = dict([(k, dtype) for k, v in dtypes.items()])
    elif isinstance(dtype, dict):
        dtypes.update(dtype)
    if dtypes.get('A'):
        assert(df.dtypes['A'] == dtypes['A'])
    if dtypes.get('B'):
        assert(df.dtypes['B'] == dtypes['B'])
    if dtypes.get('C'):
        assert(df.dtypes['C'] == dtypes['C'])
    if dtypes.get('D'):
        assert(df.dtypes['D'] == dtypes['D'])
