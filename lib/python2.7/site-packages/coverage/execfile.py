# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Execute files of Python code."""

import marshal
import os
import sys
import types

from coverage.backward import BUILTINS
from coverage.backward import PYC_MAGIC_NUMBER, imp, importlib_util_find_spec
from coverage.misc import CoverageException, ExceptionDuringRun, NoCode, NoSource, isolate_module
from coverage.phystokens import compile_unicode
from coverage.python import get_python_source

os = isolate_module(os)


class DummyLoader(object):
    """A shim for the pep302 __loader__, emulating pkgutil.ImpLoader.

    Currently only implements the .fullname attribute
    """
    def __init__(self, fullname, *_args):
        self.fullname = fullname


if importlib_util_find_spec:
    def find_module(modulename):
        """Find the module named `modulename`.

        Returns the file path of the module, and the name of the enclosing
        package.
        """
        try:
            spec = importlib_util_find_spec(modulename)
        except ImportError as err:
            raise NoSource(str(err))
        if not spec:
            raise NoSource("No module named %r" % (modulename,))
        pathname = spec.origin
        packagename = spec.name
        if pathname.endswith("__init__.py") and not modulename.endswith("__init__"):
            mod_main = modulename + ".__main__"
            spec = importlib_util_find_spec(mod_main)
            if not spec:
                raise NoSource(
                    "No module named %s; "
                    "%r is a package and cannot be directly executed"
                    % (mod_main, modulename)
                )
            pathname = spec.origin
            packagename = spec.name
        packagename = packagename.rpartition(".")[0]
        return pathname, packagename
else:
    def find_module(modulename):
        """Find the module named `modulename`.

        Returns the file path of the module, and the name of the enclosing
        package.
        """
        openfile = None
        glo, loc = globals(), locals()
        try:
            # Search for the module - inside its parent package, if any - using
            # standard import mechanics.
            if '.' in modulename:
                packagename, name = modulename.rsplit('.', 1)
                package = __import__(packagename, glo, loc, ['__path__'])
                searchpath = package.__path__
            else:
                packagename, name = None, modulename
                searchpath = None  # "top-level search" in imp.find_module()
            openfile, pathname, _ = imp.find_module(name, searchpath)

            # Complain if this is a magic non-file module.
            if openfile is None and pathname is None:
                raise NoSource(
                    "module does not live in a file: %r" % modulename
                    )

            # If `modulename` is actually a package, not a mere module, then we
            # pretend to be Python 2.7 and try running its __main__.py script.
            if openfile is None:
                packagename = modulename
                name = '__main__'
                package = __import__(packagename, glo, loc, ['__path__'])
                searchpath = package.__path__
                openfile, pathname, _ = imp.find_module(name, searchpath)
        except ImportError as err:
            raise NoSource(str(err))
        finally:
            if openfile:
                openfile.close()

        return pathname, packagename


def run_python_module(modulename, args):
    """Run a Python module, as though with ``python -m name args...``.

    `modulename` is the name of the module, possibly a dot-separated name.
    `args` is the argument array to present as sys.argv, including the first
    element naming the module being executed.

    """
    pathname, packagename = find_module(modulename)

    pathname = os.path.abspath(pathname)
    args[0] = pathname
    run_python_file(pathname, args, package=packagename, modulename=modulename, path0="")


def run_python_file(filename, args, package=None, modulename=None, path0=None):
    """Run a Python file as if it were the main program on the command line.

    `filename` is the path to the file to execute, it need not be a .py file.
    `args` is the argument array to present as sys.argv, including the first
    element naming the file being executed.  `package` is the name of the
    enclosing package, if any.

    `modulename` is the name of the module the file was run as.

    `path0` is the value to put into sys.path[0].  If it's None, then this
    function will decide on a value.

    """
    if modulename is None and sys.version_info >= (3, 3):
        modulename = '__main__'

    # Create a module to serve as __main__
    old_main_mod = sys.modules['__main__']
    main_mod = types.ModuleType('__main__')
    sys.modules['__main__'] = main_mod
    main_mod.__file__ = filename
    if package:
        main_mod.__package__ = package
    if modulename:
        main_mod.__loader__ = DummyLoader(modulename)

    main_mod.__builtins__ = BUILTINS

    # Set sys.argv properly.
    old_argv = sys.argv
    sys.argv = args

    if os.path.isdir(filename):
        # Running a directory means running the __main__.py file in that
        # directory.
        my_path0 = filename

        for ext in [".py", ".pyc", ".pyo"]:
            try_filename = os.path.join(filename, "__main__" + ext)
            if os.path.exists(try_filename):
                filename = try_filename
                break
        else:
            raise NoSource("Can't find '__main__' module in '%s'" % filename)
    else:
        my_path0 = os.path.abspath(os.path.dirname(filename))

    # Set sys.path correctly.
    old_path0 = sys.path[0]
    sys.path[0] = path0 if path0 is not None else my_path0

    try:
        try:
            # Make a code object somehow.
            if filename.endswith((".pyc", ".pyo")):
                code = make_code_from_pyc(filename)
            else:
                code = make_code_from_py(filename)
        except CoverageException:
            raise
        except Exception as exc:
            msg = "Couldn't run {filename!r} as Python code: {exc.__class__.__name__}: {exc}"
            raise CoverageException(msg.format(filename=filename, exc=exc))

        # Execute the code object.
        try:
            exec(code, main_mod.__dict__)
        except SystemExit:
            # The user called sys.exit().  Just pass it along to the upper
            # layers, where it will be handled.
            raise
        except Exception:
            # Something went wrong while executing the user code.
            # Get the exc_info, and pack them into an exception that we can
            # throw up to the outer loop.  We peel one layer off the traceback
            # so that the coverage.py code doesn't appear in the final printed
            # traceback.
            typ, err, tb = sys.exc_info()

            # PyPy3 weirdness.  If I don't access __context__, then somehow it
            # is non-None when the exception is reported at the upper layer,
            # and a nested exception is shown to the user.  This getattr fixes
            # it somehow? https://bitbucket.org/pypy/pypy/issue/1903
            getattr(err, '__context__', None)

            # Call the excepthook.
            try:
                if hasattr(err, "__traceback__"):
                    err.__traceback__ = err.__traceback__.tb_next
                sys.excepthook(typ, err, tb.tb_next)
            except SystemExit:
                raise
            except Exception:
                # Getting the output right in the case of excepthook
                # shenanigans is kind of involved.
                sys.stderr.write("Error in sys.excepthook:\n")
                typ2, err2, tb2 = sys.exc_info()
                err2.__suppress_context__ = True
                if hasattr(err2, "__traceback__"):
                    err2.__traceback__ = err2.__traceback__.tb_next
                sys.__excepthook__(typ2, err2, tb2.tb_next)
                sys.stderr.write("\nOriginal exception was:\n")
                raise ExceptionDuringRun(typ, err, tb.tb_next)
            else:
                sys.exit(1)

    finally:
        # Restore the old __main__, argv, and path.
        sys.modules['__main__'] = old_main_mod
        sys.argv = old_argv
        sys.path[0] = old_path0


def make_code_from_py(filename):
    """Get source from `filename` and make a code object of it."""
    # Open the source file.
    try:
        source = get_python_source(filename)
    except (IOError, NoSource):
        raise NoSource("No file to run: '%s'" % filename)

    code = compile_unicode(source, filename, "exec")
    return code


def make_code_from_pyc(filename):
    """Get a code object from a .pyc file."""
    try:
        fpyc = open(filename, "rb")
    except IOError:
        raise NoCode("No file to run: '%s'" % filename)

    with fpyc:
        # First four bytes are a version-specific magic number.  It has to
        # match or we won't run the file.
        magic = fpyc.read(4)
        if magic != PYC_MAGIC_NUMBER:
            raise NoCode("Bad magic number in .pyc file")

        # Skip the junk in the header that we don't need.
        fpyc.read(4)            # Skip the moddate.
        if sys.version_info >= (3, 3):
            # 3.3 added another long to the header (size), skip it.
            fpyc.read(4)

        # The rest of the file is the code object we want.
        code = marshal.load(fpyc)

    return code
