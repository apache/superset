"""Tests for inconsistent-mro."""
# pylint: disable=missing-docstring,too-few-public-methods,no-init

class Str(str):
    pass


class Inconsistent(str, Str): # [inconsistent-mro]
    pass
