# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


"""Tests for the astroid AST peephole optimizer."""

import ast
import textwrap
import unittest

import astroid
from astroid import astpeephole
from astroid import builder
from astroid import manager
from astroid import test_utils
from astroid.tests import resources


MANAGER = manager.AstroidManager()


class PeepholeOptimizer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        MANAGER.optimize_ast = True

    @classmethod
    def tearDownClass(cls):
        MANAGER.optimize_ast = False

    def setUp(self):
        self._optimizer = astpeephole.ASTPeepholeOptimizer()

    @staticmethod
    def _get_binops(code):
        module = ast.parse(textwrap.dedent(code))
        return [node.value for node in module.body
                if isinstance(node, ast.Expr)]

    @test_utils.require_version(maxver='3.0')
    def test_optimize_binop_unicode(self):
        nodes = self._get_binops("""
        u"a" + u"b" + u"c"

        u"a" + "c" + "b"
        u"a" + b"c"
        """)

        result = self._optimizer.optimize_binop(nodes[0])
        self.assertIsInstance(result, astroid.Const)
        self.assertEqual(result.value, u"abc")

        self.assertIsNone(self._optimizer.optimize_binop(nodes[1]))
        self.assertIsNone(self._optimizer.optimize_binop(nodes[2]))

    def test_optimize_binop(self):
        nodes = self._get_binops("""
        "a" + "b" + "c" + "d"
        b"a" + b"b" + b"c" + b"d"
        "a" + "b"

        "a" + "b" + 1 + object
        var = 4
        "a" + "b" + var + "c"
        "a" + "b" + "c" - "4"
        "a" + "b" + "c" + "d".format()
        "a" - "b"
        "a"
        1 + 4 + 5 + 6
        """)

        result = self._optimizer.optimize_binop(nodes[0])
        self.assertIsInstance(result, astroid.Const)
        self.assertEqual(result.value, "abcd")

        result = self._optimizer.optimize_binop(nodes[1])
        self.assertIsInstance(result, astroid.Const)
        self.assertEqual(result.value, b"abcd")

        for node in nodes[2:]:
            self.assertIsNone(self._optimizer.optimize_binop(node))

    def test_big_binop_crash(self):
        # Test that we don't fail on a lot of joined strings
        # through the addition operator.
        module = resources.build_file('data/joined_strings.py')
        element = next(module['x'].infer())
        self.assertIsInstance(element, astroid.Const)
        self.assertEqual(len(element.value), 61660)

    def test_optimisation_disabled(self):
        try:
            MANAGER.optimize_ast = False
            module = builder.parse("""
            '1' + '2' + '3'
            """)
            self.assertIsInstance(module.body[0], astroid.Expr)
            self.assertIsInstance(module.body[0].value, astroid.BinOp)
            self.assertIsInstance(module.body[0].value.left, astroid.BinOp)
            self.assertIsInstance(module.body[0].value.left.left,
                                  astroid.Const)
        finally:
            MANAGER.optimize_ast = True


if __name__ == '__main__':
    unittest.main()
