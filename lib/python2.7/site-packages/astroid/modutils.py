# -*- coding: utf-8 -*-
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2015 Radosław Ganczarek <radoslaw@ganczarek.in>
# Copyright (c) 2016 Jakub Wilk <jwilk@jwilk.net>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Python modules manipulation utility functions.

:type PY_SOURCE_EXTS: tuple(str)
:var PY_SOURCE_EXTS: list of possible python source file extension

:type STD_LIB_DIRS: set of str
:var STD_LIB_DIRS: directories where standard modules are located

:type BUILTIN_MODULES: dict
:var BUILTIN_MODULES: dictionary with builtin module names has key
"""
import imp
import os
import platform
import sys
from distutils.sysconfig import get_python_lib # pylint: disable=import-error
# pylint: disable=import-error, no-name-in-module
from distutils.errors import DistutilsPlatformError
# distutils is replaced by virtualenv with a module that does
# weird path manipulations in order to get to the
# real distutils module.

import six

from .interpreter._import import spec
from .interpreter._import import util

if sys.platform.startswith('win'):
    PY_SOURCE_EXTS = ('py', 'pyw')
    PY_COMPILED_EXTS = ('dll', 'pyd')
else:
    PY_SOURCE_EXTS = ('py',)
    PY_COMPILED_EXTS = ('so',)


try:
    # The explicit sys.prefix is to work around a patch in virtualenv that
    # replaces the 'real' sys.prefix (i.e. the location of the binary)
    # with the prefix from which the virtualenv was created. This throws
    # off the detection logic for standard library modules, thus the
    # workaround.
    STD_LIB_DIRS = set([
        get_python_lib(standard_lib=True, prefix=sys.prefix),
        # Take care of installations where exec_prefix != prefix.
        get_python_lib(standard_lib=True, prefix=sys.exec_prefix),
        get_python_lib(standard_lib=True)])
# get_python_lib(standard_lib=1) is not available on pypy, set STD_LIB_DIR to
# non-valid path, see https://bugs.pypy.org/issue1164
except DistutilsPlatformError:
    STD_LIB_DIRS = set()

if os.name == 'nt':
    STD_LIB_DIRS.add(os.path.join(sys.prefix, 'dlls'))
    try:
        # real_prefix is defined when running inside virtual environments,
        # created with the **virtualenv** library.
        STD_LIB_DIRS.add(os.path.join(sys.real_prefix, 'dlls'))
    except AttributeError:
        # sys.base_exec_prefix is always defined, but in a virtual environment
        # created with the stdlib **venv** module, it points to the original
        # installation, if the virtual env is activated.
        try:
            STD_LIB_DIRS.add(os.path.join(sys.base_exec_prefix, 'dlls'))
        except AttributeError:
            pass

if platform.python_implementation() == 'PyPy':
    _root = os.path.join(sys.prefix, 'lib_pypy')
    STD_LIB_DIRS.add(_root)
    try:
        # real_prefix is defined when running inside virtualenv.
        STD_LIB_DIRS.add(os.path.join(sys.real_prefix, 'lib_pypy'))
    except AttributeError:
        pass
    del _root
if os.name == 'posix':
    # Need the real prefix is we're under a virtualenv, otherwise
    # the usual one will do.
    try:
        prefix = sys.real_prefix
    except AttributeError:
        prefix = sys.prefix

    def _posix_path(path):
        base_python = 'python%d.%d' % sys.version_info[:2]
        return os.path.join(prefix, path, base_python)

    STD_LIB_DIRS.add(_posix_path('lib'))
    if sys.maxsize > 2**32:
        # This tries to fix a problem with /usr/lib64 builds,
        # where systems are running both 32-bit and 64-bit code
        # on the same machine, which reflects into the places where
        # standard library could be found. More details can be found
        # here http://bugs.python.org/issue1294959.
        # An easy reproducing case would be
        # https://github.com/PyCQA/pylint/issues/712#issuecomment-163178753
        STD_LIB_DIRS.add(_posix_path('lib64'))

EXT_LIB_DIR = get_python_lib()
IS_JYTHON = platform.python_implementation() == 'Jython'
BUILTIN_MODULES = dict.fromkeys(sys.builtin_module_names, True)


class NoSourceFile(Exception):
    """exception raised when we are not able to get a python
    source file for a precompiled file
    """

def _normalize_path(path):
    return os.path.normcase(os.path.abspath(path))


def _canonicalize_path(path):
    return os.path.realpath(os.path.expanduser(path))


def _path_from_filename(filename, is_jython=IS_JYTHON):
    if not is_jython:
        if sys.version_info > (3, 0):
            return filename
        else:
            if filename.endswith(".pyc"):
                return filename[:-1]
            return filename
    head, has_pyclass, _ = filename.partition("$py.class")
    if has_pyclass:
        return head + ".py"
    return filename


def _handle_blacklist(blacklist, dirnames, filenames):
    """remove files/directories in the black list

    dirnames/filenames are usually from os.walk
    """
    for norecurs in blacklist:
        if norecurs in dirnames:
            dirnames.remove(norecurs)
        elif norecurs in filenames:
            filenames.remove(norecurs)


_NORM_PATH_CACHE = {}

def _cache_normalize_path(path):
    """abspath with caching"""
    # _module_file calls abspath on every path in sys.path every time it's
    # called; on a larger codebase this easily adds up to half a second just
    # assembling path components. This cache alleviates that.
    try:
        return _NORM_PATH_CACHE[path]
    except KeyError:
        if not path: # don't cache result for ''
            return _normalize_path(path)
        result = _NORM_PATH_CACHE[path] = _normalize_path(path)
        return result

def load_module_from_name(dotted_name, path=None, use_sys=True):
    """Load a Python module from its name.

    :type dotted_name: str
    :param dotted_name: python name of a module or package

    :type path: list or None
    :param path:
      optional list of path where the module or package should be
      searched (use sys.path if nothing or None is given)

    :type use_sys: bool
    :param use_sys:
      boolean indicating whether the sys.modules dictionary should be
      used or not


    :raise ImportError: if the module or package is not found

    :rtype: module
    :return: the loaded module
    """
    return load_module_from_modpath(dotted_name.split('.'), path, use_sys)


def load_module_from_modpath(parts, path=None, use_sys=1):
    """Load a python module from its split name.

    :type parts: list(str) or tuple(str)
    :param parts:
      python name of a module or package split on '.'

    :type path: list or None
    :param path:
      optional list of path where the module or package should be
      searched (use sys.path if nothing or None is given)

    :type use_sys: bool
    :param use_sys:
      boolean indicating whether the sys.modules dictionary should be used or not

    :raise ImportError: if the module or package is not found

    :rtype: module
    :return: the loaded module
    """
    if use_sys:
        try:
            return sys.modules['.'.join(parts)]
        except KeyError:
            pass
    modpath = []
    prevmodule = None
    for part in parts:
        modpath.append(part)
        curname = '.'.join(modpath)
        module = None
        if len(modpath) != len(parts):
            # even with use_sys=False, should try to get outer packages from sys.modules
            module = sys.modules.get(curname)
        elif use_sys:
            # because it may have been indirectly loaded through a parent
            module = sys.modules.get(curname)
        if module is None:
            mp_file, mp_filename, mp_desc = imp.find_module(part, path)
            module = imp.load_module(curname, mp_file, mp_filename, mp_desc)
            # mp_file still needs to be closed.
            if mp_file:
                mp_file.close()
        if prevmodule:
            setattr(prevmodule, part, module)
        _file = getattr(module, '__file__', '')
        prevmodule = module
        if not _file and util.is_namespace(curname):
            continue
        if not _file and len(modpath) != len(parts):
            raise ImportError('no module in %s' % '.'.join(parts[len(modpath):]))
        path = [os.path.dirname(_file)]
    return module


def load_module_from_file(filepath, path=None, use_sys=True, extrapath=None):
    """Load a Python module from it's path.

    :type filepath: str
    :param filepath: path to the python module or package

    :type path: list or None
    :param path:
      optional list of path where the module or package should be
      searched (use sys.path if nothing or None is given)

    :type use_sys: bool
    :param use_sys:
      boolean indicating whether the sys.modules dictionary should be
      used or not


    :raise ImportError: if the module or package is not found

    :rtype: module
    :return: the loaded module
    """
    modpath = modpath_from_file(filepath, extrapath)
    return load_module_from_modpath(modpath, path, use_sys)


def check_modpath_has_init(path, mod_path):
    """check there are some __init__.py all along the way"""
    modpath = []
    for part in mod_path:
        modpath.append(part)
        path = os.path.join(path, part)
        if not _has_init(path):
            old_namespace = util.is_namespace('.'.join(modpath))
            if not old_namespace:
                return False
    return True


def modpath_from_file_with_callback(filename, extrapath=None, is_package_cb=None):
    filename = _path_from_filename(filename)
    filename = os.path.realpath(os.path.expanduser(filename))
    base = os.path.splitext(filename)[0]

    if extrapath is not None:
        for path_ in six.moves.map(_canonicalize_path, extrapath):
            path = os.path.abspath(path_)
            if path and os.path.normcase(base[:len(path)]) == os.path.normcase(path):
                submodpath = [pkg for pkg in base[len(path):].split(os.sep)
                              if pkg]
                if is_package_cb(path, submodpath[:-1]):
                    return extrapath[path_].split('.') + submodpath

    for path in six.moves.map(_canonicalize_path, sys.path):
        path = _cache_normalize_path(path)
        if path and os.path.normcase(base).startswith(path):
            modpath = [pkg for pkg in base[len(path):].split(os.sep) if pkg]
            if is_package_cb(path, modpath[:-1]):
                return modpath

    raise ImportError('Unable to find module for %s in %s' % (
        filename, ', \n'.join(sys.path)))



def modpath_from_file(filename, extrapath=None):
    """given a file path return the corresponding split module's name
    (i.e name of a module or package split on '.')

    :type filename: str
    :param filename: file's path for which we want the module's name

    :type extrapath: dict
    :param extrapath:
      optional extra search path, with path as key and package name for the path
      as value. This is usually useful to handle package split in multiple
      directories using __path__ trick.


    :raise ImportError:
      if the corresponding module's name has not been found

    :rtype: list(str)
    :return: the corresponding split module's name
    """
    return modpath_from_file_with_callback(filename, extrapath, check_modpath_has_init)


def file_from_modpath(modpath, path=None, context_file=None):
    return file_info_from_modpath(modpath, path, context_file).location

def file_info_from_modpath(modpath, path=None, context_file=None):
    """given a mod path (i.e. split module / package name), return the
    corresponding file, giving priority to source file over precompiled
    file if it exists

    :type modpath: list or tuple
    :param modpath:
      split module's name (i.e name of a module or package split
      on '.')
      (this means explicit relative imports that start with dots have
      empty strings in this list!)

    :type path: list or None
    :param path:
      optional list of path where the module or package should be
      searched (use sys.path if nothing or None is given)

    :type context_file: str or None
    :param context_file:
      context file to consider, necessary if the identifier has been
      introduced using a relative import unresolvable in the actual
      context (i.e. modutils)

    :raise ImportError: if there is no such module in the directory

    :rtype: (str or None, import type)
    :return:
      the path to the module's file or None if it's an integrated
      builtin module such as 'sys'
    """
    if context_file is not None:
        context = os.path.dirname(context_file)
    else:
        context = context_file
    if modpath[0] == 'xml':
        # handle _xmlplus
        try:
            return _spec_from_modpath(['_xmlplus'] + modpath[1:], path, context)
        except ImportError:
            return _spec_from_modpath(modpath, path, context)
    elif modpath == ['os', 'path']:
        # FIXME: currently ignoring search_path...
        return spec.ModuleSpec(name='os.path', location=os.path.__file__, module_type=imp.PY_SOURCE)
    return _spec_from_modpath(modpath, path, context)


def get_module_part(dotted_name, context_file=None):
    """given a dotted name return the module part of the name :

    >>> get_module_part('astroid.as_string.dump')
    'astroid.as_string'

    :type dotted_name: str
    :param dotted_name: full name of the identifier we are interested in

    :type context_file: str or None
    :param context_file:
      context file to consider, necessary if the identifier has been
      introduced using a relative import unresolvable in the actual
      context (i.e. modutils)


    :raise ImportError: if there is no such module in the directory

    :rtype: str or None
    :return:
      the module part of the name or None if we have not been able at
      all to import the given name

    XXX: deprecated, since it doesn't handle package precedence over module
    (see #10066)
    """
    # os.path trick
    if dotted_name.startswith('os.path'):
        return 'os.path'
    parts = dotted_name.split('.')
    if context_file is not None:
        # first check for builtin module which won't be considered latter
        # in that case (path != None)
        if parts[0] in BUILTIN_MODULES:
            if len(parts) > 2:
                raise ImportError(dotted_name)
            return parts[0]
        # don't use += or insert, we want a new list to be created !
    path = None
    starti = 0
    if parts[0] == '':
        assert context_file is not None, \
                'explicit relative import, but no context_file?'
        path = [] # prevent resolving the import non-relatively
        starti = 1
    while parts[starti] == '': # for all further dots: change context
        starti += 1
        context_file = os.path.dirname(context_file)
    for i in range(starti, len(parts)):
        try:
            file_from_modpath(parts[starti:i+1], path=path,
                              context_file=context_file)
        except ImportError:
            if i < max(1, len(parts) - 2):
                raise
            return '.'.join(parts[:i])
    return dotted_name


def get_module_files(src_directory, blacklist, list_all=False):
    """given a package directory return a list of all available python
    module's files in the package and its subpackages

    :type src_directory: str
    :param src_directory:
      path of the directory corresponding to the package

    :type blacklist: list or tuple
    :param blacklist: iterable
      list of files or directories to ignore.

    :type list_all: bool
    :param list_all:
        get files from all paths, including ones without __init__.py

    :rtype: list
    :return:
      the list of all available python module's files in the package and
      its subpackages
    """
    files = []
    for directory, dirnames, filenames in os.walk(src_directory):
        _handle_blacklist(blacklist, dirnames, filenames)
        # check for __init__.py
        if not list_all and '__init__.py' not in filenames:
            dirnames[:] = ()
            continue
        for filename in filenames:
            if _is_python_file(filename):
                src = os.path.join(directory, filename)
                files.append(src)
    return files


def get_source_file(filename, include_no_ext=False):
    """given a python module's file name return the matching source file
    name (the filename will be returned identically if it's a already an
    absolute path to a python source file...)

    :type filename: str
    :param filename: python module's file name


    :raise NoSourceFile: if no source file exists on the file system

    :rtype: str
    :return: the absolute path of the source file if it exists
    """
    filename = os.path.abspath(_path_from_filename(filename))
    base, orig_ext = os.path.splitext(filename)
    for ext in PY_SOURCE_EXTS:
        source_path = '%s.%s' % (base, ext)
        if os.path.exists(source_path):
            return source_path
    if include_no_ext and not orig_ext and os.path.exists(base):
        return base
    raise NoSourceFile(filename)


def is_python_source(filename):
    """
    rtype: bool
    return: True if the filename is a python source file
    """
    return os.path.splitext(filename)[1][1:] in PY_SOURCE_EXTS


def is_standard_module(modname, std_path=None):
    """try to guess if a module is a standard python module (by default,
    see `std_path` parameter's description)

    :type modname: str
    :param modname: name of the module we are interested in

    :type std_path: list(str) or tuple(str)
    :param std_path: list of path considered has standard


    :rtype: bool
    :return:
      true if the module:
      - is located on the path listed in one of the directory in `std_path`
      - is a built-in module
    """
    modname = modname.split('.')[0]
    try:
        filename = file_from_modpath([modname])
    except ImportError:
        # import failed, i'm probably not so wrong by supposing it's
        # not standard...
        return False
    # modules which are not living in a file are considered standard
    # (sys and __builtin__ for instance)
    if filename is None:
        # we assume there are no namespaces in stdlib
        return not util.is_namespace(modname)
    filename = _normalize_path(filename)
    if filename.startswith(_cache_normalize_path(EXT_LIB_DIR)):
        return False
    if std_path is None:
        std_path = STD_LIB_DIRS
    for path in std_path:
        if filename.startswith(_cache_normalize_path(path)):
            return True
    return False



def is_relative(modname, from_file):
    """return true if the given module name is relative to the given
    file name

    :type modname: str
    :param modname: name of the module we are interested in

    :type from_file: str
    :param from_file:
      path of the module from which modname has been imported

    :rtype: bool
    :return:
      true if the module has been imported relatively to `from_file`
    """
    if not os.path.isdir(from_file):
        from_file = os.path.dirname(from_file)
    if from_file in sys.path:
        return False
    try:
        stream, _, _ = imp.find_module(modname.split('.')[0], [from_file])

        # Close the stream to avoid ResourceWarnings.
        if stream:
            stream.close()
        return True
    except ImportError:
        return False


# internal only functions #####################################################

def _spec_from_modpath(modpath, path=None, context=None):
    """given a mod path (i.e. split module / package name), return the
    corresponding spec

    this function is used internally, see `file_from_modpath`'s
    documentation for more information
    """
    assert modpath
    location = None
    if context is not None:
        try:
            found_spec = spec.find_spec(modpath, [context])
            location = found_spec.location
        except ImportError:
            found_spec = spec.find_spec(modpath, path)
            location = found_spec.location
    else:
        found_spec = spec.find_spec(modpath, path)
    if found_spec.type == spec.ModuleType.PY_COMPILED:
        try:
            location = get_source_file(found_spec.location)
            return found_spec._replace(location=location, type=spec.ModuleType.PY_SOURCE)
        except NoSourceFile:
            return found_spec._replace(location=location)
    elif found_spec.type == spec.ModuleType.C_BUILTIN:
        # integrated builtin module
        return found_spec._replace(location=None)
    elif found_spec.type == spec.ModuleType.PKG_DIRECTORY:
        location = _has_init(found_spec.location)
        return found_spec._replace(location=location, type=spec.ModuleType.PY_SOURCE)
    return found_spec


def _is_python_file(filename):
    """return true if the given filename should be considered as a python file

    .pyc and .pyo are ignored
    """
    for ext in ('.py', '.so', '.pyd', '.pyw'):
        if filename.endswith(ext):
            return True
    return False


def _has_init(directory):
    """if the given directory has a valid __init__ file, return its path,
    else return None
    """
    mod_or_pack = os.path.join(directory, '__init__')
    for ext in PY_SOURCE_EXTS + ('pyc', 'pyo'):
        if os.path.exists(mod_or_pack + '.' + ext):
            return mod_or_pack + '.' + ext
    return None


def is_namespace(specobj):
    return specobj.type == spec.ModuleType.PY_NAMESPACE

def is_directory(specobj):
    return specobj.type == spec.ModuleType.PKG_DIRECTORY
