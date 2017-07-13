"""Checks import order rule"""
# pylint: disable=unused-import,relative-import,wrong-import-position,wrong-import-order,using-constant-test
# pylint: disable=import-error
import six
import logging.config
import os.path
from astroid import are_exclusive
import logging  # [ungrouped-imports]
import unused_import
try:
    import os  # [ungrouped-imports]
except ImportError:
    pass
from os import pardir
import scipy
from os import sep
import astroid  # [ungrouped-imports]
if True:
    import logging.handlers  # [ungrouped-imports]
from os.path import join  # [ungrouped-imports]
