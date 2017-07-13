# pylint: disable=E1101, no-absolute-import, import-error,line-too-long, missing-docstring,wrong-import-order,wrong-import-position

try:
    import __builtin__ as builtins
except ImportError:
    import builtins

# Muck up the names in an effort to confuse...
import logging as renamed_logging
import os as logging
from uninferable import UNINFERABLE

FORMAT_STR = '{0}, {1}'

# Statements that should be flagged:
renamed_logging.debug('{0}, {1}'.format(4, 5)) # [logging-format-interpolation]
renamed_logging.log(renamed_logging.DEBUG, 'msg: {}'.format('Run!')) # [logging-format-interpolation]
renamed_logging.debug(FORMAT_STR.format(4, 5)) # [logging-format-interpolation]
renamed_logging.log(renamed_logging.DEBUG, FORMAT_STR.format(4, 5)) # [logging-format-interpolation]
renamed_logging.info("Read {l} rows".format(l=123456789)) # [logging-format-interpolation]

# Statements that should not be flagged:
renamed_logging.debug(format(66, 'x'))
renamed_logging.debug(builtins.format(66, 'x'))
renamed_logging.log(renamed_logging.DEBUG, 'msg: Run!'.upper())
logging.debug('{0}, {1}'.format(4, 5))
logging.log(logging.DEBUG, 'msg: {}'.format('Run!'))
renamed_logging.info("Read {l:,d} rows".format(l=123456789))
renamed_logging.info(UNINFERABLE.format(l=123456789))
