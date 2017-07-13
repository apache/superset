# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import sys

import pytest

import astroid

from pylint.checkers import strings
from pylint.testutils import CheckerTestCase


class TestStringChecker(CheckerTestCase):
    CHECKER_CLASS = strings.StringFormatChecker

    @pytest.mark.skipif(sys.version_info <= (3, 0), reason=""
                        "Tests that the string formatting checker "
                        "doesn't fail when encountering a bytes "
                        "string with a .format call")
    def test_format_bytes(self):
        code = "b'test'.format(1, 2)"
        node = astroid.extract_node(code)
        with self.assertNoMessages():
            self.checker.visit_call(node)
