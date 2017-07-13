from datetime import datetime

import pytest

import pandas as pd
from pandas import DataFrame, compat, Series
from pandas.util import testing as tm
from pandas.compat import u
import codecs


@pytest.fixture
def frame():
    return DataFrame(tm.getSeriesData())


class TestToLatex(object):

    def test_to_latex_filename(self, frame):
        with tm.ensure_clean('test.tex') as path:
            frame.to_latex(path)

            with open(path, 'r') as f:
                assert frame.to_latex() == f.read()

        # test with utf-8 and encoding option (GH 7061)
        df = DataFrame([[u'au\xdfgangen']])
        with tm.ensure_clean('test.tex') as path:
            df.to_latex(path, encoding='utf-8')
            with codecs.open(path, 'r', encoding='utf-8') as f:
                assert df.to_latex() == f.read()

        # test with utf-8 without encoding option
        if compat.PY3:  # python3: pandas default encoding is utf-8
            with tm.ensure_clean('test.tex') as path:
                df.to_latex(path)
                with codecs.open(path, 'r', encoding='utf-8') as f:
                    assert df.to_latex() == f.read()
        else:
            # python2 default encoding is ascii, so an error should be raised
            with tm.ensure_clean('test.tex') as path:
                with pytest.raises(UnicodeEncodeError):
                    df.to_latex(path)

    def test_to_latex(self, frame):
        # it works!
        frame.to_latex()

        df = DataFrame({'a': [1, 2], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex()
        withindex_expected = r"""\begin{tabular}{lrl}
\toprule
{} &  a &   b \\
\midrule
0 &  1 &  b1 \\
1 &  2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withindex_result == withindex_expected

        withoutindex_result = df.to_latex(index=False)
        withoutindex_expected = r"""\begin{tabular}{rl}
\toprule
 a &   b \\
\midrule
 1 &  b1 \\
 2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withoutindex_result == withoutindex_expected

    def test_to_latex_format(self, frame):
        # GH Bug #9402
        frame.to_latex(column_format='ccc')

        df = DataFrame({'a': [1, 2], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex(column_format='ccc')
        withindex_expected = r"""\begin{tabular}{ccc}
\toprule
{} &  a &   b \\
\midrule
0 &  1 &  b1 \\
1 &  2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withindex_result == withindex_expected

    def test_to_latex_with_formatters(self):
        df = DataFrame({'int': [1, 2, 3],
                        'float': [1.0, 2.0, 3.0],
                        'object': [(1, 2), True, False],
                        'datetime64': [datetime(2016, 1, 1),
                                       datetime(2016, 2, 5),
                                       datetime(2016, 3, 3)]})

        formatters = {'int': lambda x: '0x%x' % x,
                      'float': lambda x: '[% 4.1f]' % x,
                      'object': lambda x: '-%s-' % str(x),
                      'datetime64': lambda x: x.strftime('%Y-%m'),
                      '__index__': lambda x: 'index: %s' % x}
        result = df.to_latex(formatters=dict(formatters))

        expected = r"""\begin{tabular}{llrrl}
\toprule
{} & datetime64 &  float & int &    object \\
\midrule
index: 0 &    2016-01 & [ 1.0] & 0x1 &  -(1, 2)- \\
index: 1 &    2016-02 & [ 2.0] & 0x2 &    -True- \\
index: 2 &    2016-03 & [ 3.0] & 0x3 &   -False- \\
\bottomrule
\end{tabular}
"""
        assert result == expected

    def test_to_latex_multiindex(self):
        df = DataFrame({('x', 'y'): ['a']})
        result = df.to_latex()
        expected = r"""\begin{tabular}{ll}
\toprule
{} &  x \\
{} &  y \\
\midrule
0 &  a \\
\bottomrule
\end{tabular}
"""

        assert result == expected

        result = df.T.to_latex()
        expected = r"""\begin{tabular}{lll}
\toprule
  &   &  0 \\
\midrule
x & y &  a \\
\bottomrule
\end{tabular}
"""

        assert result == expected

        df = DataFrame.from_dict({
            ('c1', 0): pd.Series(dict((x, x) for x in range(4))),
            ('c1', 1): pd.Series(dict((x, x + 4) for x in range(4))),
            ('c2', 0): pd.Series(dict((x, x) for x in range(4))),
            ('c2', 1): pd.Series(dict((x, x + 4) for x in range(4))),
            ('c3', 0): pd.Series(dict((x, x) for x in range(4))),
        }).T
        result = df.to_latex()
        expected = r"""\begin{tabular}{llrrrr}
\toprule
   &   &  0 &  1 &  2 &  3 \\
\midrule
c1 & 0 &  0 &  1 &  2 &  3 \\
   & 1 &  4 &  5 &  6 &  7 \\
c2 & 0 &  0 &  1 &  2 &  3 \\
   & 1 &  4 &  5 &  6 &  7 \\
c3 & 0 &  0 &  1 &  2 &  3 \\
\bottomrule
\end{tabular}
"""

        assert result == expected

        # GH 14184
        df = df.T
        df.columns.names = ['a', 'b']
        result = df.to_latex()
        expected = r"""\begin{tabular}{lrrrrr}
\toprule
a & \multicolumn{2}{l}{c1} & \multicolumn{2}{l}{c2} & c3 \\
b &  0 &  1 &  0 &  1 &  0 \\
\midrule
0 &  0 &  4 &  0 &  4 &  0 \\
1 &  1 &  5 &  1 &  5 &  1 \\
2 &  2 &  6 &  2 &  6 &  2 \\
3 &  3 &  7 &  3 &  7 &  3 \\
\bottomrule
\end{tabular}
"""
        assert result == expected

        # GH 10660
        df = pd.DataFrame({'a': [0, 0, 1, 1],
                           'b': list('abab'),
                           'c': [1, 2, 3, 4]})
        result = df.set_index(['a', 'b']).to_latex()
        expected = r"""\begin{tabular}{llr}
\toprule
  &   &  c \\
a & b &    \\
\midrule
0 & a &  1 \\
  & b &  2 \\
1 & a &  3 \\
  & b &  4 \\
\bottomrule
\end{tabular}
"""

        assert result == expected

        result = df.groupby('a').describe().to_latex()
        expected = r"""\begin{tabular}{lrrrrrrrr}
\toprule
{} & \multicolumn{8}{l}{c} \\
{} & count & mean &       std &  min &   25\% &  50\% &   75\% &  max \\
a &       &      &           &      &       &      &       &      \\
\midrule
0 &   2.0 &  1.5 &  0.707107 &  1.0 &  1.25 &  1.5 &  1.75 &  2.0 \\
1 &   2.0 &  3.5 &  0.707107 &  3.0 &  3.25 &  3.5 &  3.75 &  4.0 \\
\bottomrule
\end{tabular}
"""

        assert result == expected

    def test_to_latex_multicolumnrow(self):
        df = pd.DataFrame({
            ('c1', 0): dict((x, x) for x in range(5)),
            ('c1', 1): dict((x, x + 5) for x in range(5)),
            ('c2', 0): dict((x, x) for x in range(5)),
            ('c2', 1): dict((x, x + 5) for x in range(5)),
            ('c3', 0): dict((x, x) for x in range(5))
        })
        result = df.to_latex()
        expected = r"""\begin{tabular}{lrrrrr}
\toprule
{} & \multicolumn{2}{l}{c1} & \multicolumn{2}{l}{c2} & c3 \\
{} &  0 &  1 &  0 &  1 &  0 \\
\midrule
0 &  0 &  5 &  0 &  5 &  0 \\
1 &  1 &  6 &  1 &  6 &  1 \\
2 &  2 &  7 &  2 &  7 &  2 \\
3 &  3 &  8 &  3 &  8 &  3 \\
4 &  4 &  9 &  4 &  9 &  4 \\
\bottomrule
\end{tabular}
"""
        assert result == expected

        result = df.to_latex(multicolumn=False)
        expected = r"""\begin{tabular}{lrrrrr}
\toprule
{} & c1 &    & c2 &    & c3 \\
{} &  0 &  1 &  0 &  1 &  0 \\
\midrule
0 &  0 &  5 &  0 &  5 &  0 \\
1 &  1 &  6 &  1 &  6 &  1 \\
2 &  2 &  7 &  2 &  7 &  2 \\
3 &  3 &  8 &  3 &  8 &  3 \\
4 &  4 &  9 &  4 &  9 &  4 \\
\bottomrule
\end{tabular}
"""
        assert result == expected

        result = df.T.to_latex(multirow=True)
        expected = r"""\begin{tabular}{llrrrrr}
\toprule
   &   &  0 &  1 &  2 &  3 &  4 \\
\midrule
\multirow{2}{*}{c1} & 0 &  0 &  1 &  2 &  3 &  4 \\
   & 1 &  5 &  6 &  7 &  8 &  9 \\
\cline{1-7}
\multirow{2}{*}{c2} & 0 &  0 &  1 &  2 &  3 &  4 \\
   & 1 &  5 &  6 &  7 &  8 &  9 \\
\cline{1-7}
c3 & 0 &  0 &  1 &  2 &  3 &  4 \\
\bottomrule
\end{tabular}
"""
        assert result == expected

        df.index = df.T.index
        result = df.T.to_latex(multirow=True, multicolumn=True,
                               multicolumn_format='c')
        expected = r"""\begin{tabular}{llrrrrr}
\toprule
   &   & \multicolumn{2}{c}{c1} & \multicolumn{2}{c}{c2} & c3 \\
   &   &  0 &  1 &  0 &  1 &  0 \\
\midrule
\multirow{2}{*}{c1} & 0 &  0 &  1 &  2 &  3 &  4 \\
   & 1 &  5 &  6 &  7 &  8 &  9 \\
\cline{1-7}
\multirow{2}{*}{c2} & 0 &  0 &  1 &  2 &  3 &  4 \\
   & 1 &  5 &  6 &  7 &  8 &  9 \\
\cline{1-7}
c3 & 0 &  0 &  1 &  2 &  3 &  4 \\
\bottomrule
\end{tabular}
"""
        assert result == expected

    def test_to_latex_escape(self):
        a = 'a'
        b = 'b'

        test_dict = {u('co^l1'): {a: "a",
                                  b: "b"},
                     u('co$e^x$'): {a: "a",
                                    b: "b"}}

        unescaped_result = DataFrame(test_dict).to_latex(escape=False)
        escaped_result = DataFrame(test_dict).to_latex(
        )  # default: escape=True

        unescaped_expected = r'''\begin{tabular}{lll}
\toprule
{} & co$e^x$ & co^l1 \\
\midrule
a &       a &     a \\
b &       b &     b \\
\bottomrule
\end{tabular}
'''

        escaped_expected = r'''\begin{tabular}{lll}
\toprule
{} & co\$e\textasciicircumx\$ & co\textasciicircuml1 \\
\midrule
a &       a &     a \\
b &       b &     b \\
\bottomrule
\end{tabular}
'''

        assert unescaped_result == unescaped_expected
        assert escaped_result == escaped_expected

    def test_to_latex_longtable(self, frame):
        frame.to_latex(longtable=True)

        df = DataFrame({'a': [1, 2], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex(longtable=True)
        withindex_expected = r"""\begin{longtable}{lrl}
\toprule
{} &  a &   b \\
\midrule
\endhead
\midrule
\multicolumn{3}{r}{{Continued on next page}} \\
\midrule
\endfoot

\bottomrule
\endlastfoot
0 &  1 &  b1 \\
1 &  2 &  b2 \\
\end{longtable}
"""

        assert withindex_result == withindex_expected

        withoutindex_result = df.to_latex(index=False, longtable=True)
        withoutindex_expected = r"""\begin{longtable}{rl}
\toprule
 a &   b \\
\midrule
\endhead
\midrule
\multicolumn{3}{r}{{Continued on next page}} \\
\midrule
\endfoot

\bottomrule
\endlastfoot
 1 &  b1 \\
 2 &  b2 \\
\end{longtable}
"""

        assert withoutindex_result == withoutindex_expected

    def test_to_latex_escape_special_chars(self):
        special_characters = ['&', '%', '$', '#', '_', '{', '}', '~', '^',
                              '\\']
        df = DataFrame(data=special_characters)
        observed = df.to_latex()
        expected = r"""\begin{tabular}{ll}
\toprule
{} &  0 \\
\midrule
0 &  \& \\
1 &  \% \\
2 &  \$ \\
3 &  \# \\
4 &  \_ \\
5 &  \{ \\
6 &  \} \\
7 &  \textasciitilde \\
8 &  \textasciicircum \\
9 &  \textbackslash \\
\bottomrule
\end{tabular}
"""

        assert observed == expected

    def test_to_latex_no_header(self):
        # GH 7124
        df = DataFrame({'a': [1, 2], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex(header=False)
        withindex_expected = r"""\begin{tabular}{lrl}
\toprule
0 &  1 &  b1 \\
1 &  2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withindex_result == withindex_expected

        withoutindex_result = df.to_latex(index=False, header=False)
        withoutindex_expected = r"""\begin{tabular}{rl}
\toprule
 1 &  b1 \\
 2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withoutindex_result == withoutindex_expected

    def test_to_latex_specified_header(self):
        # GH 7124
        df = DataFrame({'a': [1, 2], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex(header=['AA', 'BB'])
        withindex_expected = r"""\begin{tabular}{lrl}
\toprule
{} & AA &  BB \\
\midrule
0 &  1 &  b1 \\
1 &  2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withindex_result == withindex_expected

        withoutindex_result = df.to_latex(header=['AA', 'BB'], index=False)
        withoutindex_expected = r"""\begin{tabular}{rl}
\toprule
AA &  BB \\
\midrule
 1 &  b1 \\
 2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withoutindex_result == withoutindex_expected

        withoutescape_result = df.to_latex(header=['$A$', '$B$'], escape=False)
        withoutescape_expected = r"""\begin{tabular}{lrl}
\toprule
{} & $A$ & $B$ \\
\midrule
0 &   1 &  b1 \\
1 &   2 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withoutescape_result == withoutescape_expected

        with pytest.raises(ValueError):
            df.to_latex(header=['A'])

    def test_to_latex_decimal(self, frame):
        # GH 12031
        frame.to_latex()

        df = DataFrame({'a': [1.0, 2.1], 'b': ['b1', 'b2']})
        withindex_result = df.to_latex(decimal=',')

        withindex_expected = r"""\begin{tabular}{lrl}
\toprule
{} &    a &   b \\
\midrule
0 &  1,0 &  b1 \\
1 &  2,1 &  b2 \\
\bottomrule
\end{tabular}
"""

        assert withindex_result == withindex_expected

    def test_to_latex_series(self):
        s = Series(['a', 'b', 'c'])
        withindex_result = s.to_latex()
        withindex_expected = r"""\begin{tabular}{ll}
\toprule
{} &  0 \\
\midrule
0 &  a \\
1 &  b \\
2 &  c \\
\bottomrule
\end{tabular}
"""
        assert withindex_result == withindex_expected
