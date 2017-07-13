# Copyright (c) 2006-2010, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014 Michal Nowikowski <godfryd@gmail.com>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""functional/non regression tests for pylint"""

import sys
import re

import pytest
from os.path import abspath, dirname, join

from pylint.testutils import get_tests_info, LintTestUsingModule, LintTestUpdate

PY3K = sys.version_info >= (3, 0)
SYS_VERS_STR = '%d%d%d' % sys.version_info[:3]

# Configure paths
INPUT_DIR = join(dirname(abspath(__file__)), 'input')
MSG_DIR = join(dirname(abspath(__file__)), 'messages')

FILTER_RGX = None
UPDATE = False

# Classes

quote = "'" if sys.version_info >= (3, 3) else ''


def gen_tests(filter_rgx):
    if filter_rgx:
        is_to_run = re.compile(filter_rgx).search
    else:
        is_to_run = lambda x: 1
    tests = []
    for module_file, messages_file in (
            get_tests_info(INPUT_DIR, MSG_DIR, 'func_', '')
    ):
        if not is_to_run(module_file) or module_file.endswith(('.pyc', "$py.class")):
            continue
        base = module_file.replace('func_', '').replace('.py', '')
        dependencies = get_tests_info(INPUT_DIR, MSG_DIR, base, '.py')
        tests.append((module_file, messages_file, dependencies))

    if UPDATE:
        return tests

    assert len(tests) < 196, "Please do not add new test cases here."
    return tests


@pytest.mark.parametrize("module_file,messages_file,dependencies", gen_tests(FILTER_RGX))
def test_functionality(module_file, messages_file, dependencies):

    LT = LintTestUpdate() if UPDATE else LintTestUsingModule()

    LT.module = module_file.replace('.py', '')
    LT.output = messages_file
    LT.depends = dependencies or None
    LT.INPUT_DIR = INPUT_DIR
    LT._test_functionality()

if __name__ == '__main__':
    if '-u' in sys.argv:
        UPDATE = True
        sys.argv.remove('-u')

    if len(sys.argv) > 1:
        FILTER_RGX = sys.argv[1]
        del sys.argv[1]
    pytest.main(sys.argv)
