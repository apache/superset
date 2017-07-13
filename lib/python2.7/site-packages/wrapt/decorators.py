"""This module implements decorators for implementing other decorators
as well as some commonly used decorators.

"""

import sys

PY2 = sys.version_info[0] == 2
PY3 = sys.version_info[0] == 3

if PY3:
    string_types = str,

    import builtins
    exec_ = getattr(builtins, "exec")
    del builtins

else:
    string_types = basestring,

    def exec_(_code_, _globs_=None, _locs_=None):
        """Execute code in a namespace."""
        if _globs_ is None:
            frame = sys._getframe(1)
            _globs_ = frame.f_globals
            if _locs_ is None:
                _locs_ = frame.f_locals
            del frame
        elif _locs_ is None:
            _locs_ = _globs_
        exec("""exec _code_ in _globs_, _locs_""")

from functools import partial
from inspect import ismethod, isclass, formatargspec
from collections import namedtuple
from threading import Lock, RLock

try:
    from inspect import signature
except ImportError:
    pass

from .wrappers import (FunctionWrapper, BoundFunctionWrapper, ObjectProxy,
    CallableObjectProxy)

# Adapter wrapper for the wrapped function which will overlay certain
# properties from the adapter function onto the wrapped function so that
# functions such as inspect.getargspec(), inspect.getfullargspec(),
# inspect.signature() and inspect.getsource() return the correct results
# one would expect.

class _AdapterFunctionCode(CallableObjectProxy):

    def __init__(self, wrapped_code, adapter_code):
        super(_AdapterFunctionCode, self).__init__(wrapped_code)
        self._self_adapter_code = adapter_code

    @property
    def co_argcount(self):
        return self._self_adapter_code.co_argcount

    @property
    def co_code(self):
        return self._self_adapter_code.co_code

    @property
    def co_flags(self):
        return self._self_adapter_code.co_flags

    @property
    def co_kwonlyargcount(self):
        return self._self_adapter_code.co_kwonlyargcount

    @property
    def co_varnames(self):
        return self._self_adapter_code.co_varnames

class _AdapterFunctionSurrogate(CallableObjectProxy):

    def __init__(self, wrapped, adapter):
        super(_AdapterFunctionSurrogate, self).__init__(wrapped)
        self._self_adapter = adapter

    @property
    def __code__(self):
        return _AdapterFunctionCode(self.__wrapped__.__code__,
                self._self_adapter.__code__)

    @property
    def __defaults__(self):
        return self._self_adapter.__defaults__

    @property
    def __kwdefaults__(self):
        return self._self_adapter.__kwdefaults__

    @property
    def __signature__(self):
        if 'signature' not in globals():
            return self._self_adapter.__signature__
        else:
            # Can't allow this to fail on Python 3 else it falls
            # through to using __wrapped__, but that will be the
            # wrong function we want to derive the signature
            # from. Thus generate the signature ourselves.

            return signature(self._self_adapter)

    if PY2:
        func_code = __code__
        func_defaults = __defaults__

class _BoundAdapterWrapper(BoundFunctionWrapper):

    @property
    def __func__(self):
        return _AdapterFunctionSurrogate(self.__wrapped__.__func__,
                self._self_parent._self_adapter)

    if PY2:
        im_func = __func__

class AdapterWrapper(FunctionWrapper):

    __bound_function_wrapper__ = _BoundAdapterWrapper

    def __init__(self, *args, **kwargs):
        adapter = kwargs.pop('adapter')
        super(AdapterWrapper, self).__init__(*args, **kwargs)
        self._self_surrogate = _AdapterFunctionSurrogate(
                self.__wrapped__, adapter)
        self._self_adapter = adapter

    @property
    def __code__(self):
        return self._self_surrogate.__code__

    @property
    def __defaults__(self):
        return self._self_surrogate.__defaults__

    @property
    def __kwdefaults__(self):
        return self._self_surrogate.__kwdefaults__

    if PY2:
        func_code = __code__
        func_defaults = __defaults__

    @property
    def __signature__(self):
        return self._self_surrogate.__signature__

class AdapterFactory(object):
    def __call__(self, wrapped):
        raise NotImplementedError()

class DelegatedAdapterFactory(AdapterFactory):
    def __init__(self, factory):
        super(DelegatedAdapterFactory, self).__init__()
        self.factory = factory
    def __call__(self, wrapped):
        return self.factory(wrapped)

adapter_factory = DelegatedAdapterFactory

# Decorator for creating other decorators. This decorator and the
# wrappers which they use are designed to properly preserve any name
# attributes, function signatures etc, in addition to the wrappers
# themselves acting like a transparent proxy for the original wrapped
# function so the wrapper is effectively indistinguishable from the
# original wrapped function.

def decorator(wrapper=None, enabled=None, adapter=None):
    # The decorator should be supplied with a single positional argument
    # which is the wrapper function to be used to implement the
    # decorator. This may be preceded by a step whereby the keyword
    # arguments are supplied to customise the behaviour of the
    # decorator. The 'adapter' argument is used to optionally denote a
    # separate function which is notionally used by an adapter
    # decorator. In that case parts of the function '__code__' and
    # '__defaults__' attributes are used from the adapter function
    # rather than those of the wrapped function. This allows for the
    # argument specification from inspect.getargspec() and similar
    # functions to be overridden with a prototype for a different
    # function than what was wrapped. The 'enabled' argument provides a
    # way to enable/disable the use of the decorator. If the type of
    # 'enabled' is a boolean, then it is evaluated immediately and the
    # wrapper not even applied if it is False. If not a boolean, it will
    # be evaluated when the wrapper is called for an unbound wrapper,
    # and when binding occurs for a bound wrapper. When being evaluated,
    # if 'enabled' is callable it will be called to obtain the value to
    # be checked. If False, the wrapper will not be called and instead
    # the original wrapped function will be called directly instead.

    if wrapper is not None:
        # Helper function for creating wrapper of the appropriate
        # time when we need it down below.

        def _build(wrapped, wrapper, enabled=None, adapter=None):
            if adapter:
                if isinstance(adapter, AdapterFactory):
                    adapter = adapter(wrapped)

                if not callable(adapter):
                    ns = {}
                    if not isinstance(adapter, string_types):
                        adapter = formatargspec(*adapter)
                    exec_('def adapter{0}: pass'.format(adapter), ns, ns)
                    adapter = ns['adapter']

                return AdapterWrapper(wrapped=wrapped, wrapper=wrapper,
                        enabled=enabled, adapter=adapter)

            return FunctionWrapper(wrapped=wrapped, wrapper=wrapper,
                    enabled=enabled)

        # The wrapper has been provided so return the final decorator.
        # The decorator is itself one of our function wrappers so we
        # can determine when it is applied to functions, instance methods
        # or class methods. This allows us to bind the instance or class
        # method so the appropriate self or cls attribute is supplied
        # when it is finally called.

        def _wrapper(wrapped, instance, args, kwargs):
            # We first check for the case where the decorator was applied
            # to a class type.
            #
            #     @decorator
            #     class mydecoratorclass(object):
            #         def __init__(self, arg=None):
            #             self.arg = arg
            #         def __call__(self, wrapped, instance, args, kwargs):
            #             return wrapped(*args, **kwargs)
            #
            #     @mydecoratorclass(arg=1)
            #     def function():
            #         pass
            #
            # In this case an instance of the class is to be used as the
            # decorator wrapper function. If args was empty at this point,
            # then it means that there were optional keyword arguments
            # supplied to be used when creating an instance of the class
            # to be used as the wrapper function.

            if instance is None and isclass(wrapped) and not args:
                # We still need to be passed the target function to be
                # wrapped as yet, so we need to return a further function
                # to be able to capture it.

                def _capture(target_wrapped):
                    # Now have the target function to be wrapped and need
                    # to create an instance of the class which is to act
                    # as the decorator wrapper function. Before we do that,
                    # we need to first check that use of the decorator
                    # hadn't been disabled by a simple boolean. If it was,
                    # the target function to be wrapped is returned instead.

                    _enabled = enabled
                    if type(_enabled) is bool:
                        if not _enabled:
                            return target_wrapped
                        _enabled = None

                    # Now create an instance of the class which is to act
                    # as the decorator wrapper function. Any arguments had
                    # to be supplied as keyword only arguments so that is
                    # all we pass when creating it.

                    target_wrapper = wrapped(**kwargs)

                    # Finally build the wrapper itself and return it.

                    return _build(target_wrapped, target_wrapper,
                            _enabled, adapter)

                return _capture

            # We should always have the target function to be wrapped at
            # this point as the first (and only) value in args.

            target_wrapped = args[0]

            # Need to now check that use of the decorator hadn't been
            # disabled by a simple boolean. If it was, then target
            # function to be wrapped is returned instead.

            _enabled = enabled
            if type(_enabled) is bool:
                if not _enabled:
                    return target_wrapped
                _enabled = None

            # We now need to build the wrapper, but there are a couple of
            # different cases we need to consider.

            if instance is None:
                if isclass(wrapped):
                    # In this case the decorator was applied to a class
                    # type but optional keyword arguments were not supplied
                    # for initialising an instance of the class to be used
                    # as the decorator wrapper function.
                    #
                    #     @decorator
                    #     class mydecoratorclass(object):
                    #         def __init__(self, arg=None):
                    #             self.arg = arg
                    #         def __call__(self, wrapped, instance,
                    #                 args, kwargs):
                    #             return wrapped(*args, **kwargs)
                    #
                    #     @mydecoratorclass
                    #     def function():
                    #         pass
                    #
                    # We still need to create an instance of the class to
                    # be used as the decorator wrapper function, but no
                    # arguments are pass.

                    target_wrapper = wrapped()

                else:
                    # In this case the decorator was applied to a normal
                    # function, or possibly a static method of a class.
                    #
                    #     @decorator
                    #     def mydecoratorfuntion(wrapped, instance,
                    #             args, kwargs):
                    #         return wrapped(*args, **kwargs)
                    #
                    #     @mydecoratorfunction
                    #     def function():
                    #         pass
                    #
                    # That normal function becomes the decorator wrapper
                    # function.

                    target_wrapper = wrapper

            else:
                if isclass(instance):
                    # In this case the decorator was applied to a class
                    # method.
                    #
                    #     class myclass(object):
                    #         @decorator
                    #         @classmethod
                    #         def decoratorclassmethod(cls, wrapped,
                    #                 instance, args, kwargs):
                    #             return wrapped(*args, **kwargs)
                    #
                    #     instance = myclass()
                    #
                    #     @instance.decoratorclassmethod
                    #     def function():
                    #         pass
                    #
                    # This one is a bit strange because binding was actually
                    # performed on the wrapper created by our decorator
                    # factory. We need to apply that binding to the decorator
                    # wrapper function which which the decorator factory
                    # was applied to.

                    target_wrapper = wrapper.__get__(None, instance)

                else:
                    # In this case the decorator was applied to an instance
                    # method.
                    #
                    #     class myclass(object):
                    #         @decorator
                    #         def decoratorclassmethod(self, wrapped,
                    #                 instance, args, kwargs):
                    #             return wrapped(*args, **kwargs)
                    #
                    #     instance = myclass()
                    #
                    #     @instance.decoratorclassmethod
                    #     def function():
                    #         pass
                    #
                    # This one is a bit strange because binding was actually
                    # performed on the wrapper created by our decorator
                    # factory. We need to apply that binding to the decorator
                    # wrapper function which which the decorator factory
                    # was applied to.

                    target_wrapper = wrapper.__get__(instance, type(instance))

            # Finally build the wrapper itself and return it.

            return _build(target_wrapped, target_wrapper, _enabled, adapter)

        # We first return our magic function wrapper here so we can
        # determine in what context the decorator factory was used. In
        # other words, it is itself a universal decorator.

        return _build(wrapper, _wrapper)

    else:
        # The wrapper still has not been provided, so we are just
        # collecting the optional keyword arguments. Return the
        # decorator again wrapped in a partial using the collected
        # arguments.

        return partial(decorator, enabled=enabled, adapter=adapter)

# Decorator for implementing thread synchronization. It can be used as a
# decorator, in which case the synchronization context is determined by
# what type of function is wrapped, or it can also be used as a context
# manager, where the user needs to supply the correct synchronization
# context. It is also possible to supply an object which appears to be a
# synchronization primitive of some sort, by virtue of having release()
# and acquire() methods. In that case that will be used directly as the
# synchronization primitive without creating a separate lock against the
# derived or supplied context.

def synchronized(wrapped):
    # Determine if being passed an object which is a synchronization
    # primitive. We can't check by type for Lock, RLock, Semaphore etc,
    # as the means of creating them isn't the type. Therefore use the
    # existence of acquire() and release() methods. This is more
    # extensible anyway as it allows custom synchronization mechanisms.

    if hasattr(wrapped, 'acquire') and hasattr(wrapped, 'release'):
        # We remember what the original lock is and then return a new
        # decorator which accesses and locks it. When returning the new
        # decorator we wrap it with an object proxy so we can override
        # the context manager methods in case it is being used to wrap
        # synchronized statements with a 'with' statement.

        lock = wrapped

        @decorator
        def _synchronized(wrapped, instance, args, kwargs):
            # Execute the wrapped function while the original supplied
            # lock is held.

            with lock:
                return wrapped(*args, **kwargs)

        class _PartialDecorator(CallableObjectProxy):

            def __enter__(self):
                lock.acquire()
                return lock

            def __exit__(self, *args):
                lock.release()

        return _PartialDecorator(wrapped=_synchronized)

    # Following only apply when the lock is being created automatically
    # based on the context of what was supplied. In this case we supply
    # a final decorator, but need to use FunctionWrapper directly as we
    # want to derive from it to add context manager methods in case it is
    # being used to wrap synchronized statements with a 'with' statement.

    def _synchronized_lock(context):
        # Attempt to retrieve the lock for the specific context.

        lock = vars(context).get('_synchronized_lock', None)

        if lock is None:
            # There is no existing lock defined for the context we
            # are dealing with so we need to create one. This needs
            # to be done in a way to guarantee there is only one
            # created, even if multiple threads try and create it at
            # the same time. We can't always use the setdefault()
            # method on the __dict__ for the context. This is the
            # case where the context is a class, as __dict__ is
            # actually a dictproxy. What we therefore do is use a
            # meta lock on this wrapper itself, to control the
            # creation and assignment of the lock attribute against
            # the context.

            meta_lock = vars(synchronized).setdefault(
                    '_synchronized_meta_lock', Lock())

            with meta_lock:
                # We need to check again for whether the lock we want
                # exists in case two threads were trying to create it
                # at the same time and were competing to create the
                # meta lock.

                lock = vars(context).get('_synchronized_lock', None)

                if lock is None:
                    lock = RLock()
                    setattr(context, '_synchronized_lock', lock)

        return lock

    def _synchronized_wrapper(wrapped, instance, args, kwargs):
        # Execute the wrapped function while the lock for the
        # desired context is held. If instance is None then the
        # wrapped function is used as the context.

        with _synchronized_lock(instance or wrapped):
            return wrapped(*args, **kwargs)

    class _FinalDecorator(FunctionWrapper):

        def __enter__(self):
            self._self_lock = _synchronized_lock(self.__wrapped__)
            self._self_lock.acquire()
            return self._self_lock

        def __exit__(self, *args):
            self._self_lock.release()

    return _FinalDecorator(wrapped=wrapped, wrapper=_synchronized_wrapper)
