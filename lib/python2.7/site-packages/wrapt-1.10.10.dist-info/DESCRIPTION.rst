wrapt
=====

|Travis| |Coveralls| |PyPI|

The aim of the **wrapt** module is to provide a transparent object proxy
for Python, which can be used as the basis for the construction of function
wrappers and decorator functions.

The **wrapt** module focuses very much on correctness. It therefore goes
way beyond existing mechanisms such as ``functools.wraps()`` to ensure that
decorators preserve introspectability, signatures, type checking abilities
etc. The decorators that can be constructed using this module will work in
far more scenarios than typical decorators and provide more predictable and
consistent behaviour.

To ensure that the overhead is as minimal as possible, a C extension module
is used for performance critical components. An automatic fallback to a
pure Python implementation is also provided where a target system does not
have a compiler to allow the C extension to be compiled.

Documentation
-------------

For further information on the **wrapt** module see:

* http://wrapt.readthedocs.org/

Quick Start
-----------

To implement your decorator you need to first define a wrapper function.
This will be called each time a decorated function is called. The wrapper
function needs to take four positional arguments:

* ``wrapped`` - The wrapped function which in turns needs to be called by your wrapper function.
* ``instance`` - The object to which the wrapped function was bound when it was called.
* ``args`` - The list of positional arguments supplied when the decorated function was called.
* ``kwargs`` - The dictionary of keyword arguments supplied when the decorated function was called.

The wrapper function would do whatever it needs to, but would usually in
turn call the wrapped function that is passed in via the ``wrapped``
argument.

The decorator ``@wrapt.decorator`` then needs to be applied to the wrapper
function to convert it into a decorator which can in turn be applied to
other functions.

::

    import wrapt

    @wrapt.decorator
    def pass_through(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)

    @pass_through
    def function():
        pass

If you wish to implement a decorator which accepts arguments, then wrap the
definition of the decorator in a function closure. Any arguments supplied
to the outer function when the decorator is applied, will be available to
the inner wrapper when the wrapped function is called.

::

    import wrapt

    def with_arguments(myarg1, myarg2):
        @wrapt.decorator
        def wrapper(wrapped, instance, args, kwargs):
            return wrapped(*args, **kwargs)
        return wrapper

    @with_arguments(1, 2)
    def function():
        pass

When applied to a normal function or static method, the wrapper function
when called will be passed ``None`` as the ``instance`` argument.

When applied to an instance method, the wrapper function when called will
be passed the instance of the class the method is being called on as the
``instance`` argument. This will be the case even when the instance method
was called explicitly via the class and the instance passed as the first
argument. That is, the instance will never be passed as part of ``args``.

When applied to a class method, the wrapper function when called will be
passed the class type as the ``instance`` argument.

When applied to a class, the wrapper function when called will be passed
``None`` as the ``instance`` argument. The ``wrapped`` argument in this
case will be the class.

The above rules can be summarised with the following example.

::

    import inspect

    @wrapt.decorator
    def universal(wrapped, instance, args, kwargs):
        if instance is None:
            if inspect.isclass(wrapped):
                # Decorator was applied to a class.
                return wrapped(*args, **kwargs)
            else:
                # Decorator was applied to a function or staticmethod.
                return wrapped(*args, **kwargs)
        else:
            if inspect.isclass(instance):
                # Decorator was applied to a classmethod.
                return wrapped(*args, **kwargs)
            else:
                # Decorator was applied to an instancemethod.
                return wrapped(*args, **kwargs)

Using these checks it is therefore possible to create a universal decorator
that can be applied in all situations. It is no longer necessary to create
different variants of decorators for normal functions and instance methods,
or use additional wrappers to convert a function decorator into one that
will work for instance methods.

In all cases, the wrapped function passed to the wrapper function is called
in the same way, with ``args`` and ``kwargs`` being passed. The
``instance`` argument doesn't need to be used in calling the wrapped
function.

Repository
----------

Full source code for the **wrapt** module, including documentation files
and unit tests, can be obtained from github.

* https://github.com/GrahamDumpleton/wrapt

.. |Travis| image:: https://img.shields.io/travis/GrahamDumpleton/wrapt/develop.svg?style=plastic
   :target: https://travis-ci.org/GrahamDumpleton/wrapt?branch=develop
.. |Coveralls| image:: https://img.shields.io/coveralls/GrahamDumpleton/wrapt/develop.svg?style=plastic
   :target: https://coveralls.io/github/GrahamDumpleton/wrapt?branch=develop
.. |PyPI| image:: https://img.shields.io/pypi/v/wrapt.svg?style=plastic
   :target: https://pypi.python.org/pypi/wrapt


