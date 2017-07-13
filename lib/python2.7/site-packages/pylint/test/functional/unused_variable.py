# pylint: disable=missing-docstring, invalid-name

def test_regression_737():
    import xml # [unused-variable]

def test_regression_923():
    import unittest.case  # [unused-variable]
    import xml as sql # [unused-variable]

def test_unused_with_prepended_underscore():
    _foo = 42
    _ = 24
    __a = 24
    dummy = 24
    _a_ = 42 # [unused-variable]
    __a__ = 24 # [unused-variable]
    __never_used = 42

def test_local_field_prefixed_with_unused_or_ignored():
    flagged_local_field = 42 # [unused-variable]
    unused_local_field = 42
    ignored_local_field = 42
