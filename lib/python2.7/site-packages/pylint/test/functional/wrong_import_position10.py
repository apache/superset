"""Checks import position rule"""
# pylint: disable=unused-import
import os

try:
    import ast
except ImportError:
    def method(items):
        """docstring"""
        value = 0
        for item in items:
            value += item
        return value

import sys
