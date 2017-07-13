# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Unit tests for the pylint checkers in :mod:`pylint.extensions.check_docs`,
in particular the parameter documentation checker `DocstringChecker`
"""
from __future__ import division, print_function, absolute_import

import pytest

import astroid

import pylint.extensions._check_docs_utils as utils


@pytest.mark.parametrize("string,count", [
    ('abc',        0),
    ('',           0),
    ('  abc',      2),
    ('\n  abc',    0),
    ('   \n  abc', 3),
])
def test_space_indentation(string, count):
    """Test for pylint_plugin.ParamDocChecker"""
    assert utils.space_indentation(string) == count


@pytest.mark.parametrize("raise_node,expected", [
    (astroid.extract_node('''
    def my_func():
        raise NotImplementedError #@
    '''), set(["NotImplementedError"])),

    (astroid.extract_node('''
    def my_func():
        raise NotImplementedError("Not implemented!") #@
    '''), set(["NotImplementedError"])),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except RuntimeError:
            raise #@
    '''), set(["RuntimeError"])),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except RuntimeError:
            if another_func():
                raise #@
    '''), set(["RuntimeError"])),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except RuntimeError:
            try:
                another_func()
                raise #@
            except NameError:
                pass
    '''), set(["RuntimeError"])),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except RuntimeError:
            try:
                another_func()
            except NameError:
                raise #@
    '''), set(["NameError"])),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except:
            raise #@
    '''), set()),

    (astroid.extract_node('''
    def my_func():
        try:
            fake_func()
        except (RuntimeError, ValueError):
            raise #@
    '''), set(["RuntimeError", "ValueError"])),

    (astroid.extract_node('''
    import not_a_module
    def my_func():
        try:
            fake_func()
        except not_a_module.Error:
            raise #@
    '''), set()),

])
def test_exception(raise_node, expected):
    found = utils.possible_exc_types(raise_node)
    assert found == expected
