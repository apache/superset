# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


from __future__ import print_function

import contextlib
import time
import unittest

from astroid import builder
from astroid import nodes
from astroid import parse
from astroid import transforms


@contextlib.contextmanager
def add_transform(manager, node, transform, predicate=None):
    manager.register_transform(node, transform, predicate)
    try:
        yield
    finally:
        manager.unregister_transform(node, transform, predicate)


class TestTransforms(unittest.TestCase):

    def setUp(self):
        self.transformer = transforms.TransformVisitor()

    def parse_transform(self, code):
        module = parse(code, apply_transforms=False)
        return self.transformer.visit(module)

    def test_function_inlining_transform(self):
        def transform_call(node):
            # Let's do some function inlining
            inferred = next(node.infer())
            return inferred

        self.transformer.register_transform(nodes.Call,
                                            transform_call)

        module = self.parse_transform('''
        def test(): return 42
        test() #@
        ''')

        self.assertIsInstance(module.body[1], nodes.Expr)
        self.assertIsInstance(module.body[1].value, nodes.Const)
        self.assertEqual(module.body[1].value.value, 42)

    def test_recursive_transforms_into_astroid_fields(self):
        # Test that the transformer walks properly the tree
        # by going recursively into the _astroid_fields per each node.
        def transform_compare(node):
            # Let's check the values of the ops
            _, right = node.ops[0]
            # Assume they are Consts and they were transformed before
            # us.
            return nodes.const_factory(node.left.value < right.value)

        def transform_name(node):
            # Should be Consts
            return next(node.infer())

        self.transformer.register_transform(nodes.Compare, transform_compare)
        self.transformer.register_transform(nodes.Name, transform_name)

        module = self.parse_transform('''
        a = 42
        b = 24
        a < b
        ''')

        self.assertIsInstance(module.body[2], nodes.Expr)
        self.assertIsInstance(module.body[2].value, nodes.Const)
        self.assertFalse(module.body[2].value.value)

    def test_transform_patches_locals(self):
        def transform_function(node):
            assign = nodes.Assign()
            name = nodes.AssignName()
            name.name = 'value'
            assign.targets = [name]
            assign.value = nodes.const_factory(42)
            node.body.append(assign)

        self.transformer.register_transform(nodes.FunctionDef,
                                            transform_function)

        module = self.parse_transform('''
        def test():
            pass
        ''')

        func = module.body[0]
        self.assertEqual(len(func.body), 2)
        self.assertIsInstance(func.body[1], nodes.Assign)
        self.assertEqual(func.body[1].as_string(), 'value = 42')

    def test_predicates(self):
        def transform_call(node):
            inferred = next(node.infer())
            return inferred

        def should_inline(node):
            return node.func.name.startswith('inlineme')

        self.transformer.register_transform(nodes.Call,
                                            transform_call,
                                            should_inline)

        module = self.parse_transform('''
        def inlineme_1():
            return 24
        def dont_inline_me():
            return 42
        def inlineme_2():
            return 2
        inlineme_1()
        dont_inline_me()
        inlineme_2()
        ''')
        values = module.body[-3:]
        self.assertIsInstance(values[0], nodes.Expr)
        self.assertIsInstance(values[0].value, nodes.Const)
        self.assertEqual(values[0].value.value, 24)
        self.assertIsInstance(values[1], nodes.Expr)
        self.assertIsInstance(values[1].value, nodes.Call)
        self.assertIsInstance(values[2], nodes.Expr)
        self.assertIsInstance(values[2].value, nodes.Const)
        self.assertEqual(values[2].value.value, 2)

    def test_transforms_are_separated(self):
        # Test that the transforming is done at a separate
        # step, which means that we are not doing inference
        # on a partially constructed tree anymore, which was the
        # source of crashes in the past when certain inference rules
        # were used in a transform.
        def transform_function(node):
            if node.decorators:
                for decorator in node.decorators.nodes:
                    inferred = next(decorator.infer())
                    if inferred.qname() == 'abc.abstractmethod':
                        return next(node.infer_call_result(node))

        manager = builder.MANAGER
        with add_transform(manager, nodes.FunctionDef, transform_function):
            module = builder.parse('''
            import abc
            from abc import abstractmethod

            class A(object):
                @abc.abstractmethod
                def ala(self):
                    return 24

                @abstractmethod
                def bala(self):
                    return 42
            ''')

        cls = module['A']
        ala = cls.body[0]
        bala = cls.body[1]
        self.assertIsInstance(ala, nodes.Const)
        self.assertEqual(ala.value, 24)
        self.assertIsInstance(bala, nodes.Const)
        self.assertEqual(bala.value, 42)

    def test_transforms_are_called_for_builtin_modules(self):
        # Test that transforms are called for builtin modules.
        def transform_function(node):
            name = nodes.AssignName()
            name.name = 'value'
            node.args.args = [name]
            return node

        manager = builder.MANAGER
        predicate = lambda node: node.root().name == 'time'
        with add_transform(manager, nodes.FunctionDef,
                           transform_function, predicate):
            builder_instance = builder.AstroidBuilder()
            module = builder_instance.module_build(time)

        asctime = module['asctime']
        self.assertEqual(len(asctime.args.args), 1)
        self.assertIsInstance(asctime.args.args[0], nodes.AssignName)
        self.assertEqual(asctime.args.args[0].name, 'value')

    def test_builder_apply_transforms(self):
        def transform_function(node):
            return nodes.const_factory(42)

        manager = builder.MANAGER
        with add_transform(manager, nodes.FunctionDef, transform_function):
            astroid_builder = builder.AstroidBuilder(apply_transforms=False)
            module = astroid_builder.string_build('''def test(): pass''')

        # The transform wasn't applied.
        self.assertIsInstance(module.body[0], nodes.FunctionDef)

    def test_transform_crashes_on_is_subtype_of(self):
        # Test that we don't crash when having is_subtype_of
        # in a transform, as per issue #188. This happened
        # before, when the transforms weren't in their own step.
        def transform_class(cls):
            if cls.is_subtype_of('django.db.models.base.Model'):
                return cls
            return cls

        self.transformer.register_transform(nodes.ClassDef,
                                            transform_class)

        self.parse_transform('''
            # Change environ to automatically call putenv() if it exists
            import os
            putenv = os.putenv
            try:
                # This will fail if there's no putenv
                putenv
            except NameError:
                pass
            else:
                import UserDict
        ''')


if __name__ == '__main__':
    unittest.main()
