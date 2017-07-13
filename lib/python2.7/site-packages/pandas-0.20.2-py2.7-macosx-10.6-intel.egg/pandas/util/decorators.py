import warnings

warnings.warn("pandas.util.decorators is deprecated and will be "
              "removed in a future version, import "
              "from pandas.util",
              DeprecationWarning, stacklevel=3)

from pandas.util._decorators import *  # noqa
