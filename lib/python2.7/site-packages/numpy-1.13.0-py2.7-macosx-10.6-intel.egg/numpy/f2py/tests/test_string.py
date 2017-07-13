from __future__ import division, absolute_import, print_function

import os

from numpy.testing import run_module_suite, assert_array_equal, dec
import numpy as np
import util


def _path(*a):
    return os.path.join(*((os.path.dirname(__file__),) + a))

class TestString(util.F2PyTest):
    sources = [_path('src', 'string', 'char.f90')]

    @dec.slow
    def test_char(self):
        strings = np.array(['ab', 'cd', 'ef'], dtype='c').T
        inp, out = self.module.char_test.change_strings(strings, strings.shape[1])
        assert_array_equal(inp, strings)
        expected = strings.copy()
        expected[1, :] = 'AAA'
        assert_array_equal(out, expected)

if __name__ == "__main__":
    run_module_suite()
