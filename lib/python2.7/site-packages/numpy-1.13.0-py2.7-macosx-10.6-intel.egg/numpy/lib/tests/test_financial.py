from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_almost_equal,
    assert_allclose, assert_equal
    )


class TestFinancial(TestCase):
    def test_rate(self):
        assert_almost_equal(np.rate(10, 0, -3500, 10000),
                            0.1107, 4)

    def test_irr(self):
        v = [-150000, 15000, 25000, 35000, 45000, 60000]
        assert_almost_equal(np.irr(v), 0.0524, 2)
        v = [-100, 0, 0, 74]
        assert_almost_equal(np.irr(v), -0.0955, 2)
        v = [-100, 39, 59, 55, 20]
        assert_almost_equal(np.irr(v), 0.28095, 2)
        v = [-100, 100, 0, -7]
        assert_almost_equal(np.irr(v), -0.0833, 2)
        v = [-100, 100, 0, 7]
        assert_almost_equal(np.irr(v), 0.06206, 2)
        v = [-5, 10.5, 1, -8, 1]
        assert_almost_equal(np.irr(v), 0.0886, 2)

        # Test that if there is no solution then np.irr returns nan
        # Fixes gh-6744
        v = [-1, -2, -3]
        assert_equal(np.irr(v), np.nan)

    def test_pv(self):
        assert_almost_equal(np.pv(0.07, 20, 12000, 0), -127128.17, 2)

    def test_fv(self):
        assert_almost_equal(np.fv(0.075, 20, -2000, 0, 0), 86609.36, 2)

    def test_pmt(self):
        res = np.pmt(0.08/12, 5*12, 15000)
        tgt = -304.145914
        assert_allclose(res, tgt)
        # Test the edge case where rate == 0.0
        res = np.pmt(0.0, 5*12, 15000)
        tgt = -250.0
        assert_allclose(res, tgt)
        # Test the case where we use broadcast and
        # the arguments passed in are arrays.
        res = np.pmt([[0.0, 0.8],[0.3, 0.8]],[12, 3],[2000, 20000])
        tgt = np.array([[-166.66667, -19311.258],[-626.90814, -19311.258]])
        assert_allclose(res, tgt)

    def test_ppmt(self):
        np.round(np.ppmt(0.1/12, 1, 60, 55000), 2) == 710.25

    def test_ipmt(self):
        np.round(np.ipmt(0.1/12, 1, 24, 2000), 2) == 16.67

    def test_nper(self):
        assert_almost_equal(np.nper(0.075, -2000, 0, 100000.),
                            21.54, 2)

    def test_nper2(self):
        assert_almost_equal(np.nper(0.0, -2000, 0, 100000.),
                            50.0, 1)

    def test_npv(self):
        assert_almost_equal(
            np.npv(0.05, [-15000, 1500, 2500, 3500, 4500, 6000]),
            122.89, 2)

    def test_mirr(self):
        val = [-4500, -800, 800, 800, 600, 600, 800, 800, 700, 3000]
        assert_almost_equal(np.mirr(val, 0.08, 0.055), 0.0666, 4)

        val = [-120000, 39000, 30000, 21000, 37000, 46000]
        assert_almost_equal(np.mirr(val, 0.10, 0.12), 0.126094, 6)

        val = [100, 200, -50, 300, -200]
        assert_almost_equal(np.mirr(val, 0.05, 0.06), 0.3428, 4)

        val = [39000, 30000, 21000, 37000, 46000]
        assert_(np.isnan(np.mirr(val, 0.10, 0.12)))

    def test_when(self):
        #begin
        assert_almost_equal(np.rate(10, 20, -3500, 10000, 1),
                            np.rate(10, 20, -3500, 10000, 'begin'), 4)
        #end
        assert_almost_equal(np.rate(10, 20, -3500, 10000),
                            np.rate(10, 20, -3500, 10000, 'end'), 4)
        assert_almost_equal(np.rate(10, 20, -3500, 10000, 0),
                            np.rate(10, 20, -3500, 10000, 'end'), 4)

        # begin
        assert_almost_equal(np.pv(0.07, 20, 12000, 0, 1),
                            np.pv(0.07, 20, 12000, 0, 'begin'), 2)
        # end
        assert_almost_equal(np.pv(0.07, 20, 12000, 0),
                            np.pv(0.07, 20, 12000, 0, 'end'), 2)
        assert_almost_equal(np.pv(0.07, 20, 12000, 0, 0),
                            np.pv(0.07, 20, 12000, 0, 'end'), 2)

        # begin
        assert_almost_equal(np.fv(0.075, 20, -2000, 0, 1),
                            np.fv(0.075, 20, -2000, 0, 'begin'), 4)
        # end
        assert_almost_equal(np.fv(0.075, 20, -2000, 0),
                            np.fv(0.075, 20, -2000, 0, 'end'), 4)
        assert_almost_equal(np.fv(0.075, 20, -2000, 0, 0),
                            np.fv(0.075, 20, -2000, 0, 'end'), 4)

        # begin
        assert_almost_equal(np.pmt(0.08/12, 5*12, 15000., 0, 1),
                            np.pmt(0.08/12, 5*12, 15000., 0, 'begin'), 4)
        # end
        assert_almost_equal(np.pmt(0.08/12, 5*12, 15000., 0),
                            np.pmt(0.08/12, 5*12, 15000., 0, 'end'), 4)
        assert_almost_equal(np.pmt(0.08/12, 5*12, 15000., 0, 0),
                            np.pmt(0.08/12, 5*12, 15000., 0, 'end'), 4)

        # begin
        assert_almost_equal(np.ppmt(0.1/12, 1, 60, 55000, 0, 1),
                            np.ppmt(0.1/12, 1, 60, 55000, 0, 'begin'), 4)
        # end
        assert_almost_equal(np.ppmt(0.1/12, 1, 60, 55000, 0),
                            np.ppmt(0.1/12, 1, 60, 55000, 0, 'end'), 4)
        assert_almost_equal(np.ppmt(0.1/12, 1, 60, 55000, 0, 0),
                            np.ppmt(0.1/12, 1, 60, 55000, 0, 'end'), 4)

        # begin
        assert_almost_equal(np.ipmt(0.1/12, 1, 24, 2000, 0, 1),
                            np.ipmt(0.1/12, 1, 24, 2000, 0, 'begin'), 4)
        # end
        assert_almost_equal(np.ipmt(0.1/12, 1, 24, 2000, 0),
                            np.ipmt(0.1/12, 1, 24, 2000, 0, 'end'), 4)
        assert_almost_equal(np.ipmt(0.1/12, 1, 24, 2000, 0, 0),
                            np.ipmt(0.1/12, 1, 24, 2000, 0, 'end'), 4)

        # begin
        assert_almost_equal(np.nper(0.075, -2000, 0, 100000., 1),
                            np.nper(0.075, -2000, 0, 100000., 'begin'), 4)
        # end
        assert_almost_equal(np.nper(0.075, -2000, 0, 100000.),
                            np.nper(0.075, -2000, 0, 100000., 'end'), 4)
        assert_almost_equal(np.nper(0.075, -2000, 0, 100000., 0),
                            np.nper(0.075, -2000, 0, 100000., 'end'), 4)

    def test_broadcast(self):
        assert_almost_equal(np.nper(0.075, -2000, 0, 100000., [0, 1]),
                            [21.5449442, 20.76156441], 4)

        assert_almost_equal(np.ipmt(0.1/12, list(range(5)), 24, 2000),
                            [-17.29165168, -16.66666667, -16.03647345,
                                -15.40102862, -14.76028842], 4)

        assert_almost_equal(np.ppmt(0.1/12, list(range(5)), 24, 2000),
                            [-74.998201, -75.62318601, -76.25337923,
                                -76.88882405, -77.52956425], 4)

        assert_almost_equal(np.ppmt(0.1/12, list(range(5)), 24, 2000, 0,
                                    [0, 0, 1, 'end', 'begin']),
                            [-74.998201, -75.62318601, -75.62318601,
                                -76.88882405, -76.88882405], 4)

if __name__ == "__main__":
    run_module_suite()
