"""Tests for redefining builtins."""
from __future__ import print_function

def function():
    """Redefined local."""
    type = 1  # [redefined-builtin]
    print(type)

# pylint:disable=invalid-name
map = {}  # [redefined-builtin]
