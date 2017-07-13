from __future__ import division, absolute_import, print_function

import sys

import numpy as np
from numpy.testing import (
    TestCase, run_module_suite, assert_, assert_equal
)

# This is the structure of the table used for plain objects:
#
# +-+-+-+
# |x|y|z|
# +-+-+-+

# Structure of a plain array description:
Pdescr = [
    ('x', 'i4', (2,)),
    ('y', 'f8', (2, 2)),
    ('z', 'u1')]

# A plain list of tuples with values for testing:
PbufferT = [
    # x     y                  z
    ([3, 2], [[6., 4.], [6., 4.]], 8),
    ([4, 3], [[7., 5.], [7., 5.]], 9),
    ]


# This is the structure of the table used for nested objects (DON'T PANIC!):
#
# +-+---------------------------------+-----+----------+-+-+
# |x|Info                             |color|info      |y|z|
# | +-----+--+----------------+----+--+     +----+-----+ | |
# | |value|y2|Info2           |name|z2|     |Name|Value| | |
# | |     |  +----+-----+--+--+    |  |     |    |     | | |
# | |     |  |name|value|y3|z3|    |  |     |    |     | | |
# +-+-----+--+----+-----+--+--+----+--+-----+----+-----+-+-+
#

# The corresponding nested array description:
Ndescr = [
    ('x', 'i4', (2,)),
    ('Info', [
        ('value', 'c16'),
        ('y2', 'f8'),
        ('Info2', [
            ('name', 'S2'),
            ('value', 'c16', (2,)),
            ('y3', 'f8', (2,)),
            ('z3', 'u4', (2,))]),
        ('name', 'S2'),
        ('z2', 'b1')]),
    ('color', 'S2'),
    ('info', [
        ('Name', 'U8'),
        ('Value', 'c16')]),
    ('y', 'f8', (2, 2)),
    ('z', 'u1')]

NbufferT = [
    # x     Info                                                color info        y                  z
    #       value y2 Info2                            name z2         Name Value
    #                name   value    y3       z3
    ([3, 2], (6j, 6., (b'nn', [6j, 4j], [6., 4.], [1, 2]), b'NN', True), b'cc', (u'NN', 6j), [[6., 4.], [6., 4.]], 8),
    ([4, 3], (7j, 7., (b'oo', [7j, 5j], [7., 5.], [2, 1]), b'OO', False), b'dd', (u'OO', 7j), [[7., 5.], [7., 5.]], 9),
    ]


byteorder = {'little':'<', 'big':'>'}[sys.byteorder]

def normalize_descr(descr):
    "Normalize a description adding the platform byteorder."

    out = []
    for item in descr:
        dtype = item[1]
        if isinstance(dtype, str):
            if dtype[0] not in ['|', '<', '>']:
                onebyte = dtype[1:] == "1"
                if onebyte or dtype[0] in ['S', 'V', 'b']:
                    dtype = "|" + dtype
                else:
                    dtype = byteorder + dtype
            if len(item) > 2 and np.prod(item[2]) > 1:
                nitem = (item[0], dtype, item[2])
            else:
                nitem = (item[0], dtype)
            out.append(nitem)
        elif isinstance(item[1], list):
            l = []
            for j in normalize_descr(item[1]):
                l.append(j)
            out.append((item[0], l))
        else:
            raise ValueError("Expected a str or list and got %s" %
                             (type(item)))
    return out


############################################################
#    Creation tests
############################################################

class create_zeros(object):
    """Check the creation of heterogeneous arrays zero-valued"""

    def test_zeros0D(self):
        """Check creation of 0-dimensional objects"""
        h = np.zeros((), dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        self.assertTrue(h.dtype.fields['x'][0].name[:4] == 'void')
        self.assertTrue(h.dtype.fields['x'][0].char == 'V')
        self.assertTrue(h.dtype.fields['x'][0].type == np.void)
        # A small check that data is ok
        assert_equal(h['z'], np.zeros((), dtype='u1'))

    def test_zerosSD(self):
        """Check creation of single-dimensional objects"""
        h = np.zeros((2,), dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        self.assertTrue(h.dtype['y'].name[:4] == 'void')
        self.assertTrue(h.dtype['y'].char == 'V')
        self.assertTrue(h.dtype['y'].type == np.void)
        # A small check that data is ok
        assert_equal(h['z'], np.zeros((2,), dtype='u1'))

    def test_zerosMD(self):
        """Check creation of multi-dimensional objects"""
        h = np.zeros((2, 3), dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        self.assertTrue(h.dtype['z'].name == 'uint8')
        self.assertTrue(h.dtype['z'].char == 'B')
        self.assertTrue(h.dtype['z'].type == np.uint8)
        # A small check that data is ok
        assert_equal(h['z'], np.zeros((2, 3), dtype='u1'))


class test_create_zeros_plain(create_zeros, TestCase):
    """Check the creation of heterogeneous arrays zero-valued (plain)"""
    _descr = Pdescr

class test_create_zeros_nested(create_zeros, TestCase):
    """Check the creation of heterogeneous arrays zero-valued (nested)"""
    _descr = Ndescr


class create_values(object):
    """Check the creation of heterogeneous arrays with values"""

    def test_tuple(self):
        """Check creation from tuples"""
        h = np.array(self._buffer, dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        if self.multiple_rows:
            self.assertTrue(h.shape == (2,))
        else:
            self.assertTrue(h.shape == ())

    def test_list_of_tuple(self):
        """Check creation from list of tuples"""
        h = np.array([self._buffer], dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        if self.multiple_rows:
            self.assertTrue(h.shape == (1, 2))
        else:
            self.assertTrue(h.shape == (1,))

    def test_list_of_list_of_tuple(self):
        """Check creation from list of list of tuples"""
        h = np.array([[self._buffer]], dtype=self._descr)
        self.assertTrue(normalize_descr(self._descr) == h.dtype.descr)
        if self.multiple_rows:
            self.assertTrue(h.shape == (1, 1, 2))
        else:
            self.assertTrue(h.shape == (1, 1))


class test_create_values_plain_single(create_values, TestCase):
    """Check the creation of heterogeneous arrays (plain, single row)"""
    _descr = Pdescr
    multiple_rows = 0
    _buffer = PbufferT[0]

class test_create_values_plain_multiple(create_values, TestCase):
    """Check the creation of heterogeneous arrays (plain, multiple rows)"""
    _descr = Pdescr
    multiple_rows = 1
    _buffer = PbufferT

class test_create_values_nested_single(create_values, TestCase):
    """Check the creation of heterogeneous arrays (nested, single row)"""
    _descr = Ndescr
    multiple_rows = 0
    _buffer = NbufferT[0]

class test_create_values_nested_multiple(create_values, TestCase):
    """Check the creation of heterogeneous arrays (nested, multiple rows)"""
    _descr = Ndescr
    multiple_rows = 1
    _buffer = NbufferT


############################################################
#    Reading tests
############################################################

class read_values_plain(object):
    """Check the reading of values in heterogeneous arrays (plain)"""

    def test_access_fields(self):
        h = np.array(self._buffer, dtype=self._descr)
        if not self.multiple_rows:
            self.assertTrue(h.shape == ())
            assert_equal(h['x'], np.array(self._buffer[0], dtype='i4'))
            assert_equal(h['y'], np.array(self._buffer[1], dtype='f8'))
            assert_equal(h['z'], np.array(self._buffer[2], dtype='u1'))
        else:
            self.assertTrue(len(h) == 2)
            assert_equal(h['x'], np.array([self._buffer[0][0],
                                             self._buffer[1][0]], dtype='i4'))
            assert_equal(h['y'], np.array([self._buffer[0][1],
                                             self._buffer[1][1]], dtype='f8'))
            assert_equal(h['z'], np.array([self._buffer[0][2],
                                             self._buffer[1][2]], dtype='u1'))


class test_read_values_plain_single(read_values_plain, TestCase):
    """Check the creation of heterogeneous arrays (plain, single row)"""
    _descr = Pdescr
    multiple_rows = 0
    _buffer = PbufferT[0]

class test_read_values_plain_multiple(read_values_plain, TestCase):
    """Check the values of heterogeneous arrays (plain, multiple rows)"""
    _descr = Pdescr
    multiple_rows = 1
    _buffer = PbufferT

class read_values_nested(object):
    """Check the reading of values in heterogeneous arrays (nested)"""

    def test_access_top_fields(self):
        """Check reading the top fields of a nested array"""
        h = np.array(self._buffer, dtype=self._descr)
        if not self.multiple_rows:
            self.assertTrue(h.shape == ())
            assert_equal(h['x'], np.array(self._buffer[0], dtype='i4'))
            assert_equal(h['y'], np.array(self._buffer[4], dtype='f8'))
            assert_equal(h['z'], np.array(self._buffer[5], dtype='u1'))
        else:
            self.assertTrue(len(h) == 2)
            assert_equal(h['x'], np.array([self._buffer[0][0],
                                           self._buffer[1][0]], dtype='i4'))
            assert_equal(h['y'], np.array([self._buffer[0][4],
                                           self._buffer[1][4]], dtype='f8'))
            assert_equal(h['z'], np.array([self._buffer[0][5],
                                           self._buffer[1][5]], dtype='u1'))

    def test_nested1_acessors(self):
        """Check reading the nested fields of a nested array (1st level)"""
        h = np.array(self._buffer, dtype=self._descr)
        if not self.multiple_rows:
            assert_equal(h['Info']['value'],
                         np.array(self._buffer[1][0], dtype='c16'))
            assert_equal(h['Info']['y2'],
                         np.array(self._buffer[1][1], dtype='f8'))
            assert_equal(h['info']['Name'],
                         np.array(self._buffer[3][0], dtype='U2'))
            assert_equal(h['info']['Value'],
                         np.array(self._buffer[3][1], dtype='c16'))
        else:
            assert_equal(h['Info']['value'],
                         np.array([self._buffer[0][1][0],
                                self._buffer[1][1][0]],
                                dtype='c16'))
            assert_equal(h['Info']['y2'],
                         np.array([self._buffer[0][1][1],
                                self._buffer[1][1][1]],
                                dtype='f8'))
            assert_equal(h['info']['Name'],
                         np.array([self._buffer[0][3][0],
                                self._buffer[1][3][0]],
                               dtype='U2'))
            assert_equal(h['info']['Value'],
                         np.array([self._buffer[0][3][1],
                                self._buffer[1][3][1]],
                               dtype='c16'))

    def test_nested2_acessors(self):
        """Check reading the nested fields of a nested array (2nd level)"""
        h = np.array(self._buffer, dtype=self._descr)
        if not self.multiple_rows:
            assert_equal(h['Info']['Info2']['value'],
                         np.array(self._buffer[1][2][1], dtype='c16'))
            assert_equal(h['Info']['Info2']['z3'],
                         np.array(self._buffer[1][2][3], dtype='u4'))
        else:
            assert_equal(h['Info']['Info2']['value'],
                         np.array([self._buffer[0][1][2][1],
                                self._buffer[1][1][2][1]],
                               dtype='c16'))
            assert_equal(h['Info']['Info2']['z3'],
                         np.array([self._buffer[0][1][2][3],
                                self._buffer[1][1][2][3]],
                               dtype='u4'))

    def test_nested1_descriptor(self):
        """Check access nested descriptors of a nested array (1st level)"""
        h = np.array(self._buffer, dtype=self._descr)
        self.assertTrue(h.dtype['Info']['value'].name == 'complex128')
        self.assertTrue(h.dtype['Info']['y2'].name == 'float64')
        if sys.version_info[0] >= 3:
            self.assertTrue(h.dtype['info']['Name'].name == 'str256')
        else:
            self.assertTrue(h.dtype['info']['Name'].name == 'unicode256')
        self.assertTrue(h.dtype['info']['Value'].name == 'complex128')

    def test_nested2_descriptor(self):
        """Check access nested descriptors of a nested array (2nd level)"""
        h = np.array(self._buffer, dtype=self._descr)
        self.assertTrue(h.dtype['Info']['Info2']['value'].name == 'void256')
        self.assertTrue(h.dtype['Info']['Info2']['z3'].name == 'void64')


class test_read_values_nested_single(read_values_nested, TestCase):
    """Check the values of heterogeneous arrays (nested, single row)"""
    _descr = Ndescr
    multiple_rows = False
    _buffer = NbufferT[0]

class test_read_values_nested_multiple(read_values_nested, TestCase):
    """Check the values of heterogeneous arrays (nested, multiple rows)"""
    _descr = Ndescr
    multiple_rows = True
    _buffer = NbufferT

class TestEmptyField(TestCase):
    def test_assign(self):
        a = np.arange(10, dtype=np.float32)
        a.dtype = [("int",   "<0i4"), ("float", "<2f4")]
        assert_(a['int'].shape == (5, 0))
        assert_(a['float'].shape == (5, 2))

class TestCommonType(TestCase):
    def test_scalar_loses1(self):
        res = np.find_common_type(['f4', 'f4', 'i2'], ['f8'])
        assert_(res == 'f4')

    def test_scalar_loses2(self):
        res = np.find_common_type(['f4', 'f4'], ['i8'])
        assert_(res == 'f4')

    def test_scalar_wins(self):
        res = np.find_common_type(['f4', 'f4', 'i2'], ['c8'])
        assert_(res == 'c8')

    def test_scalar_wins2(self):
        res = np.find_common_type(['u4', 'i4', 'i4'], ['f4'])
        assert_(res == 'f8')

    def test_scalar_wins3(self):  # doesn't go up to 'f16' on purpose
        res = np.find_common_type(['u8', 'i8', 'i8'], ['f8'])
        assert_(res == 'f8')

class TestMultipleFields(TestCase):
    def setUp(self):
        self.ary = np.array([(1, 2, 3, 4), (5, 6, 7, 8)], dtype='i4,f4,i2,c8')

    def _bad_call(self):
        return self.ary['f0', 'f1']

    def test_no_tuple(self):
        self.assertRaises(IndexError, self._bad_call)

    def test_return(self):
        res = self.ary[['f0', 'f2']].tolist()
        assert_(res == [(1, 3), (5, 7)])

if __name__ == "__main__":
    run_module_suite()
