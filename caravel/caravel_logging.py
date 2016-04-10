"""
Settings for root logger.
1) Log messages will be printed to console a
2) also to log file (rotated, with specified size).

Reference:
1) http://docs.python-guide.org/en/latest/writing/logging/
2) https://docs.python.org/2/library/logging.config.html
"""

from caravel import app
config = app.config

logging_config = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '(%(asctime)s; %(filename)s:%(lineno)d) : %(levelname)s:%(name)s: %(message)s ',
            'datefmt': "%Y-%m-%d %H:%M:%S",
        }
    },
    'handlers': {
        'console': {
            'level': config.get('LOG_LEVEL'),
            'formatter': 'standard',
            'class': 'logging.StreamHandler',
        },
        'rotate_file': {
            'level': config.get('LOG_LEVEL'),
            'formatter': 'standard',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': config.get('LOG_FILENAME'),
            'encoding': 'utf8',
            'maxBytes': 100,
            'backupCount': 1,
        }
    },
    'loggers': {
        '': {
            'handlers': ['console', 'rotate_file'],
            'level': 'DEBUG',
        },
    }
}
