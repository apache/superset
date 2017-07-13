"""Test that non-inferable __all__ variables do not make Pylint crash."""

__all__ = sorted([
    'Dummy',
    'NonExistant',
    'path',
    'func',
    'inner',
    'InnerKlass'])
