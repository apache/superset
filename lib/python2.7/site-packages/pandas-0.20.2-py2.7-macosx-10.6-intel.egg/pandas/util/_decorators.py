from pandas.compat import callable, signature
from pandas._libs.lib import cache_readonly  # noqa
import types
import warnings
from textwrap import dedent
from functools import wraps, update_wrapper


def deprecate(name, alternative, alt_name=None):
    alt_name = alt_name or alternative.__name__

    def wrapper(*args, **kwargs):
        warnings.warn("%s is deprecated. Use %s instead" % (name, alt_name),
                      FutureWarning, stacklevel=2)
        return alternative(*args, **kwargs)
    return wrapper


def deprecate_kwarg(old_arg_name, new_arg_name, mapping=None, stacklevel=2):
    """Decorator to deprecate a keyword argument of a function

    Parameters
    ----------
    old_arg_name : str
        Name of argument in function to deprecate
    new_arg_name : str
        Name of preferred argument in function
    mapping : dict or callable
        If mapping is present, use it to translate old arguments to
        new arguments. A callable must do its own value checking;
        values not found in a dict will be forwarded unchanged.

    Examples
    --------
    The following deprecates 'cols', using 'columns' instead

    >>> @deprecate_kwarg(old_arg_name='cols', new_arg_name='columns')
    ... def f(columns=''):
    ...     print(columns)
    ...
    >>> f(columns='should work ok')
    should work ok
    >>> f(cols='should raise warning')
    FutureWarning: cols is deprecated, use columns instead
      warnings.warn(msg, FutureWarning)
    should raise warning
    >>> f(cols='should error', columns="can\'t pass do both")
    TypeError: Can only specify 'cols' or 'columns', not both
    >>> @deprecate_kwarg('old', 'new', {'yes': True, 'no': False})
    ... def f(new=False):
    ...     print('yes!' if new else 'no!')
    ...
    >>> f(old='yes')
    FutureWarning: old='yes' is deprecated, use new=True instead
      warnings.warn(msg, FutureWarning)
    yes!

    """
    if mapping is not None and not hasattr(mapping, 'get') and \
            not callable(mapping):
        raise TypeError("mapping from old to new argument values "
                        "must be dict or callable!")

    def _deprecate_kwarg(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            old_arg_value = kwargs.pop(old_arg_name, None)
            if old_arg_value is not None:
                if mapping is not None:
                    if hasattr(mapping, 'get'):
                        new_arg_value = mapping.get(old_arg_value,
                                                    old_arg_value)
                    else:
                        new_arg_value = mapping(old_arg_value)
                    msg = "the %s=%r keyword is deprecated, " \
                          "use %s=%r instead" % \
                          (old_arg_name, old_arg_value,
                           new_arg_name, new_arg_value)
                else:
                    new_arg_value = old_arg_value
                    msg = "the '%s' keyword is deprecated, " \
                          "use '%s' instead" % (old_arg_name, new_arg_name)

                warnings.warn(msg, FutureWarning, stacklevel=stacklevel)
                if kwargs.get(new_arg_name, None) is not None:
                    msg = ("Can only specify '%s' or '%s', not both" %
                           (old_arg_name, new_arg_name))
                    raise TypeError(msg)
                else:
                    kwargs[new_arg_name] = new_arg_value
            return func(*args, **kwargs)
        return wrapper
    return _deprecate_kwarg


# Substitution and Appender are derived from matplotlib.docstring (1.1.0)
# module http://matplotlib.org/users/license.html


class Substitution(object):
    """
    A decorator to take a function's docstring and perform string
    substitution on it.

    This decorator should be robust even if func.__doc__ is None
    (for example, if -OO was passed to the interpreter)

    Usage: construct a docstring.Substitution with a sequence or
    dictionary suitable for performing substitution; then
    decorate a suitable function with the constructed object. e.g.

    sub_author_name = Substitution(author='Jason')

    @sub_author_name
    def some_function(x):
        "%(author)s wrote this function"

    # note that some_function.__doc__ is now "Jason wrote this function"

    One can also use positional arguments.

    sub_first_last_names = Substitution('Edgar Allen', 'Poe')

    @sub_first_last_names
    def some_function(x):
        "%s %s wrote the Raven"
    """

    def __init__(self, *args, **kwargs):
        if (args and kwargs):
            raise AssertionError("Only positional or keyword args are allowed")

        self.params = args or kwargs

    def __call__(self, func):
        func.__doc__ = func.__doc__ and func.__doc__ % self.params
        return func

    def update(self, *args, **kwargs):
        "Assume self.params is a dict and update it with supplied args"
        self.params.update(*args, **kwargs)

    @classmethod
    def from_params(cls, params):
        """
        In the case where the params is a mutable sequence (list or dictionary)
        and it may change before this class is called, one may explicitly use a
        reference to the params rather than using *args or **kwargs which will
        copy the values and not reference them.
        """
        result = cls()
        result.params = params
        return result


class Appender(object):
    """
    A function decorator that will append an addendum to the docstring
    of the target function.

    This decorator should be robust even if func.__doc__ is None
    (for example, if -OO was passed to the interpreter).

    Usage: construct a docstring.Appender with a string to be joined to
    the original docstring. An optional 'join' parameter may be supplied
    which will be used to join the docstring and addendum. e.g.

    add_copyright = Appender("Copyright (c) 2009", join='\n')

    @add_copyright
    def my_dog(has='fleas'):
        "This docstring will have a copyright below"
        pass
    """

    def __init__(self, addendum, join='', indents=0):
        if indents > 0:
            self.addendum = indent(addendum, indents=indents)
        else:
            self.addendum = addendum
        self.join = join

    def __call__(self, func):
        func.__doc__ = func.__doc__ if func.__doc__ else ''
        self.addendum = self.addendum if self.addendum else ''
        docitems = [func.__doc__, self.addendum]
        func.__doc__ = dedent(self.join.join(docitems))
        return func


def indent(text, indents=1):
    if not text or not isinstance(text, str):
        return ''
    jointext = ''.join(['\n'] + ['    '] * indents)
    return jointext.join(text.split('\n'))


def make_signature(func):
    """
    Returns a string repr of the arg list of a func call, with any defaults

    Examples
    --------

    >>> def f(a,b,c=2) :
    >>>     return a*b*c
    >>> print(_make_signature(f))
    a,b,c=2
    """
    spec = signature(func)
    if spec.defaults is None:
        n_wo_defaults = len(spec.args)
        defaults = ('',) * n_wo_defaults
    else:
        n_wo_defaults = len(spec.args) - len(spec.defaults)
        defaults = ('',) * n_wo_defaults + spec.defaults
    args = []
    for i, (var, default) in enumerate(zip(spec.args, defaults)):
        args.append(var if default == '' else var + '=' + repr(default))
    if spec.varargs:
        args.append('*' + spec.varargs)
    if spec.keywords:
        args.append('**' + spec.keywords)
    return args, spec.args


class docstring_wrapper(object):
    """
    decorator to wrap a function,
    provide a dynamically evaluated doc-string

    Parameters
    ----------
    func : callable
    creator : callable
        return the doc-string
    default : str, optional
        return this doc-string on error
    """
    _attrs = ['__module__', '__name__',
              '__qualname__', '__annotations__']

    def __init__(self, func, creator, default=None):
        self.func = func
        self.creator = creator
        self.default = default
        update_wrapper(
            self, func, [attr for attr in self._attrs
                         if hasattr(func, attr)])

    def __get__(self, instance, cls=None):

        # we are called with a class
        if instance is None:
            return self

        # we want to return the actual passed instance
        return types.MethodType(self, instance)

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)

    @property
    def __doc__(self):
        try:
            return self.creator()
        except Exception as exc:
            msg = self.default or str(exc)
            return msg
