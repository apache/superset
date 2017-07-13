# being a bit too dynamic
# pylint: disable=E1101
from __future__ import division

from distutils.version import LooseVersion


def _mpl_le_1_2_1():
    try:
        import matplotlib as mpl
        return (str(mpl.__version__) <= LooseVersion('1.2.1') and
                str(mpl.__version__)[0] != '0')
    except ImportError:
        return False


def _mpl_ge_1_3_1():
    try:
        import matplotlib
        # The or v[0] == '0' is because their versioneer is
        # messed up on dev
        return (matplotlib.__version__ >= LooseVersion('1.3.1') or
                matplotlib.__version__[0] == '0')
    except ImportError:
        return False


def _mpl_ge_1_4_0():
    try:
        import matplotlib
        return (matplotlib.__version__ >= LooseVersion('1.4') or
                matplotlib.__version__[0] == '0')
    except ImportError:
        return False


def _mpl_ge_1_5_0():
    try:
        import matplotlib
        return (matplotlib.__version__ >= LooseVersion('1.5') or
                matplotlib.__version__[0] == '0')
    except ImportError:
        return False


def _mpl_ge_2_0_0():
    try:
        import matplotlib
        return matplotlib.__version__ >= LooseVersion('2.0')
    except ImportError:
        return False


def _mpl_le_2_0_0():
    try:
        import matplotlib
        return matplotlib.compare_versions('2.0.0', matplotlib.__version__)
    except ImportError:
        return False


def _mpl_ge_2_0_1():
    try:
        import matplotlib
        return matplotlib.__version__ >= LooseVersion('2.0.1')
    except ImportError:
        return False
