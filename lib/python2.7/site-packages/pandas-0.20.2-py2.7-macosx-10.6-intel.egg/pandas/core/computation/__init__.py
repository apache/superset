
import warnings
from distutils.version import LooseVersion

_NUMEXPR_INSTALLED = False
_MIN_NUMEXPR_VERSION = "2.4.6"

try:
    import numexpr as ne
    ver = ne.__version__
    _NUMEXPR_INSTALLED = ver >= LooseVersion(_MIN_NUMEXPR_VERSION)

    if not _NUMEXPR_INSTALLED:
        warnings.warn(
            "The installed version of numexpr {ver} is not supported "
            "in pandas and will be not be used\nThe minimum supported "
            "version is {min_ver}\n".format(
                ver=ver, min_ver=_MIN_NUMEXPR_VERSION), UserWarning)

except ImportError:  # pragma: no cover
    pass

__all__ = ['_NUMEXPR_INSTALLED']
