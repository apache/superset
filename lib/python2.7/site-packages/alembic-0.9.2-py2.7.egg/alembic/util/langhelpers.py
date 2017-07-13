import textwrap
import warnings
import inspect
import uuid
import collections

from .compat import callable, exec_, string_types, with_metaclass

from sqlalchemy.util import format_argspec_plus, update_wrapper
from sqlalchemy.util.compat import inspect_getfullargspec


class _ModuleClsMeta(type):
    def __setattr__(cls, key, value):
        super(_ModuleClsMeta, cls).__setattr__(key, value)
        cls._update_module_proxies(key)


class ModuleClsProxy(with_metaclass(_ModuleClsMeta)):
    """Create module level proxy functions for the
    methods on a given class.

    The functions will have a compatible signature
    as the methods.

    """

    _setups = collections.defaultdict(lambda: (set(), []))

    @classmethod
    def _update_module_proxies(cls, name):
        attr_names, modules = cls._setups[cls]
        for globals_, locals_ in modules:
            cls._add_proxied_attribute(name, globals_, locals_, attr_names)

    def _install_proxy(self):
        attr_names, modules = self._setups[self.__class__]
        for globals_, locals_ in modules:
            globals_['_proxy'] = self
            for attr_name in attr_names:
                globals_[attr_name] = getattr(self, attr_name)

    def _remove_proxy(self):
        attr_names, modules = self._setups[self.__class__]
        for globals_, locals_ in modules:
            globals_['_proxy'] = None
            for attr_name in attr_names:
                del globals_[attr_name]

    @classmethod
    def create_module_class_proxy(cls, globals_, locals_):
        attr_names, modules = cls._setups[cls]
        modules.append(
            (globals_, locals_)
        )
        cls._setup_proxy(globals_, locals_, attr_names)

    @classmethod
    def _setup_proxy(cls, globals_, locals_, attr_names):
        for methname in dir(cls):
            cls._add_proxied_attribute(methname, globals_, locals_, attr_names)

    @classmethod
    def _add_proxied_attribute(cls, methname, globals_, locals_, attr_names):
        if not methname.startswith('_'):
            meth = getattr(cls, methname)
            if callable(meth):
                locals_[methname] = cls._create_method_proxy(
                    methname, globals_, locals_)
            else:
                attr_names.add(methname)

    @classmethod
    def _create_method_proxy(cls, name, globals_, locals_):
        fn = getattr(cls, name)
        spec = inspect.getargspec(fn)
        if spec[0] and spec[0][0] == 'self':
            spec[0].pop(0)
        args = inspect.formatargspec(*spec)
        num_defaults = 0
        if spec[3]:
            num_defaults += len(spec[3])
        name_args = spec[0]
        if num_defaults:
            defaulted_vals = name_args[0 - num_defaults:]
        else:
            defaulted_vals = ()

        apply_kw = inspect.formatargspec(
            name_args, spec[1], spec[2],
            defaulted_vals,
            formatvalue=lambda x: '=' + x)

        def _name_error(name):
            raise NameError(
                "Can't invoke function '%s', as the proxy object has "
                "not yet been "
                "established for the Alembic '%s' class.  "
                "Try placing this code inside a callable." % (
                    name, cls.__name__
                ))
        globals_['_name_error'] = _name_error

        translations = getattr(fn, "_legacy_translations", [])
        if translations:
            outer_args = inner_args = "*args, **kw"
            translate_str = "args, kw = _translate(%r, %r, %r, args, kw)" % (
                fn.__name__,
                tuple(spec),
                translations
            )

            def translate(fn_name, spec, translations, args, kw):
                return_kw = {}
                return_args = []

                for oldname, newname in translations:
                    if oldname in kw:
                        warnings.warn(
                            "Argument %r is now named %r "
                            "for method %s()." % (
                                oldname, newname, fn_name
                            ))
                        return_kw[newname] = kw.pop(oldname)
                return_kw.update(kw)

                args = list(args)
                if spec[3]:
                    pos_only = spec[0][:-len(spec[3])]
                else:
                    pos_only = spec[0]
                for arg in pos_only:
                    if arg not in return_kw:
                        try:
                            return_args.append(args.pop(0))
                        except IndexError:
                            raise TypeError(
                                "missing required positional argument: %s"
                                % arg)
                return_args.extend(args)

                return return_args, return_kw
            globals_['_translate'] = translate
        else:
            outer_args = args[1:-1]
            inner_args = apply_kw[1:-1]
            translate_str = ""

        func_text = textwrap.dedent("""\
        def %(name)s(%(args)s):
            %(doc)r
            %(translate)s
            try:
                p = _proxy
            except NameError:
                _name_error('%(name)s')
            return _proxy.%(name)s(%(apply_kw)s)
            e
        """ % {
            'name': name,
            'translate': translate_str,
            'args': outer_args,
            'apply_kw': inner_args,
            'doc': fn.__doc__,
        })
        lcl = {}
        exec_(func_text, globals_, lcl)
        return lcl[name]


def _with_legacy_names(translations):
    def decorate(fn):
        fn._legacy_translations = translations
        return fn

    return decorate


def asbool(value):
    return value is not None and \
        value.lower() == 'true'


def rev_id():
    return uuid.uuid4().hex[-12:]


def to_list(x, default=None):
    if x is None:
        return default
    elif isinstance(x, string_types):
        return [x]
    elif isinstance(x, collections.Iterable):
        return list(x)
    else:
        return [x]


def to_tuple(x, default=None):
    if x is None:
        return default
    elif isinstance(x, string_types):
        return (x, )
    elif isinstance(x, collections.Iterable):
        return tuple(x)
    else:
        return (x, )


def unique_list(seq, hashfunc=None):
    seen = set()
    seen_add = seen.add
    if not hashfunc:
        return [x for x in seq
                if x not in seen
                and not seen_add(x)]
    else:
        return [x for x in seq
                if hashfunc(x) not in seen
                and not seen_add(hashfunc(x))]


def dedupe_tuple(tup):
    return tuple(unique_list(tup))



class memoized_property(object):

    """A read-only @property that is only evaluated once."""

    def __init__(self, fget, doc=None):
        self.fget = fget
        self.__doc__ = doc or fget.__doc__
        self.__name__ = fget.__name__

    def __get__(self, obj, cls):
        if obj is None:
            return self
        obj.__dict__[self.__name__] = result = self.fget(obj)
        return result


class immutabledict(dict):

    def _immutable(self, *arg, **kw):
        raise TypeError("%s object is immutable" % self.__class__.__name__)

    __delitem__ = __setitem__ = __setattr__ = \
        clear = pop = popitem = setdefault = \
        update = _immutable

    def __new__(cls, *args):
        new = dict.__new__(cls)
        dict.__init__(new, *args)
        return new

    def __init__(self, *args):
        pass

    def __reduce__(self):
        return immutabledict, (dict(self), )

    def union(self, d):
        if not self:
            return immutabledict(d)
        else:
            d2 = immutabledict(self)
            dict.update(d2, d)
            return d2

    def __repr__(self):
        return "immutabledict(%s)" % dict.__repr__(self)


class Dispatcher(object):
    def __init__(self, uselist=False):
        self._registry = {}
        self.uselist = uselist

    def dispatch_for(self, target, qualifier='default'):
        def decorate(fn):
            if self.uselist:
                self._registry.setdefault((target, qualifier), []).append(fn)
            else:
                assert (target, qualifier) not in self._registry
                self._registry[(target, qualifier)] = fn
            return fn
        return decorate

    def dispatch(self, obj, qualifier='default'):

        if isinstance(obj, string_types):
            targets = [obj]
        elif isinstance(obj, type):
            targets = obj.__mro__
        else:
            targets = type(obj).__mro__

        for spcls in targets:
            if qualifier != 'default' and (spcls, qualifier) in self._registry:
                return self._fn_or_list(
                    self._registry[(spcls, qualifier)])
            elif (spcls, 'default') in self._registry:
                return self._fn_or_list(
                    self._registry[(spcls, 'default')])
        else:
            raise ValueError("no dispatch function for object: %s" % obj)

    def _fn_or_list(self, fn_or_list):
        if self.uselist:
            def go(*arg, **kw):
                for fn in fn_or_list:
                    fn(*arg, **kw)
            return go
        else:
            return fn_or_list

    def branch(self):
        """Return a copy of this dispatcher that is independently
        writable."""

        d = Dispatcher()
        if self.uselist:
            d._registry.update(
                (k, [fn for fn in self._registry[k]])
                for k in self._registry
            )
        else:
            d._registry.update(self._registry)
        return d
