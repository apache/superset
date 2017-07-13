# coding: utf-8
# flake8: noqa
import warnings
from flask_wtf._compat import FlaskWTFDeprecationWarning

warnings.warn(FlaskWTFDeprecationWarning(
    '"flask_wtf.html5" will be removed in 1.0.  '
    'Import directly from "wtforms.fields.html5" '
    'and "wtforms.widgets.html5".'
), stacklevel=2)

from wtforms.widgets.html5 import *
from wtforms.fields.html5 import *
