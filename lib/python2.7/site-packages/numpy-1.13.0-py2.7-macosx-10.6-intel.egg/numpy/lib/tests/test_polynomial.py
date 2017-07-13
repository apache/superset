from __future__ import division, absolute_import, print_function

'''
>>> p = np.poly1d([1.,2,3])
>>> p
poly1d([ 1.,  2.,  3.])
>>> print(p)
   2
1 x + 2 x + 3
>>> q = np.poly1d([3.,2,1])
>>> q
poly1d([ 3.,  2.,  1.])
>>> print(q)
   2
3 x + 2 x + 1
>>> print(np.poly1d([1.89999+2j, -3j, -5.12345678, 2+1j]))
            3      2
(1.9 + 2j) x - 3j x - 5.123 x + (2 + 1j)
>>> print(np.poly1d([-3, -2, -1]))
    2
-3 x - 2 x - 1

>>> p(0)
3.0
>>> p(5)
38.0
>>> q(0)
1.0
>>> q(5)
86.0

>>> p * q
poly1d([  3.,   8.,  14.,   8.,   3.])
>>> p / q
(poly1d([ 0.33333333]), poly1d([ 1.33333333,  2.66666667]))
>>> p + q
poly1d([ 4.,  4.,  4.])
>>> p - q
poly1d([-2.,  0.,  2.])
>>> p ** 4
poly1d([   1.,    8.,   36.,  104.,  214.,  312.,  324.,  216.,   81.])

>>> p(q)
poly1d([  9.,  12.,  16.,   8.,   6.])
>>> q(p)
poly1d([  3.,  12.,  32.,  40.,  34.])

>>> np.asarray(p)
array([ 1.,  2.,  3.])
>>> len(p)
2

>>> p[0], p[1], p[2], p[3]
(3.0, 2.0, 1.0, 0)

>>> p.integ()
poly1d([ 0.33333333,  1.        ,  3.        ,  0.        ])
>>> p.integ(1)
poly1d([ 0.33333333,  1.        ,  3.        ,  0.        ])
>>> p.integ(5)
poly1d([ 0.00039683,  0.00277778,  0.025     ,  0.        ,  0.        ,
        0.        ,  0.        ,  0.        ])
>>> p.deriv()
poly1d([ 2.,  2.])
>>> p.deriv(2)
poly1d([ 2.])

>>> q = np.poly1d([1.,2,3], variable='y')
>>> print(q)
   2
1 y + 2 y + 3
>>> q = np.poly1d([1.,2,3], variable='lambda')
>>> print(q)
        2
1 lambda + 2 lambda + 3

>>> np.polydiv(np.poly1d([1,0,-1]), np.poly1d([1,1]))
(poly1d([ 1., -1.]), poly1d([ 0.]))

'''
import numpy as np
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_equal, assert_array_equal,
    assert_almost_equal, assert_array_almost_equal, assert_raises, rundocs
    )


class TestDocs(TestCase):
    def test_doctests(self):
        return rundocs()

    def test_poly(self):
        assert_array_almost_equal(np.poly([3, -np.sqrt(2), np.sqrt(2)]),
                                  [1, -3, -2, 6])

        # From matlab docs
        A = [[1, 2, 3], [4, 5, 6], [7, 8, 0]]
        assert_array_almost_equal(np.poly(A), [1, -6, -72, -27])

        # Should produce real output for perfect conjugates
        assert_(np.isrealobj(np.poly([+1.082j, +2.613j, -2.613j, -1.082j])))
        assert_(np.isrealobj(np.poly([0+1j, -0+-1j, 1+2j,
                                      1-2j, 1.+3.5j, 1-3.5j])))
        assert_(np.isrealobj(np.poly([1j, -1j, 1+2j, 1-2j, 1+3j, 1-3.j])))
        assert_(np.isrealobj(np.poly([1j, -1j, 1+2j, 1-2j])))
        assert_(np.isrealobj(np.poly([1j, -1j, 2j, -2j])))
        assert_(np.isrealobj(np.poly([1j, -1j])))
        assert_(np.isrealobj(np.poly([1, -1])))

        assert_(np.iscomplexobj(np.poly([1j, -1.0000001j])))

        np.random.seed(42)
        a = np.random.randn(100) + 1j*np.random.randn(100)
        assert_(np.isrealobj(np.poly(np.concatenate((a, np.conjugate(a))))))

    def test_roots(self):
        assert_array_equal(np.roots([1, 0, 0]), [0, 0])

    def test_str_leading_zeros(self):
        p = np.poly1d([4, 3, 2, 1])
        p[3] = 0
        assert_equal(str(p),
                     "   2\n"
                     "3 x + 2 x + 1")

        p = np.poly1d([1, 2])
        p[0] = 0
        p[1] = 0
        assert_equal(str(p), " \n0")

    def test_polyfit(self):
        c = np.array([3., 2., 1.])
        x = np.linspace(0, 2, 7)
        y = np.polyval(c, x)
        err = [1, -1, 1, -1, 1, -1, 1]
        weights = np.arange(8, 1, -1)**2/7.0

        # Check exception when too few points for variance estimate. Note that
        # the Bayesian estimate requires the number of data points to exceed
        # degree + 3.
        assert_raises(ValueError, np.polyfit,
                      [0, 1, 3], [0, 1, 3], deg=0, cov=True)

        # check 1D case
        m, cov = np.polyfit(x, y+err, 2, cov=True)
        est = [3.8571, 0.2857, 1.619]
        assert_almost_equal(est, m, decimal=4)
        val0 = [[2.9388, -5.8776, 1.6327],
                [-5.8776, 12.7347, -4.2449],
                [1.6327, -4.2449, 2.3220]]
        assert_almost_equal(val0, cov, decimal=4)

        m2, cov2 = np.polyfit(x, y+err, 2, w=weights, cov=True)
        assert_almost_equal([4.8927, -1.0177, 1.7768], m2, decimal=4)
        val = [[8.7929, -10.0103, 0.9756],
               [-10.0103, 13.6134, -1.8178],
               [0.9756, -1.8178, 0.6674]]
        assert_almost_equal(val, cov2, decimal=4)

        # check 2D (n,1) case
        y = y[:, np.newaxis]
        c = c[:, np.newaxis]
        assert_almost_equal(c, np.polyfit(x, y, 2))
        # check 2D (n,2) case
        yy = np.concatenate((y, y), axis=1)
        cc = np.concatenate((c, c), axis=1)
        assert_almost_equal(cc, np.polyfit(x, yy, 2))

        m, cov = np.polyfit(x, yy + np.array(err)[:, np.newaxis], 2, cov=True)
        assert_almost_equal(est, m[:, 0], decimal=4)
        assert_almost_equal(est, m[:, 1], decimal=4)
        assert_almost_equal(val0, cov[:, :, 0], decimal=4)
        assert_almost_equal(val0, cov[:, :, 1], decimal=4)

    def test_objects(self):
        from decimal import Decimal
        p = np.poly1d([Decimal('4.0'), Decimal('3.0'), Decimal('2.0')])
        p2 = p * Decimal('1.333333333333333')
        assert_(p2[1] == Decimal("3.9999999999999990"))
        p2 = p.deriv()
        assert_(p2[1] == Decimal('8.0'))
        p2 = p.integ()
        assert_(p2[3] == Decimal("1.333333333333333333333333333"))
        assert_(p2[2] == Decimal('1.5'))
        assert_(np.issubdtype(p2.coeffs.dtype, np.object_))
        p = np.poly([Decimal(1), Decimal(2)])
        assert_equal(np.poly([Decimal(1), Decimal(2)]),
                     [1, Decimal(-3), Decimal(2)])

    def test_complex(self):
        p = np.poly1d([3j, 2j, 1j])
        p2 = p.integ()
        assert_((p2.coeffs == [1j, 1j, 1j, 0]).all())
        p2 = p.deriv()
        assert_((p2.coeffs == [6j, 2j]).all())

    def test_integ_coeffs(self):
        p = np.poly1d([3, 2, 1])
        p2 = p.integ(3, k=[9, 7, 6])
        assert_(
            (p2.coeffs == [1/4./5., 1/3./4., 1/2./3., 9/1./2., 7, 6]).all())

    def test_zero_dims(self):
        try:
            np.poly(np.zeros((0, 0)))
        except ValueError:
            pass

    def test_poly_int_overflow(self):
        """
        Regression test for gh-5096.
        """
        v = np.arange(1, 21)
        assert_almost_equal(np.poly(v), np.poly(np.diag(v)))

    def test_poly_eq(self):
        p = np.poly1d([1, 2, 3])
        p2 = np.poly1d([1, 2, 4])
        assert_equal(p == None, False)
        assert_equal(p != None, True)
        assert_equal(p == p, True)
        assert_equal(p == p2, False)
        assert_equal(p != p2, True)

    def test_poly_coeffs_immutable(self):
        """ Coefficients should not be modifiable """
        p = np.poly1d([1, 2, 3])

        try:
            # despite throwing an exception, this used to change state
            p.coeffs += 1
        except Exception:
            pass
        assert_equal(p.coeffs, [1, 2, 3])

        p.coeffs[2] += 10
        assert_equal(p.coeffs, [1, 2, 3])


if __name__ == "__main__":
    run_module_suite()
