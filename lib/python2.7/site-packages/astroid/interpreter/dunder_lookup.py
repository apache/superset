# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>
# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Contains logic for retrieving special methods.

This implementation does not rely on the dot attribute access
logic, found in ``.getattr()``. The difference between these two
is that the dunder methods are looked with the type slots
(you can find more about these here
http://lucumr.pocoo.org/2014/8/16/the-python-i-would-like-to-see/)
As such, the lookup for the special methods is actually simpler than
the dot attribute access.
"""
import itertools

import astroid
from astroid import exceptions


def _lookup_in_mro(node, name):
    attrs = node.locals.get(name, [])

    nodes = itertools.chain.from_iterable(
        ancestor.locals.get(name, [])
        for ancestor in node.ancestors(recurs=True)
    )
    values = list(itertools.chain(attrs, nodes))
    if not values:
        raise exceptions.AttributeInferenceError(
            attribute=name,
            target=node
        )

    return values


def lookup(node, name):
    """Lookup the given special method name in the given *node*

    If the special method was found, then a list of attributes
    will be returned. Otherwise, `astroid.AttributeInferenceError`
    is going to be raised.
    """
    if isinstance(node, (astroid.List,
                         astroid.Tuple,
                         astroid.Const,
                         astroid.Dict,
                         astroid.Set)):
        return _builtin_lookup(node, name)
    elif isinstance(node, astroid.Instance):
        return _lookup_in_mro(node, name)
    elif isinstance(node, astroid.ClassDef):
        return _class_lookup(node, name)

    raise exceptions.AttributeInferenceError(
        attribute=name,
        target=node
    )


def _class_lookup(node, name):
    metaclass = node.metaclass()
    if metaclass is None:
        raise exceptions.AttributeInferenceError(
            attribute=name,
            target=node
        )

    return _lookup_in_mro(metaclass, name)


def _builtin_lookup(node, name):
    values = node.locals.get(name, [])
    if not values:
        raise exceptions.AttributeInferenceError(
            attribute=name,
            target=node
        )

    return values
