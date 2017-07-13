"""
Global SQLAlchemy-Utils exception classes.
"""


class ImproperlyConfigured(Exception):
    """
    SQLAlchemy-Utils is improperly configured; normally due to usage of
    a utility that depends on a missing library.
    """
