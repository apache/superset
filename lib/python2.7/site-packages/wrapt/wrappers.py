import sys
import functools
import operator
import weakref
import inspect

PY2 = sys.version_info[0] == 2
PY3 = sys.version_info[0] == 3

if PY3:
    string_types = str,
else:
    string_types = basestring,

def with_metaclass(meta, *bases):
    """Create a base class with a metaclass."""
    return meta("NewBase", bases, {})

class _ObjectProxyMethods(object):

    # We use properties to override the values of __module__ and
    # __doc__. If we add these in ObjectProxy, the derived class
    # __dict__ will still be setup to have string variants of these
    # attributes and the rules of descriptors means that they appear to
    # take precedence over the properties in the base class. To avoid
    # that, we copy the properties into the derived class type itself
    # via a meta class. In that way the properties will always take
    # precedence.

    @property
    def __module__(self):
        return self.__wrapped__.__module__

    @__module__.setter
    def __module__(self, value):
        self.__wrapped__.__module__ = value

    @property
    def __doc__(self):
        return self.__wrapped__.__doc__

    @__doc__.setter
    def __doc__(self, value):
        self.__wrapped__.__doc__ = value

    # We similar use a property for __dict__. We need __dict__ to be
    # explicit to ensure that vars() works as expected.

    @property
    def __dict__(self):
        return self.__wrapped__.__dict__

    # Need to also propagate the special __weakref__ attribute for case
    # where decorating classes which will define this. If do not define
    # it and use a function like inspect.getmembers() on a decorator
    # class it will fail. This can't be in the derived classes.

    @property
    def __weakref__(self):
        return self.__wrapped__.__weakref__

class _ObjectProxyMetaType(type):
    def __new__(cls, name, bases, dictionary):
        # Copy our special properties into the class so that they
        # always take precedence over attributes of the same name added
        # during construction of a derived class. This is to save
        # duplicating the implementation for them in all derived classes.

        dictionary.update(vars(_ObjectProxyMethods))

        return type.__new__(cls, name, bases, dictionary)

class ObjectProxy(with_metaclass(_ObjectProxyMetaType)):

    __slots__ = '__wrapped__'

    def __init__(self, wrapped):
        object.__setattr__(self, '__wrapped__', wrapped)

        # Python 3.2+ has the __qualname__ attribute, but it does not
        # allow it to be overridden using a property and it must instead
        # be an actual string object instead.

        try:
            object.__setattr__(self, '__qualname__', wrapped.__qualname__)
        except AttributeError:
            pass

    @property
    def __name__(self):
        return self.__wrapped__.__name__

    @__name__.setter
    def __name__(self, value):
        self.__wrapped__.__name__ = value

    @property
    def __class__(self):
        return self.__wrapped__.__class__

    @__class__.setter
    def __class__(self, value):
        self.__wrapped__.__class__ = value

    @property
    def __annotations__(self):
        return self.__wrapped__.__anotations__

    @__annotations__.setter
    def __annotations__(self, value):
        self.__wrapped__.__annotations__ = value

    def __dir__(self):
        return dir(self.__wrapped__)

    def __str__(self):
        return str(self.__wrapped__)

    if PY3:
        def __bytes__(self):
            return bytes(self.__wrapped__)

    def __repr__(self):
        return '<%s at 0x%x for %s at 0x%x>' % (
                type(self).__name__, id(self),
                type(self.__wrapped__).__name__,
                id(self.__wrapped__))

    def __reversed__(self):
        return reversed(self.__wrapped__)

    if PY3:
        def __round__(self):
            return round(self.__wrapped__)

    def __lt__(self, other):
        return self.__wrapped__ < other

    def __le__(self, other):
        return self.__wrapped__ <= other

    def __eq__(self, other):
        return self.__wrapped__ == other

    def __ne__(self, other):
        return self.__wrapped__ != other

    def __gt__(self, other):
        return self.__wrapped__ > other

    def __ge__(self, other):
        return self.__wrapped__ >= other

    def __hash__(self):
        return hash(self.__wrapped__)

    def __nonzero__(self):
        return bool(self.__wrapped__)

    def __bool__(self):
        return bool(self.__wrapped__)

    def __setattr__(self, name, value):
        if name.startswith('_self_'):
            object.__setattr__(self, name, value)

        elif name == '__wrapped__':
            object.__setattr__(self, name, value)
            try:
                object.__delattr__(self, '__qualname__')
            except AttributeError:
                pass
            try:
                object.__setattr__(self, '__qualname__', value.__qualname__)
            except AttributeError:
                pass

        elif name == '__qualname__':
            setattr(self.__wrapped__, name, value)
            object.__setattr__(self, name, value)

        elif hasattr(type(self), name):
            object.__setattr__(self, name, value)

        else:
            setattr(self.__wrapped__, name, value)

    def __getattr__(self, name):
        # If we are being to lookup '__wrapped__' then the
        # '__init__()' method cannot have been called.

        if name == '__wrapped__':
            raise ValueError('wrapper has not been initialised')

        return getattr(self.__wrapped__, name)

    def __delattr__(self, name):
        if name.startswith('_self_'):
            object.__delattr__(self, name)

        elif name == '__wrapped__':
            raise TypeError('__wrapped__ must be an object')

        elif name == '__qualname__':
            object.__delattr__(self, name)
            delattr(self.__wrapped__, name)

        elif hasattr(type(self), name):
            object.__delattr__(self, name)

        else:
            delattr(self.__wrapped__, name)

    def __add__(self, other):
        return self.__wrapped__ + other

    def __sub__(self, other):
        return self.__wrapped__ - other

    def __mul__(self, other):
        return self.__wrapped__ * other

    def __div__(self, other):
        return operator.div(self.__wrapped__, other)

    def __truediv__(self, other):
        return operator.truediv(self.__wrapped__, other)

    def __floordiv__(self, other):
        return self.__wrapped__ // other

    def __mod__(self, other):
        return self.__wrapped__ % other

    def __divmod__(self, other):
        return divmod(self.__wrapped__, other)

    def __pow__(self, other, *args):
        return pow(self.__wrapped__, other, *args)

    def __lshift__(self, other):
        return self.__wrapped__ << other

    def __rshift__(self, other):
        return self.__wrapped__ >> other

    def __and__(self, other):
        return self.__wrapped__ & other

    def __xor__(self, other):
        return self.__wrapped__ ^ other

    def __or__(self, other):
        return self.__wrapped__ | other

    def __radd__(self, other):
        return other + self.__wrapped__

    def __rsub__(self, other):
        return other - self.__wrapped__

    def __rmul__(self, other):
        return other * self.__wrapped__

    def __rdiv__(self, other):
        return operator.div(other, self.__wrapped__)

    def __rtruediv__(self, other):
        return operator.truediv(other, self.__wrapped__)

    def __rfloordiv__(self, other):
        return other // self.__wrapped__

    def __rmod__(self, other):
        return other % self.__wrapped__

    def __rdivmod__(self, other):
        return divmod(other, self.__wrapped__)

    def __rpow__(self, other, *args):
        return pow(other, self.__wrapped__, *args)

    def __rlshift__(self, other):
        return other << self.__wrapped__

    def __rrshift__(self, other):
        return other >> self.__wrapped__

    def __rand__(self, other):
        return other & self.__wrapped__

    def __rxor__(self, other):
        return other ^ self.__wrapped__

    def __ror__(self, other):
        return other | self.__wrapped__

    def __iadd__(self, other):
        self.__wrapped__ += other
        return self

    def __isub__(self, other):
        self.__wrapped__ -= other
        return self

    def __imul__(self, other):
        self.__wrapped__ *= other
        return self

    def __idiv__(self, other):
        self.__wrapped__ = operator.idiv(self.__wrapped__, other)
        return self

    def __itruediv__(self, other):
        self.__wrapped__ = operator.itruediv(self.__wrapped__, other)
        return self

    def __ifloordiv__(self, other):
        self.__wrapped__ //= other
        return self

    def __imod__(self, other):
        self.__wrapped__ %= other
        return self

    def __ipow__(self, other):
        self.__wrapped__ **= other
        return self

    def __ilshift__(self, other):
        self.__wrapped__ <<= other
        return self

    def __irshift__(self, other):
        self.__wrapped__ >>= other
        return self

    def __iand__(self, other):
        self.__wrapped__ &= other
        return self

    def __ixor__(self, other):
        self.__wrapped__ ^= other
        return self

    def __ior__(self, other):
        self.__wrapped__ |= other
        return self

    def __neg__(self):
        return -self.__wrapped__

    def __pos__(self):
        return +self.__wrapped__

    def __abs__(self):
        return abs(self.__wrapped__)

    def __invert__(self):
        return ~self.__wrapped__

    def __int__(self):
        return int(self.__wrapped__)

    def __long__(self):
        return long(self.__wrapped__)

    def __float__(self):
        return float(self.__wrapped__)

    def __oct__(self):
        return oct(self.__wrapped__)

    def __hex__(self):
        return hex(self.__wrapped__)

    def __index__(self):
        return operator.index(self.__wrapped__)

    def __len__(self):
        return len(self.__wrapped__)

    def __contains__(self, value):
        return value in self.__wrapped__

    def __getitem__(self, key):
        return self.__wrapped__[key]

    def __setitem__(self, key, value):
        self.__wrapped__[key] = value

    def __delitem__(self, key):
        del self.__wrapped__[key]

    def __getslice__(self, i, j):
        return self.__wrapped__[i:j]

    def __setslice__(self, i, j, value):
        self.__wrapped__[i:j] = value

    def __delslice__(self, i, j):
        del self.__wrapped__[i:j]

    def __enter__(self):
        return self.__wrapped__.__enter__()

    def __exit__(self, *args, **kwargs):
        return self.__wrapped__.__exit__(*args, **kwargs)

    def __iter__(self):
        return iter(self.__wrapped__)

class CallableObjectProxy(ObjectProxy):

    def __call__(self, *args, **kwargs):
        return self.__wrapped__(*args, **kwargs)

class _FunctionWrapperBase(ObjectProxy):

    __slots__ = ('_self_instance', '_self_wrapper', '_self_enabled',
            '_self_binding', '_self_parent')

    def __init__(self, wrapped, instance, wrapper, enabled=None,
            binding='function', parent=None):

        super(_FunctionWrapperBase, self).__init__(wrapped)

        object.__setattr__(self, '_self_instance', instance)
        object.__setattr__(self, '_self_wrapper', wrapper)
        object.__setattr__(self, '_self_enabled', enabled)
        object.__setattr__(self, '_self_binding', binding)
        object.__setattr__(self, '_self_parent', parent)

    def __get__(self, instance, owner):
        # This method is actually doing double duty for both unbound and
        # bound derived wrapper classes. It should possibly be broken up
        # and the distinct functionality moved into the derived classes.
        # Can't do that straight away due to some legacy code which is
        # relying on it being here in this base class.
        #
        # The distinguishing attribute which determines whether we are
        # being called in an unbound or bound wrapper is the parent
        # attribute. If binding has never occurred, then the parent will
        # be None.
        #
        # First therefore, is if we are called in an unbound wrapper. In
        # this case we perform the binding.
        #
        # We have one special case to worry about here. This is where we
        # are decorating a nested class. In this case the wrapped class
        # would not have a __get__() method to call. In that case we
        # simply return self.
        #
        # Note that we otherwise still do binding even if instance is
        # None and accessing an unbound instance method from a class.
        # This is because we need to be able to later detect that
        # specific case as we will need to extract the instance from the
        # first argument of those passed in.

        if self._self_parent is None:
            if not inspect.isclass(self.__wrapped__):
                descriptor = self.__wrapped__.__get__(instance, owner)

                return self.__bound_function_wrapper__(descriptor, instance,
                        self._self_wrapper, self._self_enabled,
                        self._self_binding, self)

            return self

        # Now we have the case of binding occurring a second time on what
        # was already a bound function. In this case we would usually
        # return ourselves again. This mirrors what Python does.
        #
        # The special case this time is where we were originally bound
        # with an instance of None and we were likely an instance
        # method. In that case we rebind against the original wrapped
        # function from the parent again.

        if self._self_instance is None and self._self_binding == 'function':
            descriptor = self._self_parent.__wrapped__.__get__(
                    instance, owner)

            return self._self_parent.__bound_function_wrapper__(
                    descriptor, instance, self._self_wrapper,
                    self._self_enabled, self._self_binding,
                    self._self_parent)

        return self

    def __call__(self, *args, **kwargs):
        # If enabled has been specified, then evaluate it at this point
        # and if the wrapper is not to be executed, then simply return
        # the bound function rather than a bound wrapper for the bound
        # function. When evaluating enabled, if it is callable we call
        # it, otherwise we evaluate it as a boolean.

        if self._self_enabled is not None:
            if callable(self._self_enabled):
                if not self._self_enabled():
                    return self.__wrapped__(*args, **kwargs)
            elif not self._self_enabled:
                return self.__wrapped__(*args, **kwargs)

        # This can occur where initial function wrapper was applied to
        # a function that was already bound to an instance. In that case
        # we want to extract the instance from the function and use it.

        if self._self_binding == 'function':
            if self._self_instance is None:
                instance = getattr(self.__wrapped__, '__self__', None)
                if instance is not None:
                    return self._self_wrapper(self.__wrapped__, instance,
                            args, kwargs)

        # This is generally invoked when the wrapped function is being
        # called as a normal function and is not bound to a class as an
        # instance method. This is also invoked in the case where the
        # wrapped function was a method, but this wrapper was in turn
        # wrapped using the staticmethod decorator.

        return self._self_wrapper(self.__wrapped__, self._self_instance,
                args, kwargs)

class BoundFunctionWrapper(_FunctionWrapperBase):

    def __call__(self, *args, **kwargs):
        # If enabled has been specified, then evaluate it at this point
        # and if the wrapper is not to be executed, then simply return
        # the bound function rather than a bound wrapper for the bound
        # function. When evaluating enabled, if it is callable we call
        # it, otherwise we evaluate it as a boolean.

        if self._self_enabled is not None:
            if callable(self._self_enabled):
                if not self._self_enabled():
                    return self.__wrapped__(*args, **kwargs)
            elif not self._self_enabled:
                return self.__wrapped__(*args, **kwargs)

        # We need to do things different depending on whether we are
        # likely wrapping an instance method vs a static method or class
        # method.

        if self._self_binding == 'function':
            if self._self_instance is None:
                # This situation can occur where someone is calling the
                # instancemethod via the class type and passing the instance
                # as the first argument. We need to shift the args before
                # making the call to the wrapper and effectively bind the
                # instance to the wrapped function using a partial so the
                # wrapper doesn't see anything as being different.

                if not args:
                    raise TypeError('missing 1 required positional argument')

                instance, args = args[0], args[1:]
                wrapped = functools.partial(self.__wrapped__, instance)
                return self._self_wrapper(wrapped, instance, args, kwargs)

            return self._self_wrapper(self.__wrapped__, self._self_instance,
                    args, kwargs)

        else:
            # As in this case we would be dealing with a classmethod or
            # staticmethod, then _self_instance will only tell us whether
            # when calling the classmethod or staticmethod they did it via an
            # instance of the class it is bound to and not the case where
            # done by the class type itself. We thus ignore _self_instance
            # and use the __self__ attribute of the bound function instead.
            # For a classmethod, this means instance will be the class type
            # and for a staticmethod it will be None. This is probably the
            # more useful thing we can pass through even though we loose
            # knowledge of whether they were called on the instance vs the
            # class type, as it reflects what they have available in the
            # decoratored function.

            instance = getattr(self.__wrapped__, '__self__', None)

            return self._self_wrapper(self.__wrapped__, instance, args,
                    kwargs)

class FunctionWrapper(_FunctionWrapperBase):

    __bound_function_wrapper__ = BoundFunctionWrapper

    def __init__(self, wrapped, wrapper, enabled=None):
        # What it is we are wrapping here could be anything. We need to
        # try and detect specific cases though. In particular, we need
        # to detect when we are given something that is a method of a
        # class. Further, we need to know when it is likely an instance
        # method, as opposed to a class or static method. This can
        # become problematic though as there isn't strictly a fool proof
        # method of knowing.
        #
        # The situations we could encounter when wrapping a method are:
        #
        # 1. The wrapper is being applied as part of a decorator which
        # is a part of the class definition. In this case what we are
        # given is the raw unbound function, classmethod or staticmethod
        # wrapper objects.
        #
        # The problem here is that we will not know we are being applied
        # in the context of the class being set up. This becomes
        # important later for the case of an instance method, because in
        # that case we just see it as a raw function and can't
        # distinguish it from wrapping a normal function outside of
        # a class context.
        #
        # 2. The wrapper is being applied when performing monkey
        # patching of the class type afterwards and the method to be
        # wrapped was retrieved direct from the __dict__ of the class
        # type. This is effectively the same as (1) above.
        #
        # 3. The wrapper is being applied when performing monkey
        # patching of the class type afterwards and the method to be
        # wrapped was retrieved from the class type. In this case
        # binding will have been performed where the instance against
        # which the method is bound will be None at that point.
        #
        # This case is a problem because we can no longer tell if the
        # method was a static method, plus if using Python3, we cannot
        # tell if it was an instance method as the concept of an
        # unnbound method no longer exists.
        #
        # 4. The wrapper is being applied when performing monkey
        # patching of an instance of a class. In this case binding will
        # have been perfomed where the instance was not None.
        #
        # This case is a problem because we can no longer tell if the
        # method was a static method.
        #
        # Overall, the best we can do is look at the original type of the
        # object which was wrapped prior to any binding being done and
        # see if it is an instance of classmethod or staticmethod. In
        # the case where other decorators are between us and them, if
        # they do not propagate the __class__  attribute so that the
        # isinstance() checks works, then likely this will do the wrong
        # thing where classmethod and staticmethod are used.
        #
        # Since it is likely to be very rare that anyone even puts
        # decorators around classmethod and staticmethod, likelihood of
        # that being an issue is very small, so we accept it and suggest
        # that those other decorators be fixed. It is also only an issue
        # if a decorator wants to actually do things with the arguments.
        #
        # As to not being able to identify static methods properly, we
        # just hope that that isn't something people are going to want
        # to wrap, or if they do suggest they do it the correct way by
        # ensuring that it is decorated in the class definition itself,
        # or patch it in the __dict__ of the class type.
        #
        # So to get the best outcome we can, whenever we aren't sure what
        # it is, we label it as a 'function'. If it was already bound and
        # that is rebound later, we assume that it will be an instance
        # method and try an cope with the possibility that the 'self'
        # argument it being passed as an explicit argument and shuffle
        # the arguments around to extract 'self' for use as the instance.

        if isinstance(wrapped, classmethod):
            binding = 'classmethod'

        elif isinstance(wrapped, staticmethod):
            binding = 'staticmethod'

        elif hasattr(wrapped, '__self__'):
            if inspect.isclass(wrapped.__self__):
                binding = 'classmethod'
            else:
                binding = 'function'

        else:
            binding = 'function'

        super(FunctionWrapper, self).__init__(wrapped, None, wrapper,
                enabled, binding)

try:
    from ._wrappers import (ObjectProxy, CallableObjectProxy, FunctionWrapper,
        BoundFunctionWrapper, _FunctionWrapperBase)
except ImportError:
    pass

# Helper functions for applying wrappers to existing functions.

def resolve_path(module, name):
    if isinstance(module, string_types):
        __import__(module)
        module = sys.modules[module]

    parent = module

    path = name.split('.')
    attribute = path[0]

    original = getattr(parent, attribute)
    for attribute in path[1:]:
        parent = original

        # We can't just always use getattr() because in doing
        # that on a class it will cause binding to occur which
        # will complicate things later and cause some things not
        # to work. For the case of a class we therefore access
        # the __dict__ directly. To cope though with the wrong
        # class being given to us, or a method being moved into
        # a base class, we need to walk the class hierarchy to
        # work out exactly which __dict__ the method was defined
        # in, as accessing it from __dict__ will fail if it was
        # not actually on the class given. Fallback to using
        # getattr() if we can't find it. If it truly doesn't
        # exist, then that will fail.

        if inspect.isclass(original):
            for cls in inspect.getmro(original):
                if attribute in vars(original):
                    original = vars(original)[attribute]
                    break
            else:
                original = getattr(original, attribute)

        else:
            original = getattr(original, attribute)

    return (parent, attribute, original)

def apply_patch(parent, attribute, replacement):
    setattr(parent, attribute, replacement)

def wrap_object(module, name, factory, args=(), kwargs={}):
    (parent, attribute, original) = resolve_path(module, name)
    wrapper = factory(original, *args, **kwargs)
    apply_patch(parent, attribute, wrapper)
    return wrapper

# Function for applying a proxy object to an attribute of a class
# instance. The wrapper works by defining an attribute of the same name
# on the class which is a descriptor and which intercepts access to the
# instance attribute. Note that this cannot be used on attributes which
# are themselves defined by a property object.

class AttributeWrapper(object):

    def __init__(self, attribute, factory, args, kwargs):
        self.attribute = attribute
        self.factory = factory
        self.args = args
        self.kwargs = kwargs

    def __get__(self, instance, owner):
        value = instance.__dict__[self.attribute]
        return self.factory(value, *self.args, **self.kwargs)

    def __set__(self, instance, value):
        instance.__dict__[self.attribute] = value

    def __delete__(self, instance):
        del instance.__dict__[self.attribute]

def wrap_object_attribute(module, name, factory, args=(), kwargs={}):
    path, attribute = name.rsplit('.', 1)
    parent = resolve_path(module, path)[2]
    wrapper = AttributeWrapper(attribute, factory, args, kwargs)
    apply_patch(parent, attribute, wrapper)
    return wrapper

# Functions for creating a simple decorator using a FunctionWrapper,
# plus short cut functions for applying wrappers to functions. These are
# for use when doing monkey patching. For a more featured way of
# creating decorators see the decorator decorator instead.

def function_wrapper(wrapper):
    def _wrapper(wrapped, instance, args, kwargs):
        target_wrapped = args[0]
        if instance is None:
            target_wrapper = wrapper
        elif inspect.isclass(instance):
            target_wrapper = wrapper.__get__(None, instance)
        else:
            target_wrapper = wrapper.__get__(instance, type(instance))
        return FunctionWrapper(target_wrapped, target_wrapper)
    return FunctionWrapper(wrapper, _wrapper)

def wrap_function_wrapper(module, name, wrapper):
    return wrap_object(module, name, FunctionWrapper, (wrapper,))

def patch_function_wrapper(module, name):
    def _wrapper(wrapper):
        return wrap_object(module, name, FunctionWrapper, (wrapper,))
    return _wrapper

def transient_function_wrapper(module, name):
    def _decorator(wrapper):
        def _wrapper(wrapped, instance, args, kwargs):
            target_wrapped = args[0]
            if instance is None:
                target_wrapper = wrapper
            elif inspect.isclass(instance):
                target_wrapper = wrapper.__get__(None, instance)
            else:
                target_wrapper = wrapper.__get__(instance, type(instance))
            def _execute(wrapped, instance, args, kwargs):
                (parent, attribute, original) = resolve_path(module, name)
                replacement = FunctionWrapper(original, target_wrapper)
                setattr(parent, attribute, replacement)
                try:
                    return wrapped(*args, **kwargs)
                finally:
                    setattr(parent, attribute, original)
            return FunctionWrapper(target_wrapped, _execute)
        return FunctionWrapper(wrapper, _wrapper)
    return _decorator

# A weak function proxy. This will work on instance methods, class
# methods, static methods and regular functions. Special treatment is
# needed for the method types because the bound method is effectively a
# transient object and applying a weak reference to one will immediately
# result in it being destroyed and the weakref callback called. The weak
# reference is therefore applied to the instance the method is bound to
# and the original function. The function is then rebound at the point
# of a call via the weak function proxy.

def _weak_function_proxy_callback(ref, proxy, callback):
    if proxy._self_expired:
        return

    proxy._self_expired = True

    # This could raise an exception. We let it propagate back and let
    # the weakref.proxy() deal with it, at which point it generally
    # prints out a short error message direct to stderr and keeps going.

    if callback is not None:
        callback(proxy)

class WeakFunctionProxy(ObjectProxy):

    __slots__ = ('_self_expired', '_self_instance')

    def __init__(self, wrapped, callback=None):
        # We need to determine if the wrapped function is actually a
        # bound method. In the case of a bound method, we need to keep a
        # reference to the original unbound function and the instance.
        # This is necessary because if we hold a reference to the bound
        # function, it will be the only reference and given it is a
        # temporary object, it will almost immediately expire and
        # the weakref callback triggered. So what is done is that we
        # hold a reference to the instance and unbound function and
        # when called bind the function to the instance once again and
        # then call it. Note that we avoid using a nested function for
        # the callback here so as not to cause any odd reference cycles.

        _callback = callback and functools.partial(
                _weak_function_proxy_callback, proxy=self,
                callback=callback)

        self._self_expired = False

        if isinstance(wrapped, _FunctionWrapperBase):
            self._self_instance = weakref.ref(wrapped._self_instance,
                    _callback)

            if wrapped._self_parent is not None:
                super(WeakFunctionProxy, self).__init__(
                        weakref.proxy(wrapped._self_parent, _callback))

            else:
                super(WeakFunctionProxy, self).__init__(
                        weakref.proxy(wrapped, _callback))

            return

        try:
            self._self_instance = weakref.ref(wrapped.__self__, _callback)

            super(WeakFunctionProxy, self).__init__(
                    weakref.proxy(wrapped.__func__, _callback))

        except AttributeError:
            self._self_instance = None

            super(WeakFunctionProxy, self).__init__(
                    weakref.proxy(wrapped, _callback))

    def __call__(self, *args, **kwargs):
        # We perform a boolean check here on the instance and wrapped
        # function as that will trigger the reference error prior to
        # calling if the reference had expired.

        instance = self._self_instance and self._self_instance()
        function = self.__wrapped__ and self.__wrapped__

        # If the wrapped function was originally a bound function, for
        # which we retained a reference to the instance and the unbound
        # function we need to rebind the function and then call it. If
        # not just called the wrapped function.

        if instance is None:
            return self.__wrapped__(*args, **kwargs)

        return function.__get__(instance, type(instance))(*args, **kwargs)
