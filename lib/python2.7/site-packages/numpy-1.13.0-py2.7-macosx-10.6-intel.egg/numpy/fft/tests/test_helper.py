"""Test functions for fftpack.helper module

Copied from fftpack.helper by Pearu Peterson, October 2005

"""
from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import TestCase, run_module_suite, assert_array_almost_equal
from numpy import fft
from numpy import pi
from numpy.fft.helper import _FFTCache


class TestFFTShift(TestCase):

    def test_definition(self):
        x = [0, 1, 2, 3, 4, -4, -3, -2, -1]
        y = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
        assert_array_almost_equal(fft.fftshift(x), y)
        assert_array_almost_equal(fft.ifftshift(y), x)
        x = [0, 1, 2, 3, 4, -5, -4, -3, -2, -1]
        y = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]
        assert_array_almost_equal(fft.fftshift(x), y)
        assert_array_almost_equal(fft.ifftshift(y), x)

    def test_inverse(self):
        for n in [1, 4, 9, 100, 211]:
            x = np.random.random((n,))
            assert_array_almost_equal(fft.ifftshift(fft.fftshift(x)), x)

    def test_axes_keyword(self):
        freqs = [[0, 1, 2], [3, 4, -4], [-3, -2, -1]]
        shifted = [[-1, -3, -2], [2, 0, 1], [-4, 3, 4]]
        assert_array_almost_equal(fft.fftshift(freqs, axes=(0, 1)), shifted)
        assert_array_almost_equal(fft.fftshift(freqs, axes=0),
                fft.fftshift(freqs, axes=(0,)))
        assert_array_almost_equal(fft.ifftshift(shifted, axes=(0, 1)), freqs)
        assert_array_almost_equal(fft.ifftshift(shifted, axes=0),
                fft.ifftshift(shifted, axes=(0,)))


class TestFFTFreq(TestCase):

    def test_definition(self):
        x = [0, 1, 2, 3, 4, -4, -3, -2, -1]
        assert_array_almost_equal(9*fft.fftfreq(9), x)
        assert_array_almost_equal(9*pi*fft.fftfreq(9, pi), x)
        x = [0, 1, 2, 3, 4, -5, -4, -3, -2, -1]
        assert_array_almost_equal(10*fft.fftfreq(10), x)
        assert_array_almost_equal(10*pi*fft.fftfreq(10, pi), x)


class TestRFFTFreq(TestCase):

    def test_definition(self):
        x = [0, 1, 2, 3, 4]
        assert_array_almost_equal(9*fft.rfftfreq(9), x)
        assert_array_almost_equal(9*pi*fft.rfftfreq(9, pi), x)
        x = [0, 1, 2, 3, 4, 5]
        assert_array_almost_equal(10*fft.rfftfreq(10), x)
        assert_array_almost_equal(10*pi*fft.rfftfreq(10, pi), x)


class TestIRFFTN(TestCase):

    def test_not_last_axis_success(self):
        ar, ai = np.random.random((2, 16, 8, 32))
        a = ar + 1j*ai

        axes = (-2,)

        # Should not raise error
        fft.irfftn(a, axes=axes)


class TestFFTCache(TestCase):

    def test_basic_behaviour(self):
        c = _FFTCache(max_size_in_mb=1, max_item_count=4)

        # Put
        c.put_twiddle_factors(1, np.ones(2, dtype=np.float32))
        c.put_twiddle_factors(2, np.zeros(2, dtype=np.float32))

        # Get
        assert_array_almost_equal(c.pop_twiddle_factors(1),
                                  np.ones(2, dtype=np.float32))
        assert_array_almost_equal(c.pop_twiddle_factors(2),
                                  np.zeros(2, dtype=np.float32))

        # Nothing should be left.
        self.assertEqual(len(c._dict), 0)

        # Now put everything in twice so it can be retrieved once and each will
        # still have one item left.
        for _ in range(2):
            c.put_twiddle_factors(1, np.ones(2, dtype=np.float32))
            c.put_twiddle_factors(2, np.zeros(2, dtype=np.float32))
        assert_array_almost_equal(c.pop_twiddle_factors(1),
                                  np.ones(2, dtype=np.float32))
        assert_array_almost_equal(c.pop_twiddle_factors(2),
                                  np.zeros(2, dtype=np.float32))
        self.assertEqual(len(c._dict), 2)

    def test_automatic_pruning(self):
        # That's around 2600 single precision samples.
        c = _FFTCache(max_size_in_mb=0.01, max_item_count=4)

        c.put_twiddle_factors(1, np.ones(200, dtype=np.float32))
        c.put_twiddle_factors(2, np.ones(200, dtype=np.float32))
        self.assertEqual(list(c._dict.keys()), [1, 2])

        # This is larger than the limit but should still be kept.
        c.put_twiddle_factors(3, np.ones(3000, dtype=np.float32))
        self.assertEqual(list(c._dict.keys()), [1, 2, 3])
        # Add one more.
        c.put_twiddle_factors(4, np.ones(3000, dtype=np.float32))
        # The other three should no longer exist.
        self.assertEqual(list(c._dict.keys()), [4])

        # Now test the max item count pruning.
        c = _FFTCache(max_size_in_mb=0.01, max_item_count=2)
        c.put_twiddle_factors(2, np.empty(2))
        c.put_twiddle_factors(1, np.empty(2))
        # Can still be accessed.
        self.assertEqual(list(c._dict.keys()), [2, 1])

        c.put_twiddle_factors(3, np.empty(2))
        # 1 and 3 can still be accessed - c[2] has been touched least recently
        # and is thus evicted.
        self.assertEqual(list(c._dict.keys()), [1, 3])

        # One last test. We will add a single large item that is slightly
        # bigger then the cache size. Some small items can still be added.
        c = _FFTCache(max_size_in_mb=0.01, max_item_count=5)
        c.put_twiddle_factors(1, np.ones(3000, dtype=np.float32))
        c.put_twiddle_factors(2, np.ones(2, dtype=np.float32))
        c.put_twiddle_factors(3, np.ones(2, dtype=np.float32))
        c.put_twiddle_factors(4, np.ones(2, dtype=np.float32))
        self.assertEqual(list(c._dict.keys()), [1, 2, 3, 4])

        # One more big item. This time it is 6 smaller ones but they are
        # counted as one big item.
        for _ in range(6):
            c.put_twiddle_factors(5, np.ones(500, dtype=np.float32))
        # '1' no longer in the cache. Rest still in the cache.
        self.assertEqual(list(c._dict.keys()), [2, 3, 4, 5])

        # Another big item - should now be the only item in the cache.
        c.put_twiddle_factors(6, np.ones(4000, dtype=np.float32))
        self.assertEqual(list(c._dict.keys()), [6])


if __name__ == "__main__":
    run_module_suite()
