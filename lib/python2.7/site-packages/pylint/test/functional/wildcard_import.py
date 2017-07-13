# pylint: disable=no-absolute-import,missing-docstring,import-error,unused-wildcard-import
from indirect1 import * # [wildcard-import]
# This is an unresolved import which still generates the wildcard-import
# warning.
from unknown.package import * # [wildcard-import]
