from __future__ import division, absolute_import, print_function

import os

from numpy.testing import run_module_suite, assert_, dec
from numpy.f2py.crackfortran import (
    _selected_int_kind_func as selected_int_kind,
    _selected_real_kind_func as selected_real_kind
)
import util


def _path(*a):
    return os.path.join(*((os.path.dirname(__file__),) + a))


class TestKind(util.F2PyTest):
    sources = [_path('src', 'kind', 'foo.f90')]

    @dec.slow
    def test_all(self):
        selectedrealkind = self.module.selectedrealkind
        selectedintkind = self.module.selectedintkind

        for i in range(40):
            assert_(selectedintkind(i) in [selected_int_kind(i), -1],
                    'selectedintkind(%s): expected %r but got %r' %
                    (i, selected_int_kind(i), selectedintkind(i)))

        for i in range(20):
            assert_(selectedrealkind(i) in [selected_real_kind(i), -1],
                    'selectedrealkind(%s): expected %r but got %r' %
                    (i, selected_real_kind(i), selectedrealkind(i)))

if __name__ == "__main__":
    run_module_suite()
