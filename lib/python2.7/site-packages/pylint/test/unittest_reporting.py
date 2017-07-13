# Copyright (c) 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import warnings

import six

from pylint.lint import PyLinter
from pylint import checkers
from pylint.reporters.text import TextReporter, ParseableTextReporter
import pytest


@pytest.fixture(scope='module')
def reporter(reporter):
    return TextReporter


@pytest.fixture(scope='module')
def disable(disable):
    return ['I']


def test_template_option(linter):
    output = six.StringIO()
    linter.reporter.set_output(output)
    linter.set_option('msg-template', '{msg_id}:{line:03d}')
    linter.open()
    linter.set_current_module('0123')
    linter.add_message('C0301', line=1, args=(1, 2))
    linter.add_message('line-too-long', line=2, args=(3, 4))
    assert output.getvalue() == \
        '************* Module 0123\n' \
        'C0301:001\n' \
        'C0301:002\n'


def test_parseable_output_deprecated():
    with warnings.catch_warnings(record=True) as cm:
        warnings.simplefilter("always")
        ParseableTextReporter()

    assert len(cm) == 1
    assert isinstance(cm[0].message, DeprecationWarning)


def test_parseable_output_regression():
    output = six.StringIO()
    with warnings.catch_warnings(record=True):
        linter = PyLinter(reporter=ParseableTextReporter())

    checkers.initialize(linter)
    linter.config.persistent = 0
    linter.reporter.set_output(output)
    linter.set_option('output-format', 'parseable')
    linter.open()
    linter.set_current_module('0123')
    linter.add_message('line-too-long', line=1, args=(1, 2))
    assert output.getvalue() == \
        '************* Module 0123\n' \
        '0123:1: [C0301(line-too-long), ] ' \
        'Line too long (1/2)\n'


def test_display_results_is_renamed():
    class CustomReporter(TextReporter):
        def _display(self, layout):
            return None

    reporter = CustomReporter()
    with pytest.raises(AttributeError):
        reporter.display_results
