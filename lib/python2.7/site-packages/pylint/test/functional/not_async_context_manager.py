"""Test that an async context manager receives a proper object."""
# pylint: disable=missing-docstring, import-error, too-few-public-methods
import contextlib

from ala import Portocala


@contextlib.contextmanager
def ctx_manager():
    yield


class ContextManager(object):
    def __enter__(self):
        pass
    def __exit__(self, *args):
        pass

class PartialAsyncContextManager(object):
    def __aenter__(self):
        pass

class SecondPartialAsyncContextManager(object):
    def __aexit__(self, *args):
        pass

class UnknownBases(Portocala):
    def __aenter__(self):
        pass


class AsyncManagerMixin(object):
    pass

class GoodAsyncManager(object):
    def __aenter__(self):
        pass
    def __aexit__(self, *args):
        pass

class InheritExit(object):
    def __aexit__(self, *args):
        pass

class SecondGoodAsyncManager(InheritExit):
    def __aenter__(self):
        pass


async def bad_coro():
    async with 42: # [not-async-context-manager]
        pass
    async with ctx_manager(): # [not-async-context-manager]
        pass
    async with ContextManager(): # [not-async-context-manager]
        pass
    async with PartialAsyncContextManager(): # [not-async-context-manager]
        pass
    async with SecondPartialAsyncContextManager(): # [not-async-context-manager]
        pass


async def good_coro():
    async with UnknownBases():
        pass
    async with AsyncManagerMixin():
        pass
    async with GoodAsyncManager():
        pass
    async with SecondGoodAsyncManager():
        pass
