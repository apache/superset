# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Utility functions for test code that uses astroid ASTs as input."""
import contextlib
import functools
import sys
import warnings

from astroid import nodes
from astroid import util


def require_version(minver=None, maxver=None):
    """ Compare version of python interpreter to the given one. Skip the test
    if older.
    """
    def parse(string, default=None):
        string = string or default
        try:
            return tuple(int(v) for v in string.split('.'))
        except ValueError:
            util.reraise(ValueError('%s is not a correct version : should be X.Y[.Z].' % string))

    def check_require_version(f):
        current = sys.version_info[:3]
        if parse(minver, "0") < current <= parse(maxver, "4"):
            return f

        str_version = '.'.join(str(v) for v in sys.version_info)
        @functools.wraps(f)
        def new_f(self, *args, **kwargs):
            if minver is not None:
                self.skipTest('Needs Python > %s. Current version is %s.'
                              % (minver, str_version))
            elif maxver is not None:
                self.skipTest('Needs Python <= %s. Current version is %s.'
                              % (maxver, str_version))
        return new_f


    return check_require_version

def get_name_node(start_from, name, index=0):
    return [n for n in start_from.nodes_of_class(nodes.Name) if n.name == name][index]


@contextlib.contextmanager
def enable_warning(warning):
    warnings.simplefilter('always', warning)
    try:
        yield
    finally:
        # Reset it to default value, so it will take
        # into account the values from the -W flag.
        warnings.simplefilter('default', warning)
        