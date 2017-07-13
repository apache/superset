# Copyright (c) 2016 David Euresti <david@dropbox.com>

"""Astroid hooks for typing.py support."""
import textwrap

from astroid import (
    MANAGER, UseInferenceDefault, extract_node, inference_tip,
    nodes, InferenceError)
from astroid.nodes import List, Tuple


TYPING_NAMEDTUPLE_BASENAMES = {
    'NamedTuple',
    'typing.NamedTuple'
}


def infer_typing_namedtuple(node, context=None):
    """Infer a typing.NamedTuple(...) call."""
    # This is essentially a namedtuple with different arguments
    # so we extract the args and infer a named tuple.
    try:
        func = next(node.func.infer())
    except InferenceError:
        raise UseInferenceDefault

    if func.qname() != 'typing.NamedTuple':
        raise UseInferenceDefault

    if len(node.args) != 2:
        raise UseInferenceDefault

    if not isinstance(node.args[1], (List, Tuple)):
        raise UseInferenceDefault

    names = []
    for elt in node.args[1].elts:
        if not isinstance(elt, (List, Tuple)):
            raise UseInferenceDefault
        if len(elt.elts) != 2:
            raise UseInferenceDefault
        names.append(elt.elts[0].as_string())

    typename = node.args[0].as_string()
    node = extract_node('namedtuple(%(typename)s, (%(fields)s,)) ' %
        {'typename': typename, 'fields': ",".join(names)})
    return node.infer(context=context)


def infer_typing_namedtuple_class(node, context=None):
    """Infer a subclass of typing.NamedTuple"""

    # Check if it has the corresponding bases
    if not set(node.basenames) & TYPING_NAMEDTUPLE_BASENAMES:
        raise UseInferenceDefault

    annassigns_fields = [
        annassign.target.name for annassign in node.body
        if isinstance(annassign, nodes.AnnAssign)
    ]
    code = textwrap.dedent('''
    from collections import namedtuple
    namedtuple({typename!r}, {fields!r})
    ''').format(
        typename=node.name,
        fields=",".join(annassigns_fields)
    )
    node = extract_node(code)
    return node.infer(context=context)


def looks_like_typing_namedtuple(node):
    func = node.func
    if isinstance(func, nodes.Attribute):
        return func.attrname == 'NamedTuple'
    if isinstance(func, nodes.Name):
        return func.name == 'NamedTuple'
    return False


MANAGER.register_transform(
    nodes.Call,
    inference_tip(infer_typing_namedtuple),
    looks_like_typing_namedtuple
)
MANAGER.register_transform(
    nodes.ClassDef,
    inference_tip(infer_typing_namedtuple_class)
)
