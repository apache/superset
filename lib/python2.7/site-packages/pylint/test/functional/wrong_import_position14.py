"""Checks import position rule"""
# pylint: disable=unused-import,undefined-variable,import-error
if x:
    import os
import y  # [wrong-import-position]
