# Copyright (c) 2016 Moises Lopez - https://www.vauxoo.com/ <moylop260@vauxoo.com>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint checker in :mod:`pylint.extensions.check_mccabe
"""

import os.path as osp

import pytest

from pylint.extensions import mccabe

EXPECTED_MSGS = [
    "'f1' is too complex. The McCabe rating is 1",
    "'f2' is too complex. The McCabe rating is 1",
    "'f3' is too complex. The McCabe rating is 3",
    "'f4' is too complex. The McCabe rating is 2",
    "'f5' is too complex. The McCabe rating is 2",
    "'f6' is too complex. The McCabe rating is 2",
    "'f7' is too complex. The McCabe rating is 3",
    "'f8' is too complex. The McCabe rating is 4",
    "'f9' is too complex. The McCabe rating is 9",
    "'method1' is too complex. The McCabe rating is 1",
    "This 'for' is too complex. The McCabe rating is 4",
    "'method3' is too complex. The McCabe rating is 2",
    "'f10' is too complex. The McCabe rating is 11",
    "'method2' is too complex. The McCabe rating is 18",
]


@pytest.fixture(scope="module")
def enable(enable):
    return ['too-complex']


@pytest.fixture(scope="module")
def disable(disable):
    return ['all']


@pytest.fixture(scope="module")
def register(register):
    return mccabe.register


@pytest.fixture
def fname_mccabe_example():
    return osp.join(osp.dirname(osp.abspath(__file__)), 'data', 'mccabe.py')


@pytest.mark.parametrize("complexity, expected", [
    (0, EXPECTED_MSGS),
    (9, EXPECTED_MSGS[-2:]),
])
def test_max_mccabe_rate(linter, fname_mccabe_example, complexity, expected):
    linter.global_set_option('max-complexity', complexity)
    linter.check([fname_mccabe_example])
    real_msgs = [message.msg for message in linter.reporter.messages]
    assert sorted(expected) == sorted(real_msgs)
