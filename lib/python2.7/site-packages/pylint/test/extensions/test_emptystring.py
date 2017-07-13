# Copyright (c) 2016 Alexander Todorov <atodorov@MrSenko.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.emptystring
"""

import os.path as osp
import pytest

from pylint.extensions.emptystring import CompareToEmptyStringChecker


@pytest.fixture(scope='module')
def checker(checker):
    return CompareToEmptyStringChecker


@pytest.fixture(scope='module')
def disable(disable):
    return ['I']


def test_emptystring_message(linter):
    elif_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                         'empty_string_comparison.py')
    linter.check([elif_test])
    msgs = linter.reporter.messages
    expected_lineno = [6, 9, 12, 15]
    assert len(msgs) == len(expected_lineno)
    for msg, lineno in zip(msgs, expected_lineno):
        assert msg.symbol == 'compare-to-empty-string'
        assert msg.msg == 'Avoid comparisons to empty string'
        assert msg.line == lineno
