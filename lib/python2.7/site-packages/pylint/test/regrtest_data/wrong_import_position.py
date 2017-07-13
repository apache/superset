"""Test that wrong-import-position is properly reset when
other errors are disabled.
"""
# pylint: disable=unused-import, too-few-public-methods


class Something(object):
    """A class before an import."""


import os
