# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.bad_builtin
"""

import os.path as osp

import pytest

from pylint.extensions.bad_builtin import BadBuiltinChecker
from pylint.lint import fix_import_path


EXPECTED = [
    "Used builtin function 'map'. Using a list comprehension can be clearer.",
    "Used builtin function 'filter'. Using a list comprehension can be clearer.",
]


@pytest.fixture(scope='module')
def checker(checker):
    return BadBuiltinChecker


@pytest.fixture(scope='module')
def disable(disable):
    return ['I']


def test_types_redefined(linter):
    elif_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                         'bad_builtin.py')
    with fix_import_path([elif_test]):
        linter.check([elif_test])
    msgs = sorted(linter.reporter.messages, key=lambda item: item.line)
    assert len(msgs) == 2
    for msg, expected in zip(msgs, EXPECTED):
        assert msg.symbol == 'bad-builtin'
        assert msg.msg == expected
