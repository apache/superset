# Copyright (c) 2006-2008, 2010, 2013 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

import os
from os.path import exists

import pytest

from pylint.checkers import initialize, imports
from pylint.lint import PyLinter

import pylint.testutils as testutils


@pytest.fixture
def dest():
    dest = 'dependencies_graph.dot'
    yield dest
    os.remove(dest)


def test_dependencies_graph(dest):
    imports._dependencies_graph(dest, {'labas': ['hoho', 'yep'],
                                       'hoho': ['yep']})
    with open(dest) as stream:
        assert stream.read().strip() == '''
digraph "dependencies_graph" {
rankdir=LR
charset="utf-8"
URL="." node[shape="box"]
"hoho" [];
"yep" [];
"labas" [];
"yep" -> "hoho" [];
"hoho" -> "labas" [];
"yep" -> "labas" [];
}
'''.strip()


@pytest.fixture
def linter():
    l = PyLinter(reporter=testutils.TestReporter())
    initialize(l)
    return l


@pytest.fixture
def remove_files():
    yield
    for fname in ('import.dot', 'ext_import.dot', 'int_import.dot'):
        try:
            os.remove(fname)
        except:
            pass


@pytest.mark.usefixture("remove_files")
def test_checker_dep_graphs(linter):
    l = linter
    l.global_set_option('persistent', False)
    l.global_set_option('reports', True)
    l.global_set_option('enable', 'imports')
    l.global_set_option('import-graph', 'import.dot')
    l.global_set_option('ext-import-graph', 'ext_import.dot')
    l.global_set_option('int-import-graph', 'int_import.dot')
    l.global_set_option('int-import-graph', 'int_import.dot')
    # ignore this file causing spurious MemoryError w/ some python version (>=2.3?)
    l.global_set_option('ignore', ('func_unknown_encoding.py',))
    l.check('input')
    l.generate_reports()
    assert exists('import.dot')
    assert exists('ext_import.dot')
    assert exists('int_import.dot')
