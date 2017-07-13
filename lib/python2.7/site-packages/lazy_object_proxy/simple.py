import operator

from .compat import PY2
from .compat import PY3
from .compat import with_metaclass
from .utils import cached_property
from .utils import identity


def make_proxy_method(code):
    def proxy_wrapper(self, *args):
        return code(self.__wrapped__, *args)

    return proxy_wrapper


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
        dictionary.pop('__dict__')

        return type.__new__(cls, name, bases, dictionary)


class Proxy(with_metaclass(_ProxyMetaType)):
    __factory__ = None

    def __init__(self, factory):
        self.__dict__['__factory__'] = factory

    @cached_property
    def __wrapped__(self):
        self = self.__dict__
        if '__factory__' in self:
            factory = self['__factory__']
            return factory()
        else:
            raise ValueError("Proxy hasn't been initiated: __factory__ is missing.")

    __name__ = property(make_proxy_method(operator.attrgetter('__name__')))
    __class__ = property(make_proxy_method(operator.attrgetter('__class__')))
    __annotations__ = property(make_proxy_method(operator.attrgetter('__anotations__')))
    __dir__ = make_proxy_method(dir)
    __str__ = make_proxy_method(str)

    if PY3:
        __bytes__ = make_proxy_method(bytes)

    def __repr__(self, __getattr__=object.__getattribute__):
        if '__wrapped__' in self.__dict__:
            return '<%s at 0x%x wrapping %r at 0x%x with factory %r>' % (
                type(self).__name__, id(self),
                self.__wrapped__, id(self.__wrapped__),
                self.__factory__
            )
        else:
            return '<%s at 0x%x with factory %r>' % (
                type(self).__name__, id(self),
                self.__factory__
            )

    __reversed__ = make_proxy_method(reversed)

    if PY3:
        __round__ = make_proxy_method(round)

    __lt__ = make_proxy_method(operator.lt)
    __le__ = make_proxy_method(operator.le)
    __eq__ = make_proxy_method(operator.eq)
    __ne__ = make_proxy_method(operator.ne)
    __gt__ = make_proxy_method(operator.gt)
    __ge__ = make_proxy_method(operator.ge)
    __hash__ = make_proxy_method(hash)
    __nonzero__ = make_proxy_method(bool)
    __bool__ = make_proxy_method(bool)

    def __setattr__(self, name, value):
        if hasattr(type(self), name):
            self.__dict__[name] = value
        else:
            setattr(self.__wrapped__, name, value)

    def __getattr__(self, name):
        if name in ('__wrapped__', '__factory__'):
            raise AttributeError(name)
        else:
            return getattr(self.__wrapped__, name)

    def __delattr__(self, name):
        if hasattr(type(self), name):
            del self.__dict__[name]
        else:
            delattr(self.__wrapped__, name)

    __add__ = make_proxy_method(operator.add)
    __sub__ = make_proxy_method(operator.sub)
    __mul__ = make_proxy_method(operator.mul)
    __div__ = make_proxy_method(operator.div if PY2 else operator.truediv)
    __truediv__ = make_proxy_method(operator.truediv)
    __floordiv__ = make_proxy_method(operator.floordiv)
    __mod__ = make_proxy_method(operator.mod)
    __divmod__ = make_proxy_method(divmod)
    __pow__ = make_proxy_method(pow)
    __lshift__ = make_proxy_method(operator.lshift)
    __rshift__ = make_proxy_method(operator.rshift)
    __and__ = make_proxy_method(operator.and_)
    __xor__ = make_proxy_method(operator.xor)
    __or__ = make_proxy_method(operator.or_)

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

    __iadd__ = make_proxy_method(operator.iadd)
    __isub__ = make_proxy_method(operator.isub)
    __imul__ = make_proxy_method(operator.imul)
    __idiv__ = make_proxy_method(operator.idiv if PY2 else operator.itruediv)
    __itruediv__ = make_proxy_method(operator.itruediv)
    __ifloordiv__ = make_proxy_method(operator.ifloordiv)
    __imod__ = make_proxy_method(operator.imod)
    __ipow__ = make_proxy_method(operator.ipow)
    __ilshift__ = make_proxy_method(operator.ilshift)
    __irshift__ = make_proxy_method(operator.irshift)
    __iand__ = make_proxy_method(operator.iand)
    __ixor__ = make_proxy_method(operator.ixor)
    __ior__ = make_proxy_method(operator.ior)
    __neg__ = make_proxy_method(operator.neg)
    __pos__ = make_proxy_method(operator.pos)
    __abs__ = make_proxy_method(operator.abs)
    __invert__ = make_proxy_method(operator.invert)

    __int__ = make_proxy_method(int)

    if PY2:
        __long__ = make_proxy_method(long)  # flake8: noqa

    __float__ = make_proxy_method(float)
    __oct__ = make_proxy_method(oct)
    __hex__ = make_proxy_method(hex)
    __index__ = make_proxy_method(operator.index)
    __len__ = make_proxy_method(len)
    __contains__ = make_proxy_method(operator.contains)
    __getitem__ = make_proxy_method(operator.getitem)
    __setitem__ = make_proxy_method(operator.setitem)
    __delitem__ = make_proxy_method(operator.delitem)

    if PY2:
        __getslice__ = make_proxy_method(operator.getslice)
        __setslice__ = make_proxy_method(operator.setslice)
        __delslice__ = make_proxy_method(operator.delslice)

    def __enter__(self):
        return self.__wrapped__.__enter__()

    def __exit__(self, *args, **kwargs):
        return self.__wrapped__.__exit__(*args, **kwargs)

    __iter__ = make_proxy_method(iter)

    def __call__(self, *args, **kwargs):
        return self.__wrapped__(*args, **kwargs)

    def __reduce__(self):
        return identity, (self.__wrapped__,)

    def __reduce_ex__(self, protocol):
        return identity, (self.__wrapped__,)
