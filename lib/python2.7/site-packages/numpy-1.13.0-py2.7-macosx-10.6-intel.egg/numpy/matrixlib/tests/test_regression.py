from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import TestCase, run_module_suite, assert_, assert_equal

rlevel = 1

class TestRegression(TestCase):
    def test_kron_matrix(self, level=rlevel):
        # Ticket #71
        x = np.matrix('[1 0; 1 0]')
        assert_equal(type(np.kron(x, x)), type(x))

    def test_matrix_properties(self,level=rlevel):
        # Ticket #125
        a = np.matrix([1.0], dtype=float)
        assert_(type(a.real) is np.matrix)
        assert_(type(a.imag) is np.matrix)
        c, d = np.matrix([0.0]).nonzero()
        assert_(type(c) is np.ndarray)
        assert_(type(d) is np.ndarray)

    def test_matrix_multiply_by_1d_vector(self, level=rlevel):
        # Ticket #473
        def mul():
            np.mat(np.eye(2))*np.ones(2)

        self.assertRaises(ValueError, mul)

    def test_matrix_std_argmax(self,level=rlevel):
        # Ticket #83
        x = np.asmatrix(np.random.uniform(0, 1, (3, 3)))
        self.assertEqual(x.std().shape, ())
        self.assertEqual(x.argmax().shape, ())

if __name__ == "__main__":
    run_module_suite()
