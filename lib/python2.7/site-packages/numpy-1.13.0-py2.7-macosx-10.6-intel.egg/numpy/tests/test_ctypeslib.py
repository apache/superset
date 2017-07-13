from __future__ import division, absolute_import, print_function

import sys

import numpy as np
from numpy.ctypeslib import ndpointer, load_library
from numpy.distutils.misc_util import get_shared_lib_extension
from numpy.testing import TestCase, run_module_suite, dec

try:
    cdll = None
    if hasattr(sys, 'gettotalrefcount'):
        try:
            cdll = load_library('multiarray_d', np.core.multiarray.__file__)
        except OSError:
            pass
    if cdll is None:
        cdll = load_library('multiarray', np.core.multiarray.__file__)
    _HAS_CTYPE = True
except ImportError:
    _HAS_CTYPE = False

class TestLoadLibrary(TestCase):
    @dec.skipif(not _HAS_CTYPE,
                "ctypes not available on this python installation")
    @dec.knownfailureif(sys.platform ==
                        'cygwin', "This test is known to fail on cygwin")
    def test_basic(self):
        try:
            # Should succeed
            load_library('multiarray', np.core.multiarray.__file__)
        except ImportError as e:
            msg = ("ctypes is not available on this python: skipping the test"
                   " (import error was: %s)" % str(e))
            print(msg)

    @dec.skipif(not _HAS_CTYPE,
                "ctypes not available on this python installation")
    @dec.knownfailureif(sys.platform ==
                        'cygwin', "This test is known to fail on cygwin")
    def test_basic2(self):
        # Regression for #801: load_library with a full library name
        # (including extension) does not work.
        try:
            try:
                so = get_shared_lib_extension(is_python_ext=True)
                # Should succeed
                load_library('multiarray%s' % so, np.core.multiarray.__file__)
            except ImportError:
                print("No distutils available, skipping test.")
        except ImportError as e:
            msg = ("ctypes is not available on this python: skipping the test"
                   " (import error was: %s)" % str(e))
            print(msg)

class TestNdpointer(TestCase):
    def test_dtype(self):
        dt = np.intc
        p = ndpointer(dtype=dt)
        self.assertTrue(p.from_param(np.array([1], dt)))
        dt = '<i4'
        p = ndpointer(dtype=dt)
        self.assertTrue(p.from_param(np.array([1], dt)))
        dt = np.dtype('>i4')
        p = ndpointer(dtype=dt)
        p.from_param(np.array([1], dt))
        self.assertRaises(TypeError, p.from_param,
                          np.array([1], dt.newbyteorder('swap')))
        dtnames = ['x', 'y']
        dtformats = [np.intc, np.float64]
        dtdescr = {'names': dtnames, 'formats': dtformats}
        dt = np.dtype(dtdescr)
        p = ndpointer(dtype=dt)
        self.assertTrue(p.from_param(np.zeros((10,), dt)))
        samedt = np.dtype(dtdescr)
        p = ndpointer(dtype=samedt)
        self.assertTrue(p.from_param(np.zeros((10,), dt)))
        dt2 = np.dtype(dtdescr, align=True)
        if dt.itemsize != dt2.itemsize:
            self.assertRaises(TypeError, p.from_param, np.zeros((10,), dt2))
        else:
            self.assertTrue(p.from_param(np.zeros((10,), dt2)))

    def test_ndim(self):
        p = ndpointer(ndim=0)
        self.assertTrue(p.from_param(np.array(1)))
        self.assertRaises(TypeError, p.from_param, np.array([1]))
        p = ndpointer(ndim=1)
        self.assertRaises(TypeError, p.from_param, np.array(1))
        self.assertTrue(p.from_param(np.array([1])))
        p = ndpointer(ndim=2)
        self.assertTrue(p.from_param(np.array([[1]])))

    def test_shape(self):
        p = ndpointer(shape=(1, 2))
        self.assertTrue(p.from_param(np.array([[1, 2]])))
        self.assertRaises(TypeError, p.from_param, np.array([[1], [2]]))
        p = ndpointer(shape=())
        self.assertTrue(p.from_param(np.array(1)))

    def test_flags(self):
        x = np.array([[1, 2], [3, 4]], order='F')
        p = ndpointer(flags='FORTRAN')
        self.assertTrue(p.from_param(x))
        p = ndpointer(flags='CONTIGUOUS')
        self.assertRaises(TypeError, p.from_param, x)
        p = ndpointer(flags=x.flags.num)
        self.assertTrue(p.from_param(x))
        self.assertRaises(TypeError, p.from_param, np.array([[1, 2], [3, 4]]))

    def test_cache(self):
        a1 = ndpointer(dtype=np.float64)
        a2 = ndpointer(dtype=np.float64)
        self.assertEqual(a1, a2)


if __name__ == "__main__":
    run_module_suite()
