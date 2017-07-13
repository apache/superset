# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.check_elif
"""

import os.path as osp

import pytest

from pylint.extensions.redefined_variable_type import MultipleTypesChecker
from pylint.lint import fix_import_path


EXPECTED = [
    'Redefinition of self.var1 type from int to float',
    'Redefinition of var type from int to str',
    'Redefinition of myint type from int to bool',
    'Redefinition of _OK type from bool to str',
    'Redefinition of instance type from redefined.MyClass to bool',
    'Redefinition of SOME_FLOAT type from float to int',
    'Redefinition of var3 type from str to int',
    'Redefinition of var type from bool to int',
    'Redefinition of var4 type from float to str',
]


@pytest.fixture(scope="module")
def checker(checker):
    return MultipleTypesChecker


@pytest.fixture(scope="module")
def disable(disable):
    return ['I']


def test_types_redefined(linter):
    elif_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                         'redefined.py')
    with fix_import_path([elif_test]):
        linter.check([elif_test])
    msgs = sorted(linter.reporter.messages, key=lambda item: item.line)
    assert len(msgs) == 9
    for msg, expected in zip(msgs, EXPECTED):
        assert msg.symbol == 'redefined-variable-type'
        assert msg.msg == expected
