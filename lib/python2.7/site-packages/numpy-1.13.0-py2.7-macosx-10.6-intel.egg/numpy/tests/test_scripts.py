""" Test scripts

Test that we can run executable scripts that have been installed with numpy.
"""
from __future__ import division, print_function, absolute_import

import os
from os.path import join as pathjoin, isfile, dirname, basename
import sys
from subprocess import Popen, PIPE
import numpy as np
from numpy.compat.py3k import basestring
from nose.tools import assert_equal
from numpy.testing.decorators import skipif
from numpy.testing import assert_

is_inplace = isfile(pathjoin(dirname(np.__file__),  '..', 'setup.py'))


def run_command(cmd, check_code=True):
    """ Run command sequence `cmd` returning exit code, stdout, stderr

    Parameters
    ----------
    cmd : str or sequence
        string with command name or sequence of strings defining command
    check_code : {True, False}, optional
        If True, raise error for non-zero return code

    Returns
    -------
    returncode : int
        return code from execution of `cmd`
    stdout : bytes (python 3) or str (python 2)
        stdout from `cmd`
    stderr : bytes (python 3) or str (python 2)
        stderr from `cmd`

    Raises
    ------
    RuntimeError
        If `check_code` is True, and return code !=0
    """
    cmd = [cmd] if isinstance(cmd, basestring) else list(cmd)
    if os.name == 'nt':
        # Quote any arguments with spaces. The quotes delimit the arguments
        # on Windows, and the arguments might be file paths with spaces.
        # On Unix the list elements are each separate arguments.
        cmd = ['"{0}"'.format(c) if ' ' in c else c for c in cmd]
    proc = Popen(cmd, stdout=PIPE, stderr=PIPE)
    stdout, stderr = proc.communicate()
    if proc.poll() is None:
        proc.terminate()
    if check_code and proc.returncode != 0:
        raise RuntimeError('\n'.join(
            ['Command "{0}" failed with',
             'stdout', '------', '{1}', '',
             'stderr', '------', '{2}']).format(cmd, stdout, stderr))
    return proc.returncode, stdout, stderr


@skipif(is_inplace)
def test_f2py():
    # test that we can run f2py script
    if sys.platform == 'win32':
        exe_dir = dirname(sys.executable)

        if exe_dir.endswith('Scripts'): # virtualenv
            f2py_cmd = r"%s\f2py.py" % exe_dir
        else:
            f2py_cmd = r"%s\Scripts\f2py.py" % exe_dir

        code, stdout, stderr = run_command([sys.executable, f2py_cmd, '-v'])
        success = stdout.strip() == b'2'
        assert_(success, "Warning: f2py not found in path")
    else:
        version = sys.version_info
        major = str(version.major)
        minor = str(version.minor)

        f2py_cmds = ('f2py', 'f2py' + major, 'f2py' + major + '.' + minor)
        success = False

        for f2py_cmd in f2py_cmds:
            try:
                code, stdout, stderr = run_command([f2py_cmd, '-v'])
                assert_equal(stdout.strip(), b'2')
                success = True
                break
            except:
                pass
        msg = "Warning: neither %s nor %s nor %s found in path" % f2py_cmds
        assert_(success, msg)
