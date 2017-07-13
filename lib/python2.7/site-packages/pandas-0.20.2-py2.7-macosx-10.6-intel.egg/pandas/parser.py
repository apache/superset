# flake8: noqa

import warnings
warnings.warn("The pandas.parser module is deprecated and will be "
              "removed in a future version. Please import from "
              "the pandas.io.parser instead", FutureWarning, stacklevel=2)
from pandas._libs.parsers import na_values
from pandas.io.common import CParserError
