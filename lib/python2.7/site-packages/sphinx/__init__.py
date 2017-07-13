# -*- coding: utf-8 -*-
"""
    Sphinx
    ~~~~~~

    The Sphinx documentation toolchain.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

# Keep this file executable as-is in Python 3!
# (Otherwise getting the version out of it from setup.py is impossible.)

from __future__ import absolute_import

import os
import sys
import warnings
from os import path

from .deprecation import RemovedInNextVersionWarning

if False:
    # For type annotation
    from typing import List  # NOQA

# by default, all DeprecationWarning under sphinx package will be emit.
# Users can avoid this by using environment variable: PYTHONWARNINGS=
if 'PYTHONWARNINGS' not in os.environ:
    warnings.filterwarnings('default',
                            category=RemovedInNextVersionWarning, module='sphinx')
# docutils.io using mode='rU' for open
warnings.filterwarnings('ignore', "'U' mode is deprecated",
                        DeprecationWarning, module='docutils.io')

__version__ = '1.6.2'
__released__ = '1.6.2'  # used when Sphinx builds its own docs

# version info for better programmatic use
# possible values for 3rd element: 'alpha', 'beta', 'rc', 'final'
# 'final' has 0 as the last element
version_info = (1, 6, 2, 'final', 0)

package_dir = path.abspath(path.dirname(__file__))

__display_version__ = __version__  # used for command line version
if __version__.endswith('+'):
    # try to find out the commit hash if checked out from git, and append
    # it to __version__ (since we use this value from setup.py, it gets
    # automatically propagated to an installed copy as well)
    __display_version__ = __version__
    __version__ = __version__[:-1]  # remove '+' for PEP-440 version spec.
    try:
        import subprocess
        p = subprocess.Popen(['git', 'show', '-s', '--pretty=format:%h',
                              path.join(package_dir, '..')],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = p.communicate()
        if out:
            __display_version__ += '/' + out.decode().strip()
    except Exception:
        pass


def main(argv=sys.argv):
    # type: (List[str]) -> int
    if sys.argv[1:2] == ['-M']:
        return make_main(argv)
    else:
        return build_main(argv)


def build_main(argv=sys.argv):
    # type: (List[str]) -> int
    """Sphinx build "main" command-line entry."""
    if (sys.version_info[:3] < (2, 7, 0) or
       (3, 0, 0) <= sys.version_info[:3] < (3, 4, 0)):
        sys.stderr.write('Error: Sphinx requires at least Python 2.7 or 3.4 to run.\n')
        return 1
    try:
        from sphinx import cmdline
    except ImportError:
        err = sys.exc_info()[1]
        errstr = str(err)
        if errstr.lower().startswith('no module named'):
            whichmod = errstr[16:]
            hint = ''
            if whichmod.startswith('docutils'):
                whichmod = 'Docutils library'
            elif whichmod.startswith('jinja'):
                whichmod = 'Jinja2 library'
            elif whichmod == 'roman':
                whichmod = 'roman module (which is distributed with Docutils)'
                hint = ('This can happen if you upgraded docutils using\n'
                        'easy_install without uninstalling the old version'
                        'first.\n')
            else:
                whichmod += ' module'
            sys.stderr.write('Error: The %s cannot be found. '
                             'Did you install Sphinx and its dependencies '
                             'correctly?\n' % whichmod)
            if hint:
                sys.stderr.write(hint)
            return 1
        raise

    import sphinx.util.docutils
    if sphinx.util.docutils.__version_info__ < (0, 10):
        sys.stderr.write('Error: Sphinx requires at least Docutils 0.10 to '
                         'run.\n')
        return 1
    return cmdline.main(argv)  # type: ignore


def make_main(argv=sys.argv):
    # type: (List[str]) -> int
    """Sphinx build "make mode" entry."""
    from sphinx import make_mode
    return make_mode.run_make_mode(argv[2:])  # type: ignore


if __name__ == '__main__':
    sys.exit(main(sys.argv))
