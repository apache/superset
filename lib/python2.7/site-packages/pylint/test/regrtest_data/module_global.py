# pylint: disable=W0603,W0601,W0604,E0602,W0104
"""was causing infinite recursion
"""
__revision__ = 1

global GLOBAL_VAR
GLOBAL_VAR.foo
