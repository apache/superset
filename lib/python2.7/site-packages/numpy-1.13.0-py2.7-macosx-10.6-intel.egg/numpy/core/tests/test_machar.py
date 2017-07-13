from __future__ import division, absolute_import, print_function

from numpy.core.machar import MachAr
import numpy.core.numerictypes as ntypes
from numpy import errstate, array
from numpy.testing import TestCase, run_module_suite

class TestMachAr(TestCase):
    def _run_machar_highprec(self):
        # Instantiate MachAr instance with high enough precision to cause
        # underflow
        try:
            hiprec = ntypes.float96
            MachAr(lambda v:array([v], hiprec))
        except AttributeError:
            "Skipping test: no ntypes.float96 available on this platform."

    def test_underlow(self):
        # Regression test for #759:
        # instantiating MachAr for dtype = np.float96 raises spurious warning.
        with errstate(all='raise'):
            try:
                self._run_machar_highprec()
            except FloatingPointError as e:
                self.fail("Caught %s exception, should not have been raised." % e)


if __name__ == "__main__":
    run_module_suite()
