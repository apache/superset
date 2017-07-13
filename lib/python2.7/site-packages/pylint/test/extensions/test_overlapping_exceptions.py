# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.overlapping_exceptions
"""

from sys import version_info
from os.path import join, dirname

from pylint.extensions.overlapping_exceptions import OverlappingExceptionsChecker

import pytest


@pytest.fixture(scope='module')
def checker(checker):
    return OverlappingExceptionsChecker


@pytest.fixture(scope='module')
def disable(disable):
    return ['I']


def test_overlapping_exceptions(linter):
    test = join(dirname(__file__), 'data', 'overlapping_exceptions.py')
    linter.check([test])
    msgs = linter.reporter.messages

    expected = [
        (13, 'Overlapping exceptions (SomeException and SomeException are the same)'),
        (18, 'Overlapping exceptions (SomeException is an ancestor class of SubclassException)'),
        (23, 'Overlapping exceptions (SomeException and AliasException are the same)'),
        (28, 'Overlapping exceptions (AliasException is an ancestor class of SubclassException)'),
        (34, 'Overlapping exceptions (SomeException and AliasException are the same)'),
        (34, 'Overlapping exceptions (SomeException is an ancestor class of SubclassException)'),
        (34, 'Overlapping exceptions (AliasException is an ancestor class of SubclassException)'),
        (39, 'Overlapping exceptions (ArithmeticError is an ancestor class of FloatingPointError)'),
        (44, 'Overlapping exceptions (ValueError is an ancestor class of UnicodeDecodeError)')
    ]

    assert len(msgs) == len(expected)
    for msg, exp in zip(msgs, expected):
        assert msg.msg_id == 'W0714'
        assert msg.symbol == 'overlapping-except'
        assert msg.category == 'warning'
        assert (msg.line, msg.msg) == exp


@pytest.mark.skipif(version_info < (3, 3),
                    reason="not relevant to Python version")
def test_overlapping_exceptions_py33(linter):
    """From Python 3.3 both IOError and socket.error are aliases for OSError."""
    test = join(dirname(__file__), 'data', 'overlapping_exceptions_py33.py')
    linter.check([test])
    msgs = linter.reporter.messages

    expected = [
        (7,  'Overlapping exceptions (IOError and OSError are the same)'),
        (12, 'Overlapping exceptions (socket.error and OSError are the same)'),
        (17, 'Overlapping exceptions (socket.error is an ancestor class of ConnectionError)'),
    ]

    assert len(msgs) == len(expected)
    for msg, exp in zip(msgs, expected):
        assert msg.msg_id == 'W0714'
        assert msg.symbol == 'overlapping-except'
        assert msg.category == 'warning'
        assert (msg.line, msg.msg) == exp
