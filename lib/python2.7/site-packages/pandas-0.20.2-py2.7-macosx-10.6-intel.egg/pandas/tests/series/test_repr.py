# coding=utf-8
# pylint: disable-msg=E1101,W0612

from datetime import datetime, timedelta

import sys

import numpy as np
import pandas as pd

from pandas import (Index, Series, DataFrame, date_range, option_context)
from pandas.core.index import MultiIndex

from pandas.compat import lrange, range, u
from pandas import compat
import pandas.util.testing as tm

from .common import TestData


class TestSeriesRepr(TestData):

    def test_multilevel_name_print(self):
        index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                                  'three']],
                           labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                                   [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                           names=['first', 'second'])
        s = Series(lrange(0, len(index)), index=index, name='sth')
        expected = ["first  second", "foo    one       0",
                    "       two       1", "       three     2",
                    "bar    one       3", "       two       4",
                    "baz    two       5", "       three     6",
                    "qux    one       7", "       two       8",
                    "       three     9", "Name: sth, dtype: int64"]
        expected = "\n".join(expected)
        assert repr(s) == expected

    def test_name_printing(self):
        # Test small Series.
        s = Series([0, 1, 2])

        s.name = "test"
        assert "Name: test" in repr(s)

        s.name = None
        assert "Name:" not in repr(s)

        # Test big Series (diff code path).
        s = Series(lrange(0, 1000))

        s.name = "test"
        assert "Name: test" in repr(s)

        s.name = None
        assert "Name:" not in repr(s)

        s = Series(index=date_range('20010101', '20020101'), name='test')
        assert "Name: test" in repr(s)

    def test_repr(self):
        str(self.ts)
        str(self.series)
        str(self.series.astype(int))
        str(self.objSeries)

        str(Series(tm.randn(1000), index=np.arange(1000)))
        str(Series(tm.randn(1000), index=np.arange(1000, 0, step=-1)))

        # empty
        str(self.empty)

        # with NaNs
        self.series[5:7] = np.NaN
        str(self.series)

        # with Nones
        ots = self.ts.astype('O')
        ots[::2] = None
        repr(ots)

        # various names
        for name in ['', 1, 1.2, 'foo', u('\u03B1\u03B2\u03B3'),
                     'loooooooooooooooooooooooooooooooooooooooooooooooooooong',
                     ('foo', 'bar', 'baz'), (1, 2), ('foo', 1, 2.3),
                     (u('\u03B1'), u('\u03B2'), u('\u03B3')),
                     (u('\u03B1'), 'bar')]:
            self.series.name = name
            repr(self.series)

        biggie = Series(tm.randn(1000), index=np.arange(1000),
                        name=('foo', 'bar', 'baz'))
        repr(biggie)

        # 0 as name
        ser = Series(np.random.randn(100), name=0)
        rep_str = repr(ser)
        assert "Name: 0" in rep_str

        # tidy repr
        ser = Series(np.random.randn(1001), name=0)
        rep_str = repr(ser)
        assert "Name: 0" in rep_str

        ser = Series(["a\n\r\tb"], name="a\n\r\td", index=["a\n\r\tf"])
        assert "\t" not in repr(ser)
        assert "\r" not in repr(ser)
        assert "a\n" not in repr(ser)

        # with empty series (#4651)
        s = Series([], dtype=np.int64, name='foo')
        assert repr(s) == 'Series([], Name: foo, dtype: int64)'

        s = Series([], dtype=np.int64, name=None)
        assert repr(s) == 'Series([], dtype: int64)'

    def test_tidy_repr(self):
        a = Series([u("\u05d0")] * 1000)
        a.name = 'title1'
        repr(a)  # should not raise exception

    @tm.capture_stderr
    def test_repr_bool_fails(self):
        s = Series([DataFrame(np.random.randn(2, 2)) for i in range(5)])

        # It works (with no Cython exception barf)!
        repr(s)

        output = sys.stderr.getvalue()
        assert output == ''

    def test_repr_name_iterable_indexable(self):
        s = Series([1, 2, 3], name=np.int64(3))

        # it works!
        repr(s)

        s.name = (u("\u05d0"), ) * 2
        repr(s)

    def test_repr_should_return_str(self):
        # http://docs.python.org/py3k/reference/datamodel.html#object.__repr__
        # http://docs.python.org/reference/datamodel.html#object.__repr__
        # ...The return value must be a string object.

        # (str on py2.x, str (unicode) on py3)

        data = [8, 5, 3, 5]
        index1 = [u("\u03c3"), u("\u03c4"), u("\u03c5"), u("\u03c6")]
        df = Series(data, index=index1)
        assert type(df.__repr__() == str)  # both py2 / 3

    def test_repr_max_rows(self):
        # GH 6863
        with pd.option_context('max_rows', None):
            str(Series(range(1001)))  # should not raise exception

    def test_unicode_string_with_unicode(self):
        df = Series([u("\u05d0")], name=u("\u05d1"))
        if compat.PY3:
            str(df)
        else:
            compat.text_type(df)

    def test_bytestring_with_unicode(self):
        df = Series([u("\u05d0")], name=u("\u05d1"))
        if compat.PY3:
            bytes(df)
        else:
            str(df)

    def test_timeseries_repr_object_dtype(self):
        index = Index([datetime(2000, 1, 1) + timedelta(i)
                       for i in range(1000)], dtype=object)
        ts = Series(np.random.randn(len(index)), index)
        repr(ts)

        ts = tm.makeTimeSeries(1000)
        assert repr(ts).splitlines()[-1].startswith('Freq:')

        ts2 = ts.iloc[np.random.randint(0, len(ts) - 1, 400)]
        repr(ts2).splitlines()[-1]

    def test_latex_repr(self):
        result = r"""\begin{tabular}{ll}
\toprule
{} &         0 \\
\midrule
0 &  $\alpha$ \\
1 &         b \\
2 &         c \\
\bottomrule
\end{tabular}
"""
        with option_context('display.latex.escape', False,
                            'display.latex.repr', True):
            s = Series([r'$\alpha$', 'b', 'c'])
            assert result == s._repr_latex_()

        assert s._repr_latex_() is None
