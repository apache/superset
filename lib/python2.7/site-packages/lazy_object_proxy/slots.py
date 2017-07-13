import operator

from .compat import PY2
from .compat import PY3
from .compat import with_metaclass
from .utils import identity


class _ProxyMethods(object):
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


class _ProxyMetaType(type):
    def __new__(cls, name, bases, dictionary):
        # Copy our special properties into the class so that they
        # always take precedence over attributes of the same name added
        # during construction of a derived class. This is to save
        # duplicating the implementation for them in all derived classes.

        dictionary.update(vars(_ProxyMethods))

        return type.__new__(cls, name, bases, dictionary)


class Proxy(with_metaclass(_ProxyMetaType)):
    """
    A proxy implementation in pure Python, using slots. You can subclass this to add
    local methods or attributes, or enable __dict__.

    The most important internals:

    * ``__factory__`` is the callback that "materializes" the object we proxy to.
    * ``__target__`` will contain the object we proxy to, once it's "materialized".
    * ``__wrapped__`` is a property that does either:

      * return ``__target__`` if it's set.
      * calls ``__factory__``, saves result to ``__target__`` and returns said result.
    """

    __slots__ = '__target__', '__factory__'

    def __init__(self, factory):
        object.__setattr__(self, '__factory__', factory)

    @property
    def __wrapped__(self, __getattr__=object.__getattribute__, __setattr__=object.__setattr__,
                    __delattr__=object.__delattr__):
        try:
            return __getattr__(self, '__target__')
        except AttributeError:
            try:
                factory = __getattr__(self, '__factory__')
            except AttributeError:
                raise ValueError("Proxy hasn't been initiated: __factory__ is missing.")
            target = factory()
            __setattr__(self, '__target__', target)
            return target

    @__wrapped__.deleter
    def __wrapped__(self, __delattr__=object.__delattr__):
        __delattr__(self, '__target__')

    @__wrapped__.setter
    def __wrapped__(self, target, __setattr__=object.__setattr__):
        __setattr__(self, '__target__', target)

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

    def __repr__(self, __getattr__=object.__getattribute__):
        try:
            target = __getattr__(self, '__target__')
        except AttributeError:
            return '<%s at 0x%x with factory %r>' % (
                type(self).__name__, id(self),
                self.__factory__
            )
        else:
            return '<%s at 0x%x wrapping %r at 0x%x with factory %r>' % (
                type(self).__name__, id(self),
                target, id(target),
                self.__factory__
            )

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

    def __setattr__(self, name, value, __setattr__=object.__setattr__):
        if hasattr(type(self), name):
            __setattr__(self, name, value)
        else:
            setattr(self.__wrapped__, name, value)

    def __getattr__(self, name):
        if name in ('__wrapped__', '__factory__'):
            raise AttributeError(name)
        else:
            return getattr(self.__wrapped__, name)

    def __delattr__(self, name, __delattr__=object.__delattr__):
        if hasattr(type(self), name):
            __delattr__(self, name)
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
        return self.__wrapped__ ^ other

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

    if PY2:
        def __long__(self):
            return long(self.__wrapped__)  # flake8: noqa

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

    def __call__(self, *args, **kwargs):
        return self.__wrapped__(*args, **kwargs)

    def __reduce__(self):
        return identity, (self.__wrapped__,)

    def __reduce_ex__(self, protocol):
        return identity, (self.__wrapped__,)
