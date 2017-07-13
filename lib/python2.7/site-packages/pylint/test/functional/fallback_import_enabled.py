# pylint: disable=missing-docstring,unused-import
try:
    import collections.missing # [no-name-in-module]
except ImportError:
    from collections import missing # [no-name-in-module]
