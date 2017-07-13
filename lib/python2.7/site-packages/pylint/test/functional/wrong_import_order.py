"""Checks import order rule"""
# pylint: disable=unused-import,relative-import,ungrouped-imports,import-error,no-name-in-module,relative-beyond-top-level
try:
    from six.moves import configparser
except ImportError:
    import configparser

import logging

import six
import os.path  # [wrong-import-order]
from astroid import are_exclusive
import sys  # [wrong-import-order]
import datetime  # [wrong-import-order]
import unused_import
from .package import Class
import totally_missing  # [wrong-import-order]
from . import package
import astroid  # [wrong-import-order]
from . import package2
from .package2 import Class2
from ..package3 import Class3


LOGGER = logging.getLogger(__name__)


if LOGGER:
    # imports nested skipped
    from . import package4
    import pprint
    from pprint import PrettyPrinter


try:
    # imports nested skipped
    from . import package4
    import random
    from random import division
except ImportError:
    LOGGER.info('A useful message here')
