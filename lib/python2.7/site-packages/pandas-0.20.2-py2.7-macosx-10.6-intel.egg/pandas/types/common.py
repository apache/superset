import warnings

warnings.warn("pandas.types.common is deprecated and will be "
              "removed in a future version, import "
              "from pandas.api.types",
              DeprecationWarning, stacklevel=3)

from pandas.core.dtypes.common import *  # noqa
