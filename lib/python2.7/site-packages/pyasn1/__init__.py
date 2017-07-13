import sys

# http://www.python.org/dev/peps/pep-0396/
__version__ = '0.2.3'

if sys.version_info[:2] < (2, 4):
    raise RuntimeError('PyASN1 requires Python 2.4 or later')

