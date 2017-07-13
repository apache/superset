# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


"""Astroid hooks for numpy."""

import astroid


# TODO(cpopa): drop when understanding augmented assignments

def numpy_core_transform():
    return astroid.parse('''
    from numpy.core import numeric
    from numpy.core import fromnumeric
    from numpy.core import defchararray
    from numpy.core import records
    from numpy.core import function_base
    from numpy.core import machar
    from numpy.core import getlimits
    from numpy.core import shape_base
    __all__ = (['char', 'rec', 'memmap', 'chararray'] + numeric.__all__ +
               fromnumeric.__all__ +
               records.__all__ +
               function_base.__all__ +
               machar.__all__ +
               getlimits.__all__ +
               shape_base.__all__)
    ''')


def numpy_transform():
    return astroid.parse('''
    from numpy import core
    from numpy import matrixlib as _mat
    from numpy import lib
    __all__ = ['add_newdocs',
               'ModuleDeprecationWarning',
               'VisibleDeprecationWarning', 'linalg', 'fft', 'random',
               'ctypeslib', 'ma',
               '__version__', 'pkgload', 'PackageLoader',
               'show_config'] + core.__all__ + _mat.__all__ + lib.__all__

    ''')
    

astroid.register_module_extender(astroid.MANAGER, 'numpy.core', numpy_core_transform)
astroid.register_module_extender(astroid.MANAGER, 'numpy', numpy_transform)
