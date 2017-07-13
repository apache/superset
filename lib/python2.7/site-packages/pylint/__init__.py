# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import sys

from .__pkginfo__ import version as __version__

def run_pylint():
    """run pylint"""
    from pylint.lint import Run
    Run(sys.argv[1:])


def run_epylint():
    """run pylint"""
    from pylint.epylint import Run
    Run()

def run_pyreverse():
    """run pyreverse"""
    from pylint.pyreverse.main import Run
    Run(sys.argv[1:])

def run_symilar():
    """run symilar"""
    from pylint.checkers.similar import Run
    Run(sys.argv[1:])
