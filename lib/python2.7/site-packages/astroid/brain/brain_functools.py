# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

"""Astroid hooks for understanding functools library module."""

import astroid
from astroid import BoundMethod
from astroid import extract_node
from astroid import helpers
from astroid.interpreter import objectmodel
from astroid import MANAGER


LRU_CACHE = 'functools.lru_cache'


class LruWrappedModel(objectmodel.FunctionModel):
    """Special attribute model for functions decorated with functools.lru_cache.

    The said decorators patches at decoration time some functions onto
    the decorated function.
    """

    @property
    def py__wrapped__(self):
        return self._instance

    @property
    def pycache_info(self):
        cache_info = extract_node('''
        from functools import _CacheInfo
        _CacheInfo(0, 0, 0, 0)
        ''')
        class CacheInfoBoundMethod(BoundMethod):
            def infer_call_result(self, caller, context=None):
                yield helpers.safe_infer(cache_info)

        return CacheInfoBoundMethod(proxy=self._instance, bound=self._instance)

    @property
    def pycache_clear(self):
        node = extract_node('''def cache_clear(self): pass''')
        return BoundMethod(proxy=node, bound=self._instance.parent.scope())


def _transform_lru_cache(node, context=None):
    # TODO: this is not ideal, since the node should be immutable,
    # but due to https://github.com/PyCQA/astroid/issues/354,
    # there's not much we can do now.
    # Replacing the node would work partially, because,
    # in pylint, the old node would still be available, leading
    # to spurious false positives.
    node.special_attributes = LruWrappedModel()(node)
    return


def _looks_like_lru_cache(node):
    """Check if the given function node is decorated with lru_cache."""
    if not node.decorators:
        return False

    for decorator in node.decorators.nodes:
        if not isinstance(decorator, astroid.Call):
            continue

        func = helpers.safe_infer(decorator.func)
        if func in (None, astroid.Uninferable):
            continue

        if isinstance(func, astroid.FunctionDef) and func.qname() == LRU_CACHE:
            return True
    return False


MANAGER.register_transform(astroid.FunctionDef, _transform_lru_cache,
                           _looks_like_lru_cache)
