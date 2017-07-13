#!/usr/bin/env python
"""Fortran to Python Interface Generator.

"""
from __future__ import division, absolute_import, print_function

__all__ = ['run_main', 'compile', 'f2py_testing']

import sys

from . import f2py2e
from . import f2py_testing
from . import diagnose

run_main = f2py2e.run_main
main = f2py2e.main


def compile(source,
            modulename='untitled',
            extra_args='',
            verbose=True,
            source_fn=None,
            extension='.f'
           ):
    """
    Build extension module from processing source with f2py.

    Parameters
    ----------
    source : str
        Fortran source of module / subroutine to compile
    modulename : str, optional
        The name of the compiled python module
    extra_args : str, optional
        Additional parameters passed to f2py
    verbose : bool, optional
        Print f2py output to screen
    source_fn : str, optional
        Name of the file where the fortran source is written.
        The default is to use a temporary file with the extension
        provided by the `extension` parameter
    extension : {'.f', '.f90'}, optional
        Filename extension if `source_fn` is not provided.
        The extension tells which fortran standard is used.
        The default is `.f`, which implies F77 standard.

        .. versionadded:: 1.11.0

    """
    from numpy.distutils.exec_command import exec_command
    import tempfile
    if source_fn is None:
        f = tempfile.NamedTemporaryFile(suffix=extension)
    else:
        f = open(source_fn, 'w')

    try:
        f.write(source)
        f.flush()

        args = ' -c -m {} {} {}'.format(modulename, f.name, extra_args)
        c = '{} -c "import numpy.f2py as f2py2e;f2py2e.main()" {}'
        c = c.format(sys.executable, args)
        status, output = exec_command(c)
        if verbose:
            print(output)
    finally:
        f.close()
    return status

from numpy.testing.nosetester import _numpy_tester
test = _numpy_tester().test
bench = _numpy_tester().bench
