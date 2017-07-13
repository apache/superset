from __future__ import absolute_import


import re
from .. import util
from sqlalchemy.engine import default
from ..util.compat import text_type, py3k
import contextlib
from sqlalchemy.util import decorator
from sqlalchemy import exc as sa_exc
import warnings
from . import mock


if not util.sqla_094:
    def eq_(a, b, msg=None):
        """Assert a == b, with repr messaging on failure."""
        assert a == b, msg or "%r != %r" % (a, b)

    def ne_(a, b, msg=None):
        """Assert a != b, with repr messaging on failure."""
        assert a != b, msg or "%r == %r" % (a, b)

    def is_(a, b, msg=None):
        """Assert a is b, with repr messaging on failure."""
        assert a is b, msg or "%r is not %r" % (a, b)

    def is_not_(a, b, msg=None):
        """Assert a is not b, with repr messaging on failure."""
        assert a is not b, msg or "%r is %r" % (a, b)

    def assert_raises(except_cls, callable_, *args, **kw):
        try:
            callable_(*args, **kw)
            success = False
        except except_cls:
            success = True

        # assert outside the block so it works for AssertionError too !
        assert success, "Callable did not raise an exception"

    def assert_raises_message(except_cls, msg, callable_, *args, **kwargs):
        try:
            callable_(*args, **kwargs)
            assert False, "Callable did not raise an exception"
        except except_cls as e:
            assert re.search(
                msg, text_type(e), re.UNICODE), "%r !~ %s" % (msg, e)
            print(text_type(e).encode('utf-8'))

else:
    from sqlalchemy.testing.assertions import eq_, ne_, is_, is_not_, \
        assert_raises_message, assert_raises


def eq_ignore_whitespace(a, b, msg=None):
    a = re.sub(r'^\s+?|\n', "", a)
    a = re.sub(r' {2,}', " ", a)
    b = re.sub(r'^\s+?|\n', "", b)
    b = re.sub(r' {2,}', " ", b)

    # convert for unicode string rendering,
    # using special escape character "!U"
    if py3k:
        b = re.sub(r'!U', '', b)
    else:
        b = re.sub(r'!U', 'u', b)

    assert a == b, msg or "%r != %r" % (a, b)


def assert_compiled(element, assert_string, dialect=None):
    dialect = _get_dialect(dialect)
    eq_(
        text_type(element.compile(dialect=dialect)).
        replace("\n", "").replace("\t", ""),
        assert_string.replace("\n", "").replace("\t", "")
    )


_dialects = {}


def _get_dialect(name):
    if name is None or name == 'default':
        return default.DefaultDialect()
    else:
        try:
            return _dialects[name]
        except KeyError:
            dialect_mod = getattr(
                __import__('sqlalchemy.dialects.%s' % name).dialects, name)
            _dialects[name] = d = dialect_mod.dialect()
            if name == 'postgresql':
                d.implicit_returning = True
            elif name == 'mssql':
                d.legacy_schema_aliasing = False
            return d


def expect_warnings(*messages, **kw):
    """Context manager which expects one or more warnings.

    With no arguments, squelches all SAWarnings emitted via
    sqlalchemy.util.warn and sqlalchemy.util.warn_limited.   Otherwise
    pass string expressions that will match selected warnings via regex;
    all non-matching warnings are sent through.

    The expect version **asserts** that the warnings were in fact seen.

    Note that the test suite sets SAWarning warnings to raise exceptions.

    """
    return _expect_warnings(sa_exc.SAWarning, messages, **kw)


@contextlib.contextmanager
def expect_warnings_on(db, *messages, **kw):
    """Context manager which expects one or more warnings on specific
    dialects.

    The expect version **asserts** that the warnings were in fact seen.

    """
    spec = db_spec(db)

    if isinstance(db, util.string_types) and not spec(config._current):
        yield
    elif not _is_excluded(*db):
        yield
    else:
        with expect_warnings(*messages, **kw):
            yield


def emits_warning(*messages):
    """Decorator form of expect_warnings().

    Note that emits_warning does **not** assert that the warnings
    were in fact seen.

    """

    @decorator
    def decorate(fn, *args, **kw):
        with expect_warnings(assert_=False, *messages):
            return fn(*args, **kw)

    return decorate


def emits_warning_on(db, *messages):
    """Mark a test as emitting a warning on a specific dialect.

    With no arguments, squelches all SAWarning failures.  Or pass one or more
    strings; these will be matched to the root of the warning description by
    warnings.filterwarnings().

    Note that emits_warning_on does **not** assert that the warnings
    were in fact seen.

    """
    @decorator
    def decorate(fn, *args, **kw):
        with expect_warnings_on(db, *messages):
            return fn(*args, **kw)

    return decorate


@contextlib.contextmanager
def _expect_warnings(exc_cls, messages, regex=True, assert_=True):

    if regex:
        filters = [re.compile(msg, re.I) for msg in messages]
    else:
        filters = messages

    seen = set(filters)

    real_warn = warnings.warn

    def our_warn(msg, exception=None, *arg, **kw):
        if exception and not issubclass(exception, exc_cls):
            return real_warn(msg, exception, *arg, **kw)

        if not filters:
            return

        for filter_ in filters:
            if (regex and filter_.match(msg)) or \
                    (not regex and filter_ == msg):
                seen.discard(filter_)
                break
        else:
            if exception is None:
                real_warn(msg, *arg, **kw)
            else:
                real_warn(msg, exception, *arg, **kw)

    with mock.patch("warnings.warn", our_warn):
        yield

    if assert_:
        assert not seen, "Warnings were not seen: %s" % \
            ", ".join("%r" % (s.pattern if regex else s) for s in seen)

