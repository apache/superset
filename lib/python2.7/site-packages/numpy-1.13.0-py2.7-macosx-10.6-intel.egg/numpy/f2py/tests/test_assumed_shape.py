from __future__ import division, absolute_import, print_function

import os

from numpy.testing import run_module_suite, assert_, dec
import util


def _path(*a):
    return os.path.join(*((os.path.dirname(__file__),) + a))


class TestAssumedShapeSumExample(util.F2PyTest):
    sources = [_path('src', 'assumed_shape', 'foo_free.f90'),
               _path('src', 'assumed_shape', 'foo_use.f90'),
               _path('src', 'assumed_shape', 'precision.f90'),
               _path('src', 'assumed_shape', 'foo_mod.f90'),
               ]

    @dec.slow
    def test_all(self):
        r = self.module.fsum([1, 2])
        assert_(r == 3, repr(r))
        r = self.module.sum([1, 2])
        assert_(r == 3, repr(r))
        r = self.module.sum_with_use([1, 2])
        assert_(r == 3, repr(r))

        r = self.module.mod.sum([1, 2])
        assert_(r == 3, repr(r))
        r = self.module.mod.fsum([1, 2])
        assert_(r == 3, repr(r))

if __name__ == "__main__":
    run_module_suite()
