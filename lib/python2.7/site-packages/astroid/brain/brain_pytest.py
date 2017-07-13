# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Cara Vinson <ceridwenv@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for pytest."""
from __future__ import absolute_import
from astroid import MANAGER, register_module_extender
from astroid.builder import AstroidBuilder


def pytest_transform():
    return AstroidBuilder(MANAGER).string_build('''

try:
    import _pytest.mark
    import _pytest.recwarn
    import _pytest.runner
    import _pytest.python
    import _pytest.skipping
    import _pytest.assertion
except ImportError:
    pass
else:
    deprecated_call = _pytest.recwarn.deprecated_call
    warns = _pytest.recwarn.warns

    exit = _pytest.runner.exit
    fail = _pytest.runner.fail
    skip = _pytest.runner.skip
    importorskip = _pytest.runner.importorskip

    xfail = _pytest.skipping.xfail
    mark = _pytest.mark.MarkGenerator()
    raises = _pytest.python.raises

    # New in pytest 3.0
    try:
        approx = _pytest.python.approx
        register_assert_rewrite = _pytest.assertion.register_assert_rewrite
    except AttributeError:
        pass


# Moved in pytest 3.0

try:
    import _pytest.freeze_support
    freeze_includes = _pytest.freeze_support.freeze_includes
except ImportError:
    try:
        import _pytest.genscript
        freeze_includes = _pytest.genscript.freeze_includes
    except ImportError:
        pass

try:
    import _pytest.debugging
    set_trace = _pytest.debugging.pytestPDB().set_trace
except ImportError:
    try:
        import _pytest.pdb
        set_trace = _pytest.pdb.pytestPDB().set_trace
    except ImportError:
        pass

try:
    import _pytest.fixtures
    fixture = _pytest.fixtures.fixture
    yield_fixture = _pytest.fixtures.yield_fixture
except ImportError:
    try:
        import _pytest.python
        fixture = _pytest.python.fixture
        yield_fixture = _pytest.python.yield_fixture
    except ImportError:
        pass
''')

register_module_extender(MANAGER, 'pytest', pytest_transform)
register_module_extender(MANAGER, 'py.test', pytest_transform)
