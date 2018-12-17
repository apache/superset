# pylint: disable=C,R,W

"""Utility functions used across Superset"""

# Superset framework imports
from superset import app
from superset.utils.core import get_celery_app

# Globals
config = app.config
app = get_celery_app(config)
