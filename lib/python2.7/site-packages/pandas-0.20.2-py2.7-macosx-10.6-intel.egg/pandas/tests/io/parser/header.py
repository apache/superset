# -*- coding: utf-8 -*-

"""
Tests that the file header is properly handled or inferred
during parsing for all of the parsers defined in parsers.py
"""

import pytest

import numpy as np
import pandas.util.testing as tm

from pandas import DataFrame, Index, MultiIndex
from pandas.compat import StringIO, lrange, u


class HeaderTests(object):

    def test_read_with_bad_header(self):
        errmsg = r"but only \d+ lines in file"

        with tm.assert_raises_regex(ValueError, errmsg):
            s = StringIO(',,')
            self.read_csv(s, header=[10])

    def test_bool_header_arg(self):
        # see gh-6114
        data = """\
MyColumn
   a
   b
   a
   b"""
        for arg in [True, False]:
            with pytest.raises(TypeError):
                self.read_csv(StringIO(data), header=arg)
            with pytest.raises(TypeError):
                self.read_table(StringIO(data), header=arg)

    def test_no_header_prefix(self):
        data = """1,2,3,4,5
6,7,8,9,10
11,12,13,14,15
"""
        df_pref = self.read_table(StringIO(data), sep=',', prefix='Field',
                                  header=None)

        expected = np.array([[1, 2, 3, 4, 5],
                             [6, 7, 8, 9, 10],
                             [11, 12, 13, 14, 15]], dtype=np.int64)
        tm.assert_almost_equal(df_pref.values, expected)

        tm.assert_index_equal(df_pref.columns,
                              Index(['Field0', 'Field1', 'Field2',
                                     'Field3', 'Field4']))

    def test_header_with_index_col(self):
        data = """foo,1,2,3
bar,4,5,6
baz,7,8,9
"""
        names = ['A', 'B', 'C']
        df = self.read_csv(StringIO(data), names=names)

        assert list(df.columns) == ['A', 'B', 'C']

        values = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
        expected = DataFrame(values, index=['foo', 'bar', 'baz'],
                             columns=['A', 'B', 'C'])
        tm.assert_frame_equal(df, expected)

    def test_header_not_first_line(self):
        data = """got,to,ignore,this,line
got,to,ignore,this,line
index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
"""
        data2 = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
"""

        df = self.read_csv(StringIO(data), header=2, index_col=0)
        expected = self.read_csv(StringIO(data2), header=0, index_col=0)
        tm.assert_frame_equal(df, expected)

    def test_header_multi_index(self):
        expected = tm.makeCustomDataframe(
            5, 3, r_idx_nlevels=2, c_idx_nlevels=4)

        data = """\
C0,,C_l0_g0,C_l0_g1,C_l0_g2

C1,,C_l1_g0,C_l1_g1,C_l1_g2
C2,,C_l2_g0,C_l2_g1,C_l2_g2
C3,,C_l3_g0,C_l3_g1,C_l3_g2
R0,R1,,,
R_l0_g0,R_l1_g0,R0C0,R0C1,R0C2
R_l0_g1,R_l1_g1,R1C0,R1C1,R1C2
R_l0_g2,R_l1_g2,R2C0,R2C1,R2C2
R_l0_g3,R_l1_g3,R3C0,R3C1,R3C2
R_l0_g4,R_l1_g4,R4C0,R4C1,R4C2
"""

        df = self.read_csv(StringIO(data), header=[0, 1, 2, 3], index_col=[
            0, 1], tupleize_cols=False)
        tm.assert_frame_equal(df, expected)

        # skipping lines in the header
        df = self.read_csv(StringIO(data), header=[0, 1, 2, 3], index_col=[
            0, 1], tupleize_cols=False)
        tm.assert_frame_equal(df, expected)

        # INVALID OPTIONS

        # no as_recarray
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            pytest.raises(ValueError, self.read_csv,
                          StringIO(data), header=[0, 1, 2, 3],
                          index_col=[0, 1], as_recarray=True,
                          tupleize_cols=False)

        # names
        pytest.raises(ValueError, self.read_csv,
                      StringIO(data), header=[0, 1, 2, 3],
                      index_col=[0, 1], names=['foo', 'bar'],
                      tupleize_cols=False)

        # usecols
        pytest.raises(ValueError, self.read_csv,
                      StringIO(data), header=[0, 1, 2, 3],
                      index_col=[0, 1], usecols=['foo', 'bar'],
                      tupleize_cols=False)

        # non-numeric index_col
        pytest.raises(ValueError, self.read_csv,
                      StringIO(data), header=[0, 1, 2, 3],
                      index_col=['foo', 'bar'], tupleize_cols=False)

    def test_header_multiindex_common_format(self):

        df = DataFrame([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
                       index=['one', 'two'],
                       columns=MultiIndex.from_tuples(
                           [('a', 'q'), ('a', 'r'), ('a', 's'),
                            ('b', 't'), ('c', 'u'), ('c', 'v')]))

        # to_csv
        data = """,a,a,a,b,c,c
,q,r,s,t,u,v
,,,,,,
one,1,2,3,4,5,6
two,7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=0)
        tm.assert_frame_equal(df, result)

        # common
        data = """,a,a,a,b,c,c
,q,r,s,t,u,v
one,1,2,3,4,5,6
two,7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=0)
        tm.assert_frame_equal(df, result)

        # common, no index_col
        data = """a,a,a,b,c,c
q,r,s,t,u,v
1,2,3,4,5,6
7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=None)
        tm.assert_frame_equal(df.reset_index(drop=True), result)

        # malformed case 1
        expected = DataFrame(np.array(
            [[2, 3, 4, 5, 6], [8, 9, 10, 11, 12]], dtype='int64'),
            index=Index([1, 7]),
            columns=MultiIndex(levels=[[u('a'), u('b'), u('c')],
                                       [u('r'), u('s'), u('t'),
                                        u('u'), u('v')]],
                               labels=[[0, 0, 1, 2, 2], [0, 1, 2, 3, 4]],
                               names=[u('a'), u('q')]))

        data = """a,a,a,b,c,c
q,r,s,t,u,v
1,2,3,4,5,6
7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=0)
        tm.assert_frame_equal(expected, result)

        # malformed case 2
        expected = DataFrame(np.array(
            [[2, 3, 4, 5, 6], [8, 9, 10, 11, 12]], dtype='int64'),
            index=Index([1, 7]),
            columns=MultiIndex(levels=[[u('a'), u('b'), u('c')],
                                       [u('r'), u('s'), u('t'),
                                        u('u'), u('v')]],
                               labels=[[0, 0, 1, 2, 2], [0, 1, 2, 3, 4]],
                               names=[None, u('q')]))

        data = """,a,a,b,c,c
q,r,s,t,u,v
1,2,3,4,5,6
7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=0)
        tm.assert_frame_equal(expected, result)

        # mi on columns and index (malformed)
        expected = DataFrame(np.array(
            [[3, 4, 5, 6], [9, 10, 11, 12]], dtype='int64'),
            index=MultiIndex(levels=[[1, 7], [2, 8]],
                             labels=[[0, 1], [0, 1]]),
            columns=MultiIndex(levels=[[u('a'), u('b'), u('c')],
                                       [u('s'), u('t'), u('u'), u('v')]],
                               labels=[[0, 1, 2, 2], [0, 1, 2, 3]],
                               names=[None, u('q')]))

        data = """,a,a,b,c,c
q,r,s,t,u,v
1,2,3,4,5,6
7,8,9,10,11,12"""

        result = self.read_csv(StringIO(data), header=[0, 1], index_col=[0, 1])
        tm.assert_frame_equal(expected, result)

    def test_header_names_backward_compat(self):
        # #2539
        data = '1,2,3\n4,5,6'

        result = self.read_csv(StringIO(data), names=['a', 'b', 'c'])
        expected = self.read_csv(StringIO(data), names=['a', 'b', 'c'],
                                 header=None)
        tm.assert_frame_equal(result, expected)

        data2 = 'foo,bar,baz\n' + data
        result = self.read_csv(StringIO(data2), names=['a', 'b', 'c'],
                               header=0)
        tm.assert_frame_equal(result, expected)

    def test_read_only_header_no_rows(self):
        # See gh-7773
        expected = DataFrame(columns=['a', 'b', 'c'])

        df = self.read_csv(StringIO('a,b,c'))
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO('a,b,c'), index_col=False)
        tm.assert_frame_equal(df, expected)

    def test_no_header(self):
        data = """1,2,3,4,5
6,7,8,9,10
11,12,13,14,15
"""
        df = self.read_table(StringIO(data), sep=',', header=None)
        df_pref = self.read_table(StringIO(data), sep=',', prefix='X',
                                  header=None)

        names = ['foo', 'bar', 'baz', 'quux', 'panda']
        df2 = self.read_table(StringIO(data), sep=',', names=names)
        expected = np.array([[1, 2, 3, 4, 5],
                             [6, 7, 8, 9, 10],
                             [11, 12, 13, 14, 15]], dtype=np.int64)
        tm.assert_almost_equal(df.values, expected)
        tm.assert_almost_equal(df.values, df2.values)

        tm.assert_index_equal(df_pref.columns,
                              Index(['X0', 'X1', 'X2', 'X3', 'X4']))
        tm.assert_index_equal(df.columns, Index(lrange(5)))

        tm.assert_index_equal(df2.columns, Index(names))
