"""
    Tests for the pandas.io.common functionalities
"""
import mmap
import pytest
import os
from os.path import isabs

import pandas.util.testing as tm

from pandas.io import common
from pandas.compat import is_platform_windows, StringIO

from pandas import read_csv, concat

try:
    from pathlib import Path
except ImportError:
    pass

try:
    from py.path import local as LocalPath
except ImportError:
    pass


class TestCommonIOCapabilities(object):
    data1 = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo2,12,13,14,15
bar2,12,13,14,15
"""

    def test_expand_user(self):
        filename = '~/sometest'
        expanded_name = common._expand_user(filename)

        assert expanded_name != filename
        assert isabs(expanded_name)
        assert os.path.expanduser(filename) == expanded_name

    def test_expand_user_normal_path(self):
        filename = '/somefolder/sometest'
        expanded_name = common._expand_user(filename)

        assert expanded_name == filename
        assert os.path.expanduser(filename) == expanded_name

    def test_stringify_path_pathlib(self):
        tm._skip_if_no_pathlib()

        rel_path = common._stringify_path(Path('.'))
        assert rel_path == '.'
        redundant_path = common._stringify_path(Path('foo//bar'))
        assert redundant_path == os.path.join('foo', 'bar')

    def test_stringify_path_localpath(self):
        tm._skip_if_no_localpath()

        path = os.path.join('foo', 'bar')
        abs_path = os.path.abspath(path)
        lpath = LocalPath(path)
        assert common._stringify_path(lpath) == abs_path

    def test_get_filepath_or_buffer_with_path(self):
        filename = '~/sometest'
        filepath_or_buffer, _, _ = common.get_filepath_or_buffer(filename)
        assert filepath_or_buffer != filename
        assert isabs(filepath_or_buffer)
        assert os.path.expanduser(filename) == filepath_or_buffer

    def test_get_filepath_or_buffer_with_buffer(self):
        input_buffer = StringIO()
        filepath_or_buffer, _, _ = common.get_filepath_or_buffer(input_buffer)
        assert filepath_or_buffer == input_buffer

    def test_iterator(self):
        reader = read_csv(StringIO(self.data1), chunksize=1)
        result = concat(reader, ignore_index=True)
        expected = read_csv(StringIO(self.data1))
        tm.assert_frame_equal(result, expected)

        # GH12153
        it = read_csv(StringIO(self.data1), chunksize=1)
        first = next(it)
        tm.assert_frame_equal(first, expected.iloc[[0]])
        tm.assert_frame_equal(concat(it), expected.iloc[1:])


class TestMMapWrapper(object):

    def setup_method(self, method):
        self.mmap_file = os.path.join(tm.get_data_path(),
                                      'test_mmap.csv')

    def test_constructor_bad_file(self):
        non_file = StringIO('I am not a file')
        non_file.fileno = lambda: -1

        # the error raised is different on Windows
        if is_platform_windows():
            msg = "The parameter is incorrect"
            err = OSError
        else:
            msg = "[Errno 22]"
            err = mmap.error

        tm.assert_raises_regex(err, msg, common.MMapWrapper, non_file)

        target = open(self.mmap_file, 'r')
        target.close()

        msg = "I/O operation on closed file"
        tm.assert_raises_regex(
            ValueError, msg, common.MMapWrapper, target)

    def test_get_attr(self):
        with open(self.mmap_file, 'r') as target:
            wrapper = common.MMapWrapper(target)

        attrs = dir(wrapper.mmap)
        attrs = [attr for attr in attrs
                 if not attr.startswith('__')]
        attrs.append('__next__')

        for attr in attrs:
            assert hasattr(wrapper, attr)

        assert not hasattr(wrapper, 'foo')

    def test_next(self):
        with open(self.mmap_file, 'r') as target:
            wrapper = common.MMapWrapper(target)
            lines = target.readlines()

        for line in lines:
            next_line = next(wrapper)
            assert next_line.strip() == line.strip()

        pytest.raises(StopIteration, next, wrapper)

    def test_unknown_engine(self):
        with tm.ensure_clean() as path:
            df = tm.makeDataFrame()
            df.to_csv(path)
            with tm.assert_raises_regex(ValueError, 'Unknown engine'):
                read_csv(path, engine='pyt')
