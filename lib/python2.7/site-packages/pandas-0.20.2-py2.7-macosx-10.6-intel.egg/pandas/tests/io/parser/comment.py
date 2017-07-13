# -*- coding: utf-8 -*-

"""
Tests that comments are properly handled during parsing
for all of the parsers defined in parsers.py
"""

import numpy as np
import pandas.util.testing as tm

from pandas import DataFrame
from pandas.compat import StringIO


class CommentTests(object):

    def test_comment(self):
        data = """A,B,C
1,2.,4.#hello world
5.,NaN,10.0
"""
        expected = np.array([[1., 2., 4.],
                             [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data), comment='#')
        tm.assert_numpy_array_equal(df.values, expected)

        df = self.read_table(StringIO(data), sep=',', comment='#',
                             na_values=['NaN'])
        tm.assert_numpy_array_equal(df.values, expected)

    def test_line_comment(self):
        data = """# empty
A,B,C
1,2.,4.#hello world
#ignore this line
5.,NaN,10.0
"""
        expected = np.array([[1., 2., 4.],
                             [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data), comment='#')
        tm.assert_numpy_array_equal(df.values, expected)

        # check with delim_whitespace=True
        df = self.read_csv(StringIO(data.replace(',', ' ')), comment='#',
                           delim_whitespace=True)
        tm.assert_almost_equal(df.values, expected)

        # custom line terminator is not supported
        # with the Python parser yet
        if self.engine == 'c':
            expected = np.array([[1., 2., 4.],
                                 [5., np.nan, 10.]])
            df = self.read_csv(StringIO(data.replace('\n', '*')),
                               comment='#', lineterminator='*')
            tm.assert_numpy_array_equal(df.values, expected)

    def test_comment_skiprows(self):
        data = """# empty
random line
# second empty line
1,2,3
A,B,C
1,2.,4.
5.,NaN,10.0
"""
        # this should ignore the first four lines (including comments)
        expected = np.array([[1., 2., 4.], [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data), comment='#', skiprows=4)
        tm.assert_numpy_array_equal(df.values, expected)

    def test_comment_header(self):
        data = """# empty
# second empty line
1,2,3
A,B,C
1,2.,4.
5.,NaN,10.0
"""
        # header should begin at the second non-comment line
        expected = np.array([[1., 2., 4.], [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data), comment='#', header=1)
        tm.assert_numpy_array_equal(df.values, expected)

    def test_comment_skiprows_header(self):
        data = """# empty
# second empty line
# third empty line
X,Y,Z
1,2,3
A,B,C
1,2.,4.
5.,NaN,10.0
"""
        # skiprows should skip the first 4 lines (including comments), while
        # header should start from the second non-commented line starting
        # with line 5
        expected = np.array([[1., 2., 4.], [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data), comment='#', skiprows=4, header=1)
        tm.assert_numpy_array_equal(df.values, expected)

    def test_custom_comment_char(self):
        data = "a,b,c\n1,2,3#ignore this!\n4,5,6#ignorethistoo"

        result = self.read_csv(StringIO(data), comment='#')
        expected = DataFrame({'a': [1, 4], 'b': [2, 5], 'c': [3, 6]})
        tm.assert_frame_equal(result, expected)

    def test_commment_first_line(self):
        # see gh-4623
        data = '# notes\na,b,c\n# more notes\n1,2,3'

        expected = DataFrame([[1, 2, 3]], columns=['a', 'b', 'c'])
        result = self.read_csv(StringIO(data), comment='#')
        tm.assert_frame_equal(result, expected)

        expected = DataFrame({0: ['a', '1'], 1: ['b', '2'], 2: ['c', '3']})
        result = self.read_csv(StringIO(data), comment='#', header=None)
        tm.assert_frame_equal(result, expected)
