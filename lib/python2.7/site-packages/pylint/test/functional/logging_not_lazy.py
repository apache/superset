# pylint: disable=missing-docstring,no-member,deprecated-method

# Muck up the names in an effort to confuse...
import logging as renamed_logging
import os as logging

# Statements that should be flagged:
renamed_logging.warn('%s, %s' % (4, 5))             # [logging-not-lazy]
renamed_logging.exception('%s' % 'Exceptional!')    # [logging-not-lazy]
renamed_logging.log(renamed_logging.INFO, 'msg: %s' % 'Run!')  # [logging-not-lazy]

# Statements that should not be flagged:
renamed_logging.warn('%s, %s', 4, 5)
renamed_logging.log(renamed_logging.INFO, 'msg: %s', 'Run!')
renamed_logging.warn('%s' + ' the rest of a single string')
logging.warn('%s, %s' % (4, 5))
logging.log(logging.INFO, 'msg: %s' % 'Run!')
