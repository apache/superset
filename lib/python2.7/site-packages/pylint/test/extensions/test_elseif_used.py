# Copyright (c) 2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.check_elif
"""

import os.path as osp

import pytest

from pylint.extensions.check_elif import ElseifUsedChecker


@pytest.fixture(scope="module")
def checker(checker):
    return ElseifUsedChecker


def test_elseif_message(linter):
    elif_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                         'elif.py')
    linter.check([elif_test])
    msgs = linter.reporter.messages
    assert len(msgs) == 2
    for msg in msgs:
        assert msg.symbol == 'else-if-used'
        assert msg.msg == 'Consider using "elif" instead of "else if"'
    assert msgs[0].line == 9
    assert msgs[1].line == 21
