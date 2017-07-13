import pytest
from distutils.version import LooseVersion

import pandas as pd

from pandas.core.computation.engines import _engines
import pandas.core.computation.expr as expr
from pandas.core.computation import _MIN_NUMEXPR_VERSION


def test_compat():
    # test we have compat with our version of nu

    from pandas.core.computation import _NUMEXPR_INSTALLED
    try:
        import numexpr as ne
        ver = ne.__version__
        if ver < LooseVersion(_MIN_NUMEXPR_VERSION):
            assert not _NUMEXPR_INSTALLED
        else:
            assert _NUMEXPR_INSTALLED
    except ImportError:
        pytest.skip("not testing numexpr version compat")


@pytest.mark.parametrize('engine', _engines)
@pytest.mark.parametrize('parser', expr._parsers)
def test_invalid_numexpr_version(engine, parser):
    def testit():
        a, b = 1, 2  # noqa
        res = pd.eval('a + b', engine=engine, parser=parser)
        assert res == 3

    if engine == 'numexpr':
        try:
            import numexpr as ne
        except ImportError:
            pytest.skip("no numexpr")
        else:
            if ne.__version__ < LooseVersion(_MIN_NUMEXPR_VERSION):
                with pytest.raises(ImportError):
                    testit()
            else:
                testit()
    else:
        testit()
