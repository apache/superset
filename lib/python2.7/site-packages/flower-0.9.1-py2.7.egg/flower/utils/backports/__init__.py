import logging


class NullHandler(logging.Handler):
    """logging.NullHandler backport for python 2.6"""

    def emit(self, record):
        pass
