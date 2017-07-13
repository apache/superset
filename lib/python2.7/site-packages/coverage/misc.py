# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Miscellaneous stuff for coverage.py."""

import errno
import hashlib
import inspect
import locale
import os
import sys
import types

from coverage import env
from coverage.backward import to_bytes, unicode_class

ISOLATED_MODULES = {}


def isolate_module(mod):
    """Copy a module so that we are isolated from aggressive mocking.

    If a test suite mocks os.path.exists (for example), and then we need to use
    it during the test, everything will get tangled up if we use their mock.
    Making a copy of the module when we import it will isolate coverage.py from
    those complications.
    """
    if mod not in ISOLATED_MODULES:
        new_mod = types.ModuleType(mod.__name__)
        ISOLATED_MODULES[mod] = new_mod
        for name in dir(mod):
            value = getattr(mod, name)
            if isinstance(value, types.ModuleType):
                value = isolate_module(value)
            setattr(new_mod, name, value)
    return ISOLATED_MODULES[mod]

os = isolate_module(os)


def dummy_decorator_with_args(*args_unused, **kwargs_unused):
    """Dummy no-op implementation of a decorator with arguments."""
    def _decorator(func):
        return func
    return _decorator


# Use PyContracts for assertion testing on parameters and returns, but only if
# we are running our own test suite.
if env.TESTING:
    from contracts import contract              # pylint: disable=unused-import
    from contracts import new_contract as raw_new_contract

    def new_contract(*args, **kwargs):
        """A proxy for contracts.new_contract that doesn't mind happening twice."""
        try:
            return raw_new_contract(*args, **kwargs)
        except ValueError:
            # During meta-coverage, this module is imported twice, and
            # PyContracts doesn't like redefining contracts. It's OK.
            pass

    # Define contract words that PyContract doesn't have.
    new_contract('bytes', lambda v: isinstance(v, bytes))
    if env.PY3:
        new_contract('unicode', lambda v: isinstance(v, unicode_class))

    def one_of(argnames):
        """Ensure that only one of the argnames is non-None."""
        def _decorator(func):
            argnameset = set(name.strip() for name in argnames.split(","))
            def _wrapped(*args, **kwargs):
                vals = [kwargs.get(name) for name in argnameset]
                assert sum(val is not None for val in vals) == 1
                return func(*args, **kwargs)
            return _wrapped
        return _decorator
else:                                           # pragma: not testing
    # We aren't using real PyContracts, so just define our decorators as
    # stunt-double no-ops.
    contract = dummy_decorator_with_args
    one_of = dummy_decorator_with_args

    def new_contract(*args_unused, **kwargs_unused):
        """Dummy no-op implementation of `new_contract`."""
        pass


def nice_pair(pair):
    """Make a nice string representation of a pair of numbers.

    If the numbers are equal, just return the number, otherwise return the pair
    with a dash between them, indicating the range.

    """
    start, end = pair
    if start == end:
        return "%d" % start
    else:
        return "%d-%d" % (start, end)


def format_lines(statements, lines):
    """Nicely format a list of line numbers.

    Format a list of line numbers for printing by coalescing groups of lines as
    long as the lines represent consecutive statements.  This will coalesce
    even if there are gaps between statements.

    For example, if `statements` is [1,2,3,4,5,10,11,12,13,14] and
    `lines` is [1,2,5,10,11,13,14] then the result will be "1-2, 5-11, 13-14".

    Both `lines` and `statements` can be any iterable. All of the elements of
    `lines` must be in `statements`, and all of the values must be positive
    integers.

    """
    statements = sorted(statements)
    lines = sorted(lines)

    pairs = []
    start = None
    lidx = 0
    for stmt in statements:
        if lidx >= len(lines):
            break
        if stmt == lines[lidx]:
            lidx += 1
            if not start:
                start = stmt
            end = stmt
        elif start:
            pairs.append((start, end))
            start = None
    if start:
        pairs.append((start, end))
    ret = ', '.join(map(nice_pair, pairs))
    return ret


def expensive(fn):
    """A decorator to indicate that a method shouldn't be called more than once.

    Normally, this does nothing.  During testing, this raises an exception if
    called more than once.

    """
    if env.TESTING:
        attr = "_once_" + fn.__name__

        def _wrapped(self):
            """Inner function that checks the cache."""
            if hasattr(self, attr):
                raise AssertionError("Shouldn't have called %s more than once" % fn.__name__)
            setattr(self, attr, True)
            return fn(self)
        return _wrapped
    else:
        return fn                   # pragma: not testing


def bool_or_none(b):
    """Return bool(b), but preserve None."""
    if b is None:
        return None
    else:
        return bool(b)


def join_regex(regexes):
    """Combine a list of regexes into one that matches any of them."""
    return "|".join("(?:%s)" % r for r in regexes)


def file_be_gone(path):
    """Remove a file, and don't get annoyed if it doesn't exist."""
    try:
        os.remove(path)
    except OSError as e:
        if e.errno != errno.ENOENT:
            raise


def output_encoding(outfile=None):
    """Determine the encoding to use for output written to `outfile` or stdout."""
    if outfile is None:
        outfile = sys.stdout
    encoding = (
        getattr(outfile, "encoding", None) or
        getattr(sys.__stdout__, "encoding", None) or
        locale.getpreferredencoding()
    )
    return encoding


class Hasher(object):
    """Hashes Python data into md5."""
    def __init__(self):
        self.md5 = hashlib.md5()

    def update(self, v):
        """Add `v` to the hash, recursively if needed."""
        self.md5.update(to_bytes(str(type(v))))
        if isinstance(v, unicode_class):
            self.md5.update(v.encode('utf8'))
        elif isinstance(v, bytes):
            self.md5.update(v)
        elif v is None:
            pass
        elif isinstance(v, (int, float)):
            self.md5.update(to_bytes(str(v)))
        elif isinstance(v, (tuple, list)):
            for e in v:
                self.update(e)
        elif isinstance(v, dict):
            keys = v.keys()
            for k in sorted(keys):
                self.update(k)
                self.update(v[k])
        else:
            for k in dir(v):
                if k.startswith('__'):
                    continue
                a = getattr(v, k)
                if inspect.isroutine(a):
                    continue
                self.update(k)
                self.update(a)

    def hexdigest(self):
        """Retrieve the hex digest of the hash."""
        return self.md5.hexdigest()


def _needs_to_implement(that, func_name):
    """Helper to raise NotImplementedError in interface stubs."""
    if hasattr(that, "_coverage_plugin_name"):
        thing = "Plugin"
        name = that._coverage_plugin_name
    else:
        thing = "Class"
        klass = that.__class__
        name = "{klass.__module__}.{klass.__name__}".format(klass=klass)

    raise NotImplementedError(
        "{thing} {name!r} needs to implement {func_name}()".format(
            thing=thing, name=name, func_name=func_name
            )
        )


class SimpleRepr(object):
    """A mixin implementing a simple __repr__."""
    def __repr__(self):
        return "<{klass} @{id:x} {attrs}>".format(
            klass=self.__class__.__name__,
            id=id(self) & 0xFFFFFF,
            attrs=" ".join("{}={!r}".format(k, v) for k, v in self.__dict__.items()),
            )


class BaseCoverageException(Exception):
    """The base of all Coverage exceptions."""
    pass


class CoverageException(BaseCoverageException):
    """A run-of-the-mill exception specific to coverage.py."""
    pass


class NoSource(CoverageException):
    """We couldn't find the source for a module."""
    pass


class NoCode(NoSource):
    """We couldn't find any code at all."""
    pass


class NotPython(CoverageException):
    """A source file turned out not to be parsable Python."""
    pass


class ExceptionDuringRun(CoverageException):
    """An exception happened while running customer code.

    Construct it with three arguments, the values from `sys.exc_info`.

    """
    pass


class StopEverything(BaseCoverageException):
    """An exception that means everything should stop.

    The CoverageTest class converts these to SkipTest, so that when running
    tests, raising this exception will automatically skip the test.

    """
    pass
