# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the pylint.checkers.utils module."""

import astroid

from pylint.checkers import utils
import pytest


@pytest.mark.parametrize("name,expected", [
    ('min', True),
    ('__builtins__', True),
    ('__path__', False),
    ('__file__', False),
    ('whatever', False),
    ('mybuiltin', False),
])
def testIsBuiltin(name, expected):
    assert utils.is_builtin(name) == expected


@pytest.mark.parametrize("fn,kw", [
    ('foo(3)', {'keyword': 'bar'}),
    ('foo(one=a, two=b, three=c)', {'position': 1}),
])
def testGetArgumentFromCallError(fn, kw):
    with pytest.raises(utils.NoSuchArgumentError):
        node = astroid.extract_node(fn)
        utils.get_argument_from_call(node, **kw)


@pytest.mark.parametrize("fn,kw", [
    ('foo(bar=3)', {'keyword': 'bar'}),
    ('foo(a, b, c)', {'position': 1}),
])
def testGetArgumentFromCallExists(fn, kw):
    node = astroid.extract_node(fn)
    assert utils.get_argument_from_call(node, **kw) is not None


def testGetArgumentFromCall():
    node = astroid.extract_node('foo(a, not_this_one=1, this_one=2)')
    arg = utils.get_argument_from_call(node, position=2, keyword='this_one')
    assert 2 == arg.value

    node = astroid.extract_node('foo(a)')
    with pytest.raises(utils.NoSuchArgumentError):
        utils.get_argument_from_call(node, position=1)
    with pytest.raises(ValueError):
        utils.get_argument_from_call(node, None, None)
    name = utils.get_argument_from_call(node, position=0)
    assert name.name == 'a'


def test_error_of_type():
    nodes = astroid.extract_node("""
    try: pass
    except AttributeError: #@
         pass
    try: pass
    except Exception: #@
         pass
    except: #@
         pass
    """)
    assert utils.error_of_type(nodes[0], AttributeError)
    assert utils.error_of_type(nodes[0], (AttributeError, ))
    assert not utils.error_of_type(nodes[0], Exception)
    assert utils.error_of_type(nodes[1], Exception)
    assert not utils.error_of_type(nodes[2], ImportError)


def test_node_ignores_exception():
    nodes = astroid.extract_node("""
    try:
        1/0 #@
    except ZeroDivisionError:
        pass
    try:
        1/0 #@
    except Exception:
        pass
    try:
        2/0 #@
    except:
        pass
    try:
        1/0 #@
    except ValueError:
        pass
    """)
    assert utils.node_ignores_exception(nodes[0], ZeroDivisionError)
    assert not utils.node_ignores_exception(nodes[1], ZeroDivisionError)
    assert not utils.node_ignores_exception(nodes[2], ZeroDivisionError)
    assert not utils.node_ignores_exception(nodes[3], ZeroDivisionError)
