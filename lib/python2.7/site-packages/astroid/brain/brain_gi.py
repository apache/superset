# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for the Python 2 GObject introspection bindings.

Helps with understanding everything imported from 'gi.repository'
"""

import inspect
import itertools
import sys
import re
import warnings

from astroid import MANAGER, AstroidBuildingError, nodes
from astroid.builder import AstroidBuilder


_inspected_modules = {}

_identifier_re = r'^[A-Za-z_]\w*$'

def _gi_build_stub(parent):
    """
    Inspect the passed module recursively and build stubs for functions,
    classes, etc.
    """
    classes = {}
    functions = {}
    constants = {}
    methods = {}
    for name in dir(parent):
        if name.startswith("__"):
            continue

        # Check if this is a valid name in python
        if not re.match(_identifier_re, name):
            continue

        try:
            obj = getattr(parent, name)
        except:
            continue

        if inspect.isclass(obj):
            classes[name] = obj
        elif (inspect.isfunction(obj) or
              inspect.isbuiltin(obj)):
            functions[name] = obj
        elif (inspect.ismethod(obj) or
              inspect.ismethoddescriptor(obj)):
            methods[name] = obj
        elif (str(obj).startswith("<flags") or
              str(obj).startswith("<enum ") or
              str(obj).startswith("<GType ") or
              inspect.isdatadescriptor(obj)):
            constants[name] = 0
        elif isinstance(obj, (int, str)):
            constants[name] = obj
        elif callable(obj):
            # Fall back to a function for anything callable
            functions[name] = obj
        else:
            # Assume everything else is some manner of constant
            constants[name] = 0

    ret = ""

    if constants:
        ret += "# %s constants\n\n" % parent.__name__
    for name in sorted(constants):
        if name[0].isdigit():
            # GDK has some busted constant names like
            # Gdk.EventType.2BUTTON_PRESS
            continue

        val = constants[name]

        strval = str(val)
        if isinstance(val, str):
            strval = '"%s"' % str(val).replace("\\", "\\\\")
        ret += "%s = %s\n" % (name, strval)

    if ret:
        ret += "\n\n"
    if functions:
        ret += "# %s functions\n\n" % parent.__name__
    for name in sorted(functions):
        ret += "def %s(*args, **kwargs):\n" % name
        ret += "    pass\n"

    if ret:
        ret += "\n\n"
    if methods:
        ret += "# %s methods\n\n" % parent.__name__
    for name in sorted(methods):
        ret += "def %s(self, *args, **kwargs):\n" % name
        ret += "    pass\n"

    if ret:
        ret += "\n\n"
    if classes:
        ret += "# %s classes\n\n" % parent.__name__
    for name in sorted(classes):
        ret += "class %s(object):\n" % name

        classret = _gi_build_stub(classes[name])
        if not classret:
            classret = "pass\n"

        for line in classret.splitlines():
            ret += "    " + line + "\n"
        ret += "\n"

    return ret

def _import_gi_module(modname):
    # we only consider gi.repository submodules
    if not modname.startswith('gi.repository.'):
        raise AstroidBuildingError(modname=modname)
    # build astroid representation unless we already tried so
    if modname not in _inspected_modules:
        modnames = [modname]
        optional_modnames = []

        # GLib and GObject may have some special case handling
        # in pygobject that we need to cope with. However at
        # least as of pygobject3-3.13.91 the _glib module doesn't
        # exist anymore, so if treat these modules as optional.
        if modname == 'gi.repository.GLib':
            optional_modnames.append('gi._glib')
        elif modname == 'gi.repository.GObject':
            optional_modnames.append('gi._gobject')

        try:
            modcode = ''
            for m in itertools.chain(modnames, optional_modnames):
                try:
                    with warnings.catch_warnings():
                        # Just inspecting the code can raise gi deprecation
                        # warnings, so ignore them.
                        try:
                            from gi import PyGIDeprecationWarning, PyGIWarning
                            warnings.simplefilter("ignore", PyGIDeprecationWarning)
                            warnings.simplefilter("ignore", PyGIWarning)
                        except Exception:
                            pass

                        __import__(m)
                        modcode += _gi_build_stub(sys.modules[m])
                except ImportError:
                    if m not in optional_modnames:
                        raise
        except ImportError:
            astng = _inspected_modules[modname] = None
        else:
            astng = AstroidBuilder(MANAGER).string_build(modcode, modname)
            _inspected_modules[modname] = astng
    else:
        astng = _inspected_modules[modname]
    if astng is None:
        raise AstroidBuildingError(modname=modname)
    return astng

def _looks_like_require_version(node):
    # Return whether this looks like a call to gi.require_version(<name>, <version>)
    # Only accept function calls with two constant arguments
    if len(node.args) != 2:
        return False

    if not all(isinstance(arg, nodes.Const) for arg in node.args):
        return False

    func = node.func
    if isinstance(func, nodes.Attribute):
        if func.attrname != 'require_version':
            return False
        if isinstance(func.expr, nodes.Name) and func.expr.name == 'gi':
            return True

        return False

    if isinstance(func, nodes.Name):
        return func.name == 'require_version'

    return False

def _register_require_version(node):
    # Load the gi.require_version locally
    try:
        import gi
        gi.require_version(node.args[0].value, node.args[1].value)
    except Exception:
        pass

    return node

MANAGER.register_failed_import_hook(_import_gi_module)
MANAGER.register_transform(nodes.Call, _register_require_version, _looks_like_require_version)
