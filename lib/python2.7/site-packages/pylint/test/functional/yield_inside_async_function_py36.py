"""Test that `yield` or `yield from` can't be used inside an async function."""
# pylint: disable=missing-docstring, unused-variable

async def good_coro():
    def _inner():
        yield 42
        yield from [1, 2, 3]


async def bad_coro():
    yield 42
    yield from [1, 2, 3] # [yield-inside-async-function]
