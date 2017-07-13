import warnings

warnings.warn("Styler has been moved from pandas.formats.style.Styler"
              " to pandas.io.formats.style.Styler. This shim will be"
              " removed in pandas 0.21",
              FutureWarning)
from pandas.io.formats.style import Styler  # noqa
