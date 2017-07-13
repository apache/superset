# -*- coding: utf-8 -*-
import os
import locale
import codecs
import sys
from uuid import uuid4
from collections import OrderedDict

import pytest
from pandas.compat import intern
from pandas.util._move import move_into_mutable_buffer, BadMove, stolenbuf
from pandas.util._decorators import deprecate_kwarg
from pandas.util._validators import (validate_args, validate_kwargs,
                                     validate_args_and_kwargs,
                                     validate_bool_kwarg)

import pandas.util.testing as tm

CURRENT_LOCALE = locale.getlocale()
LOCALE_OVERRIDE = os.environ.get('LOCALE_OVERRIDE', None)


class TestDecorators(object):

    def setup_method(self, method):
        @deprecate_kwarg('old', 'new')
        def _f1(new=False):
            return new

        @deprecate_kwarg('old', 'new', {'yes': True, 'no': False})
        def _f2(new=False):
            return new

        @deprecate_kwarg('old', 'new', lambda x: x + 1)
        def _f3(new=0):
            return new

        self.f1 = _f1
        self.f2 = _f2
        self.f3 = _f3

    def test_deprecate_kwarg(self):
        x = 78
        with tm.assert_produces_warning(FutureWarning):
            result = self.f1(old=x)
        assert result is x
        with tm.assert_produces_warning(None):
            self.f1(new=x)

    def test_dict_deprecate_kwarg(self):
        x = 'yes'
        with tm.assert_produces_warning(FutureWarning):
            result = self.f2(old=x)
        assert result

    def test_missing_deprecate_kwarg(self):
        x = 'bogus'
        with tm.assert_produces_warning(FutureWarning):
            result = self.f2(old=x)
        assert result == 'bogus'

    def test_callable_deprecate_kwarg(self):
        x = 5
        with tm.assert_produces_warning(FutureWarning):
            result = self.f3(old=x)
        assert result == x + 1
        with pytest.raises(TypeError):
            self.f3(old='hello')

    def test_bad_deprecate_kwarg(self):
        with pytest.raises(TypeError):
            @deprecate_kwarg('old', 'new', 0)
            def f4(new=None):
                pass


def test_rands():
    r = tm.rands(10)
    assert(len(r) == 10)


def test_rands_array():
    arr = tm.rands_array(5, size=10)
    assert(arr.shape == (10,))
    assert(len(arr[0]) == 5)

    arr = tm.rands_array(7, size=(10, 10))
    assert(arr.shape == (10, 10))
    assert(len(arr[1, 1]) == 7)


class TestValidateArgs(object):
    fname = 'func'

    def test_bad_min_fname_arg_count(self):
        msg = "'max_fname_arg_count' must be non-negative"
        with tm.assert_raises_regex(ValueError, msg):
            validate_args(self.fname, (None,), -1, 'foo')

    def test_bad_arg_length_max_value_single(self):
        args = (None, None)
        compat_args = ('foo',)

        min_fname_arg_count = 0
        max_length = len(compat_args) + min_fname_arg_count
        actual_length = len(args) + min_fname_arg_count
        msg = (r"{fname}\(\) takes at most {max_length} "
               r"argument \({actual_length} given\)"
               .format(fname=self.fname, max_length=max_length,
                       actual_length=actual_length))

        with tm.assert_raises_regex(TypeError, msg):
            validate_args(self.fname, args,
                          min_fname_arg_count,
                          compat_args)

    def test_bad_arg_length_max_value_multiple(self):
        args = (None, None)
        compat_args = dict(foo=None)

        min_fname_arg_count = 2
        max_length = len(compat_args) + min_fname_arg_count
        actual_length = len(args) + min_fname_arg_count
        msg = (r"{fname}\(\) takes at most {max_length} "
               r"arguments \({actual_length} given\)"
               .format(fname=self.fname, max_length=max_length,
                       actual_length=actual_length))

        with tm.assert_raises_regex(TypeError, msg):
            validate_args(self.fname, args,
                          min_fname_arg_count,
                          compat_args)

    def test_not_all_defaults(self):
        bad_arg = 'foo'
        msg = ("the '{arg}' parameter is not supported "
               r"in the pandas implementation of {func}\(\)".
               format(arg=bad_arg, func=self.fname))

        compat_args = OrderedDict()
        compat_args['foo'] = 2
        compat_args['bar'] = -1
        compat_args['baz'] = 3

        arg_vals = (1, -1, 3)

        for i in range(1, 3):
            with tm.assert_raises_regex(ValueError, msg):
                validate_args(self.fname, arg_vals[:i], 2, compat_args)

    def test_validation(self):
        # No exceptions should be thrown
        validate_args(self.fname, (None,), 2, dict(out=None))

        compat_args = OrderedDict()
        compat_args['axis'] = 1
        compat_args['out'] = None

        validate_args(self.fname, (1, None), 2, compat_args)


class TestValidateKwargs(object):
    fname = 'func'

    def test_bad_kwarg(self):
        goodarg = 'f'
        badarg = goodarg + 'o'

        compat_args = OrderedDict()
        compat_args[goodarg] = 'foo'
        compat_args[badarg + 'o'] = 'bar'
        kwargs = {goodarg: 'foo', badarg: 'bar'}
        msg = (r"{fname}\(\) got an unexpected "
               r"keyword argument '{arg}'".format(
                   fname=self.fname, arg=badarg))

        with tm.assert_raises_regex(TypeError, msg):
            validate_kwargs(self.fname, kwargs, compat_args)

    def test_not_all_none(self):
        bad_arg = 'foo'
        msg = (r"the '{arg}' parameter is not supported "
               r"in the pandas implementation of {func}\(\)".
               format(arg=bad_arg, func=self.fname))

        compat_args = OrderedDict()
        compat_args['foo'] = 1
        compat_args['bar'] = 's'
        compat_args['baz'] = None

        kwarg_keys = ('foo', 'bar', 'baz')
        kwarg_vals = (2, 's', None)

        for i in range(1, 3):
            kwargs = dict(zip(kwarg_keys[:i],
                              kwarg_vals[:i]))

            with tm.assert_raises_regex(ValueError, msg):
                validate_kwargs(self.fname, kwargs, compat_args)

    def test_validation(self):
        # No exceptions should be thrown
        compat_args = OrderedDict()
        compat_args['f'] = None
        compat_args['b'] = 1
        compat_args['ba'] = 's'
        kwargs = dict(f=None, b=1)
        validate_kwargs(self.fname, kwargs, compat_args)

    def test_validate_bool_kwarg(self):
        arg_names = ['inplace', 'copy']
        invalid_values = [1, "True", [1, 2, 3], 5.0]
        valid_values = [True, False, None]

        for name in arg_names:
            for value in invalid_values:
                with tm.assert_raises_regex(ValueError,
                                            "For argument \"%s\" "
                                            "expected type bool, "
                                            "received type %s" %
                                            (name, type(value).__name__)):
                    validate_bool_kwarg(value, name)

            for value in valid_values:
                assert validate_bool_kwarg(value, name) == value


class TestValidateKwargsAndArgs(object):
    fname = 'func'

    def test_invalid_total_length_max_length_one(self):
        compat_args = ('foo',)
        kwargs = {'foo': 'FOO'}
        args = ('FoO', 'BaZ')

        min_fname_arg_count = 0
        max_length = len(compat_args) + min_fname_arg_count
        actual_length = len(kwargs) + len(args) + min_fname_arg_count
        msg = (r"{fname}\(\) takes at most {max_length} "
               r"argument \({actual_length} given\)"
               .format(fname=self.fname, max_length=max_length,
                       actual_length=actual_length))

        with tm.assert_raises_regex(TypeError, msg):
            validate_args_and_kwargs(self.fname, args, kwargs,
                                     min_fname_arg_count,
                                     compat_args)

    def test_invalid_total_length_max_length_multiple(self):
        compat_args = ('foo', 'bar', 'baz')
        kwargs = {'foo': 'FOO', 'bar': 'BAR'}
        args = ('FoO', 'BaZ')

        min_fname_arg_count = 2
        max_length = len(compat_args) + min_fname_arg_count
        actual_length = len(kwargs) + len(args) + min_fname_arg_count
        msg = (r"{fname}\(\) takes at most {max_length} "
               r"arguments \({actual_length} given\)"
               .format(fname=self.fname, max_length=max_length,
                       actual_length=actual_length))

        with tm.assert_raises_regex(TypeError, msg):
            validate_args_and_kwargs(self.fname, args, kwargs,
                                     min_fname_arg_count,
                                     compat_args)

    def test_no_args_with_kwargs(self):
        bad_arg = 'bar'
        min_fname_arg_count = 2

        compat_args = OrderedDict()
        compat_args['foo'] = -5
        compat_args[bad_arg] = 1

        msg = (r"the '{arg}' parameter is not supported "
               r"in the pandas implementation of {func}\(\)".
               format(arg=bad_arg, func=self.fname))

        args = ()
        kwargs = {'foo': -5, bad_arg: 2}
        tm.assert_raises_regex(ValueError, msg,
                               validate_args_and_kwargs,
                               self.fname, args, kwargs,
                               min_fname_arg_count, compat_args)

        args = (-5, 2)
        kwargs = {}
        tm.assert_raises_regex(ValueError, msg,
                               validate_args_and_kwargs,
                               self.fname, args, kwargs,
                               min_fname_arg_count, compat_args)

    def test_duplicate_argument(self):
        min_fname_arg_count = 2
        compat_args = OrderedDict()
        compat_args['foo'] = None
        compat_args['bar'] = None
        compat_args['baz'] = None
        kwargs = {'foo': None, 'bar': None}
        args = (None,)  # duplicate value for 'foo'

        msg = (r"{fname}\(\) got multiple values for keyword "
               r"argument '{arg}'".format(fname=self.fname, arg='foo'))

        with tm.assert_raises_regex(TypeError, msg):
            validate_args_and_kwargs(self.fname, args, kwargs,
                                     min_fname_arg_count,
                                     compat_args)

    def test_validation(self):
        # No exceptions should be thrown
        compat_args = OrderedDict()
        compat_args['foo'] = 1
        compat_args['bar'] = None
        compat_args['baz'] = -2
        kwargs = {'baz': -2}
        args = (1, None)

        min_fname_arg_count = 2
        validate_args_and_kwargs(self.fname, args, kwargs,
                                 min_fname_arg_count,
                                 compat_args)


class TestMove(object):

    def test_cannot_create_instance_of_stolenbuffer(self):
        """Stolen buffers need to be created through the smart constructor
        ``move_into_mutable_buffer`` which has a bunch of checks in it.
        """
        msg = "cannot create 'pandas.util._move.stolenbuf' instances"
        with tm.assert_raises_regex(TypeError, msg):
            stolenbuf()

    def test_more_than_one_ref(self):
        """Test case for when we try to use ``move_into_mutable_buffer`` when
        the object being moved has other references.
        """
        b = b'testing'

        with pytest.raises(BadMove) as e:
            def handle_success(type_, value, tb):
                assert value.args[0] is b
                return type(e).handle_success(e, type_, value, tb)  # super

            e.handle_success = handle_success
            move_into_mutable_buffer(b)

    def test_exactly_one_ref(self):
        """Test case for when the object being moved has exactly one reference.
        """
        b = b'testing'

        # We need to pass an expression on the stack to ensure that there are
        # not extra references hanging around. We cannot rewrite this test as
        #   buf = b[:-3]
        #   as_stolen_buf = move_into_mutable_buffer(buf)
        # because then we would have more than one reference to buf.
        as_stolen_buf = move_into_mutable_buffer(b[:-3])

        # materialize as bytearray to show that it is mutable
        assert bytearray(as_stolen_buf) == b'test'

    @pytest.mark.skipif(
        sys.version_info[0] > 2,
        reason='bytes objects cannot be interned in py3',
    )
    def test_interned(self):
        salt = uuid4().hex

        def make_string():
            # We need to actually create a new string so that it has refcount
            # one. We use a uuid so that we know the string could not already
            # be in the intern table.
            return ''.join(('testing: ', salt))

        # This should work, the string has one reference on the stack.
        move_into_mutable_buffer(make_string())

        refcount = [None]  # nonlocal

        def ref_capture(ob):
            # Subtract two because those are the references owned by this
            # frame:
            #   1. The local variables of this stack frame.
            #   2. The python data stack of this stack frame.
            refcount[0] = sys.getrefcount(ob) - 2
            return ob

        with pytest.raises(BadMove):
            # If we intern the string it will still have one reference but now
            # it is in the intern table so if other people intern the same
            # string while the mutable buffer holds the first string they will
            # be the same instance.
            move_into_mutable_buffer(ref_capture(intern(make_string())))  # noqa

        assert refcount[0] == 1


def test_numpy_errstate_is_default():
    # The defaults since numpy 1.6.0
    expected = {'over': 'warn', 'divide': 'warn', 'invalid': 'warn',
                'under': 'ignore'}
    import numpy as np
    from pandas.compat import numpy  # noqa
    # The errstate should be unchanged after that import.
    assert np.geterr() == expected


class TestLocaleUtils(object):

    @classmethod
    def setup_class(cls):
        cls.locales = tm.get_locales()

        if not cls.locales:
            pytest.skip("No locales found")

        tm._skip_if_windows()

    @classmethod
    def teardown_class(cls):
        del cls.locales

    def test_get_locales(self):
        # all systems should have at least a single locale
        assert len(tm.get_locales()) > 0

    def test_get_locales_prefix(self):
        if len(self.locales) == 1:
            pytest.skip("Only a single locale found, no point in "
                        "trying to test filtering locale prefixes")
        first_locale = self.locales[0]
        assert len(tm.get_locales(prefix=first_locale[:2])) > 0

    def test_set_locale(self):
        if len(self.locales) == 1:
            pytest.skip("Only a single locale found, no point in "
                        "trying to test setting another locale")

        if all(x is None for x in CURRENT_LOCALE):
            # Not sure why, but on some travis runs with pytest,
            # getlocale() returned (None, None).
            pytest.skip("CURRENT_LOCALE is not set.")

        if LOCALE_OVERRIDE is None:
            lang, enc = 'it_CH', 'UTF-8'
        elif LOCALE_OVERRIDE == 'C':
            lang, enc = 'en_US', 'ascii'
        else:
            lang, enc = LOCALE_OVERRIDE.split('.')

        enc = codecs.lookup(enc).name
        new_locale = lang, enc

        if not tm._can_set_locale(new_locale):
            with pytest.raises(locale.Error):
                with tm.set_locale(new_locale):
                    pass
        else:
            with tm.set_locale(new_locale) as normalized_locale:
                new_lang, new_enc = normalized_locale.split('.')
                new_enc = codecs.lookup(enc).name
                normalized_locale = new_lang, new_enc
                assert normalized_locale == new_locale

        current_locale = locale.getlocale()
        assert current_locale == CURRENT_LOCALE
