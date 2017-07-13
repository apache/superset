# Copyright (c) 2016 Luis Escobar <lescobar@vauxoo.com>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.check_docstring
"""

import os.path as osp

import pytest

from pylint.extensions.docstyle import DocStringStyleChecker


EXPECTED_MSGS = [
    'First line empty in function docstring',
    'First line empty in class docstring',
    'First line empty in method docstring',
    'Bad docstring quotes in method, expected """, given \'\'\'',
    'Bad docstring quotes in method, expected """, given "',
    'Bad docstring quotes in method, expected """, given \'',
    'Bad docstring quotes in method, expected """, given \'',
]

EXPECTED_SYMBOLS = [
    'docstring-first-line-empty',
    'docstring-first-line-empty',
    'docstring-first-line-empty',
    'bad-docstring-quotes',
    'bad-docstring-quotes',
    'bad-docstring-quotes',
    'bad-docstring-quotes',
]


@pytest.fixture(scope="module")
def checker(checker):
    return DocStringStyleChecker


def test_docstring_message(linter):
    docstring_test = osp.join(osp.dirname(osp.abspath(__file__)), 'data',
                              'docstring.py')
    linter.check([docstring_test])
    msgs = linter.reporter.messages
    assert len(msgs) == 7
    for msg, expected_symbol, expected_msg in zip(msgs,
                                                  EXPECTED_SYMBOLS,
                                                  EXPECTED_MSGS):
        assert msg.symbol == expected_symbol
        assert msg.msg == expected_msg
