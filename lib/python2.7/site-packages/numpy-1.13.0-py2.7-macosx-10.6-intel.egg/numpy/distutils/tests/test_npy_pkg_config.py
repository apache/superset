from __future__ import division, absolute_import, print_function

import os

from numpy.distutils.npy_pkg_config import read_config, parse_flags
from numpy.testing import TestCase, run_module_suite, temppath

simple = """\
[meta]
Name = foo
Description = foo lib
Version = 0.1

[default]
cflags = -I/usr/include
libs = -L/usr/lib
"""
simple_d = {'cflags': '-I/usr/include', 'libflags': '-L/usr/lib',
        'version': '0.1', 'name': 'foo'}

simple_variable = """\
[meta]
Name = foo
Description = foo lib
Version = 0.1

[variables]
prefix = /foo/bar
libdir = ${prefix}/lib
includedir = ${prefix}/include

[default]
cflags = -I${includedir}
libs = -L${libdir}
"""
simple_variable_d = {'cflags': '-I/foo/bar/include', 'libflags': '-L/foo/bar/lib',
        'version': '0.1', 'name': 'foo'}

class TestLibraryInfo(TestCase):
    def test_simple(self):
        with temppath('foo.ini') as path:
            with open(path,  'w') as f:
                f.write(simple)
            pkg = os.path.splitext(path)[0]
            out = read_config(pkg)

        self.assertTrue(out.cflags() == simple_d['cflags'])
        self.assertTrue(out.libs() == simple_d['libflags'])
        self.assertTrue(out.name == simple_d['name'])
        self.assertTrue(out.version == simple_d['version'])

    def test_simple_variable(self):
        with temppath('foo.ini') as path:
            with open(path,  'w') as f:
                f.write(simple_variable)
            pkg = os.path.splitext(path)[0]
            out = read_config(pkg)

        self.assertTrue(out.cflags() == simple_variable_d['cflags'])
        self.assertTrue(out.libs() == simple_variable_d['libflags'])
        self.assertTrue(out.name == simple_variable_d['name'])
        self.assertTrue(out.version == simple_variable_d['version'])
        out.vars['prefix'] = '/Users/david'
        self.assertTrue(out.cflags() == '-I/Users/david/include')

class TestParseFlags(TestCase):
    def test_simple_cflags(self):
        d = parse_flags("-I/usr/include")
        self.assertTrue(d['include_dirs'] == ['/usr/include'])

        d = parse_flags("-I/usr/include -DFOO")
        self.assertTrue(d['include_dirs'] == ['/usr/include'])
        self.assertTrue(d['macros'] == ['FOO'])

        d = parse_flags("-I /usr/include -DFOO")
        self.assertTrue(d['include_dirs'] == ['/usr/include'])
        self.assertTrue(d['macros'] == ['FOO'])

    def test_simple_lflags(self):
        d = parse_flags("-L/usr/lib -lfoo -L/usr/lib -lbar")
        self.assertTrue(d['library_dirs'] == ['/usr/lib', '/usr/lib'])
        self.assertTrue(d['libraries'] == ['foo', 'bar'])

        d = parse_flags("-L /usr/lib -lfoo -L/usr/lib -lbar")
        self.assertTrue(d['library_dirs'] == ['/usr/lib', '/usr/lib'])
        self.assertTrue(d['libraries'] == ['foo', 'bar'])


if __name__ == '__main__':
    run_module_suite()
