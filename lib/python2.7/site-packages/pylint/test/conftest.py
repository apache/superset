# pylint: disable=redefined-outer-name
import os
import pytest

from pylint import checkers
from pylint.lint import PyLinter
# pylint: disable=no-name-in-module
from pylint.testutils import MinimalTestReporter


@pytest.fixture
def linter(checker, register, enable, disable, reporter):
    _linter = PyLinter()
    _linter.set_reporter(reporter())
    checkers.initialize(_linter)
    if register:
        register(_linter)
    if checker:
        _linter.register_checker(checker(_linter))
    if disable:
        for msg in disable:
            _linter.disable(msg)
    if enable:
        for msg in enable:
            _linter.enable(msg)
    os.environ.pop('PYLINTRC', None)
    return _linter


@pytest.fixture(scope='module')
def checker():
    return None


@pytest.fixture(scope='module')
def register():
    return None


@pytest.fixture(scope='module')
def enable():
    return None


@pytest.fixture(scope='module')
def disable():
    return None


@pytest.fixture(scope='module')
def reporter():
    return MinimalTestReporter
