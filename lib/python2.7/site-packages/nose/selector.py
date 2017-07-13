"""
Test Selection
--------------

Test selection is handled by a Selector. The test loader calls the
appropriate selector method for each object it encounters that it
thinks may be a test.
"""
import logging
import os
import unittest
from nose.config import Config
from nose.util import split_test_name, src, getfilename, getpackage, ispackage, is_executable

log = logging.getLogger(__name__)

__all__ = ['Selector', 'defaultSelector', 'TestAddress']


# for efficiency and easier mocking
op_join = os.path.join
op_basename = os.path.basename
op_exists = os.path.exists
op_splitext = os.path.splitext
op_isabs = os.path.isabs
op_abspath = os.path.abspath


class Selector(object):
    """Core test selector. Examines test candidates and determines whether,
    given the specified configuration, the test candidate should be selected
    as a test.
    """
    def __init__(self, config):
        if config is None:
            config = Config()
        self.configure(config)

    def configure(self, config):
        self.config = config
        self.exclude = config.exclude
        self.ignoreFiles = config.ignoreFiles
        self.include = config.include
        self.plugins = config.plugins
        self.match = config.testMatch
        
    def matches(self, name):
        """Does the name match my requirements?

        To match, a name must match config.testMatch OR config.include
        and it must not match config.exclude
        """
        return ((self.match.search(name)
                 or (self.include and
                     filter(None,
                            [inc.search(name) for inc in self.include])))
                and ((not self.exclude)
                     or not filter(None,
                                   [exc.search(name) for exc in self.exclude])
                 ))
    
    def wantClass(self, cls):
        """Is the class a wanted test class?

        A class must be a unittest.TestCase subclass, or match test name
        requirements. Classes that start with _ are always excluded.
        """
        declared = getattr(cls, '__test__', None)
        if declared is not None:
            wanted = declared
        else:
            wanted = (not cls.__name__.startswith('_')
                      and (issubclass(cls, unittest.TestCase)
                           or self.matches(cls.__name__)))
        
        plug_wants = self.plugins.wantClass(cls)        
        if plug_wants is not None:
            log.debug("Plugin setting selection of %s to %s", cls, plug_wants)
            wanted = plug_wants
        log.debug("wantClass %s? %s", cls, wanted)
        return wanted

    def wantDirectory(self, dirname):
        """Is the directory a wanted test directory?

        All package directories match, so long as they do not match exclude. 
        All other directories must match test requirements.
        """
        tail = op_basename(dirname)
        if ispackage(dirname):
            wanted = (not self.exclude
                      or not filter(None,
                                    [exc.search(tail) for exc in self.exclude]
                                    ))
        else:
            wanted = (self.matches(tail)
                      or (self.config.srcDirs
                          and tail in self.config.srcDirs))
        plug_wants = self.plugins.wantDirectory(dirname)
        if plug_wants is not None:
            log.debug("Plugin setting selection of %s to %s",
                      dirname, plug_wants)
            wanted = plug_wants
        log.debug("wantDirectory %s? %s", dirname, wanted)
        return wanted
    
    def wantFile(self, file):
        """Is the file a wanted test file?

        The file must be a python source file and match testMatch or
        include, and not match exclude. Files that match ignore are *never*
        wanted, regardless of plugin, testMatch, include or exclude settings.
        """
        # never, ever load files that match anything in ignore
        # (.* _* and *setup*.py by default)
        base = op_basename(file)
        ignore_matches = [ ignore_this for ignore_this in self.ignoreFiles
                           if ignore_this.search(base) ]
        if ignore_matches:
            log.debug('%s matches ignoreFiles pattern; skipped',
                      base) 
            return False
        if not self.config.includeExe and is_executable(file):
            log.info('%s is executable; skipped', file)
            return False
        dummy, ext = op_splitext(base)
        pysrc = ext == '.py'

        wanted = pysrc and self.matches(base) 
        plug_wants = self.plugins.wantFile(file)
        if plug_wants is not None:
            log.debug("plugin setting want %s to %s", file, plug_wants)
            wanted = plug_wants
        log.debug("wantFile %s? %s", file, wanted)
        return wanted

    def wantFunction(self, function):
        """Is the function a test function?
        """
        try:
            if hasattr(function, 'compat_func_name'):
                funcname = function.compat_func_name
            else:
                funcname = function.__name__
        except AttributeError:
            # not a function
            return False
        declared = getattr(function, '__test__', None)
        if declared is not None:
            wanted = declared
        else:
            wanted = not funcname.startswith('_') and self.matches(funcname)
        plug_wants = self.plugins.wantFunction(function)
        if plug_wants is not None:
            wanted = plug_wants
        log.debug("wantFunction %s? %s", function, wanted)
        return wanted

    def wantMethod(self, method):
        """Is the method a test method?
        """
        try:
            method_name = method.__name__
        except AttributeError:
            # not a method
            return False
        if method_name.startswith('_'):
            # never collect 'private' methods
            return False
        declared = getattr(method, '__test__', None)
        if declared is not None:
            wanted = declared
        else:
            wanted = self.matches(method_name)
        plug_wants = self.plugins.wantMethod(method)
        if plug_wants is not None:
            wanted = plug_wants
        log.debug("wantMethod %s? %s", method, wanted)
        return wanted
    
    def wantModule(self, module):
        """Is the module a test module?

        The tail of the module name must match test requirements. One exception:
        we always want __main__.
        """
        declared = getattr(module, '__test__', None)
        if declared is not None:
            wanted = declared
        else:
            wanted = self.matches(module.__name__.split('.')[-1]) \
                     or module.__name__ == '__main__'
        plug_wants = self.plugins.wantModule(module)
        if plug_wants is not None:
            wanted = plug_wants
        log.debug("wantModule %s? %s", module, wanted)
        return wanted
        
defaultSelector = Selector        


class TestAddress(object):
    """A test address represents a user's request to run a particular
    test. The user may specify a filename or module (or neither),
    and/or a callable (a class, function, or method). The naming
    format for test addresses is:

    filename_or_module:callable

    Filenames that are not absolute will be made absolute relative to
    the working dir.

    The filename or module part will be considered a module name if it
    doesn't look like a file, that is, if it doesn't exist on the file
    system and it doesn't contain any directory separators and it
    doesn't end in .py.

    Callables may be a class name, function name, method name, or
    class.method specification.
    """
    def __init__(self, name, workingDir=None):
        if workingDir is None:
            workingDir = os.getcwd()
        self.name = name
        self.workingDir = workingDir
        self.filename, self.module, self.call = split_test_name(name)
        log.debug('Test name %s resolved to file %s, module %s, call %s',
                  name, self.filename, self.module, self.call)
        if self.filename is None:
            if self.module is not None:
                self.filename = getfilename(self.module, self.workingDir)
        if self.filename:
            self.filename = src(self.filename)
            if not op_isabs(self.filename):
                self.filename = op_abspath(op_join(workingDir,
                                                   self.filename))
            if self.module is None:
                self.module = getpackage(self.filename)
        log.debug(
            'Final resolution of test name %s: file %s module %s call %s',
            name, self.filename, self.module, self.call)

    def totuple(self):
        return (self.filename, self.module, self.call)
        
    def __str__(self):
        return self.name

    def __repr__(self):
        return "%s: (%s, %s, %s)" % (self.name, self.filename,
                                     self.module, self.call)
