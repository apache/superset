# pylint: disable=missing-docstring

# pylint: disable=unused-import, undefined-variable; false positives :-(

import functools


@functools.lru_cache()
def func():
    pass


func.cache_clear()
