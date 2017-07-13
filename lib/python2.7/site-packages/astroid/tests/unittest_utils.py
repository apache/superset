# Copyright (c) 2014, 2016 Google, Inc.
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

import unittest

from astroid import builder
from astroid import InferenceError
from astroid import nodes
from astroid import node_classes
from astroid import util as astroid_util


class InferenceUtil(unittest.TestCase):

    def test_not_exclusive(self):
        module = builder.parse("""
        x = 10
        for x in range(5):
            print (x)

        if x > 0:
            print ('#' * x)
        """, __name__, __file__)
        xass1 = module.locals['x'][0]
        assert xass1.lineno == 2
        xnames = [n for n in module.nodes_of_class(nodes.Name) if n.name == 'x']
        assert len(xnames) == 3
        assert xnames[1].lineno == 6
        self.assertEqual(node_classes.are_exclusive(xass1, xnames[1]), False)
        self.assertEqual(node_classes.are_exclusive(xass1, xnames[2]), False)

    def test_if(self):
        module = builder.parse('''
        if 1:
            a = 1
            a = 2
        elif 2:
            a = 12
            a = 13
        else:
            a = 3
            a = 4
        ''')
        a1 = module.locals['a'][0]
        a2 = module.locals['a'][1]
        a3 = module.locals['a'][2]
        a4 = module.locals['a'][3]
        a5 = module.locals['a'][4]
        a6 = module.locals['a'][5]
        self.assertEqual(node_classes.are_exclusive(a1, a2), False)
        self.assertEqual(node_classes.are_exclusive(a1, a3), True)
        self.assertEqual(node_classes.are_exclusive(a1, a5), True)
        self.assertEqual(node_classes.are_exclusive(a3, a5), True)
        self.assertEqual(node_classes.are_exclusive(a3, a4), False)
        self.assertEqual(node_classes.are_exclusive(a5, a6), False)

    def test_try_except(self):
        module = builder.parse('''
        try:
            def exclusive_func2():
                "docstring"
        except TypeError:
            def exclusive_func2():
                "docstring"
        except:
            def exclusive_func2():
                "docstring"
        else:
            def exclusive_func2():
                "this one redefine the one defined line 42"
        ''')
        f1 = module.locals['exclusive_func2'][0]
        f2 = module.locals['exclusive_func2'][1]
        f3 = module.locals['exclusive_func2'][2]
        f4 = module.locals['exclusive_func2'][3]
        self.assertEqual(node_classes.are_exclusive(f1, f2), True)
        self.assertEqual(node_classes.are_exclusive(f1, f3), True)
        self.assertEqual(node_classes.are_exclusive(f1, f4), False)
        self.assertEqual(node_classes.are_exclusive(f2, f4), True)
        self.assertEqual(node_classes.are_exclusive(f3, f4), True)
        self.assertEqual(node_classes.are_exclusive(f3, f2), True)

        self.assertEqual(node_classes.are_exclusive(f2, f1), True)
        self.assertEqual(node_classes.are_exclusive(f4, f1), False)
        self.assertEqual(node_classes.are_exclusive(f4, f2), True)

    def test_unpack_infer_uninferable_nodes(self):
        node = builder.extract_node('''
        x = [A] * 1
        f = [x, [A] * 2]
        f
        ''')
        inferred = next(node.infer())
        unpacked = list(node_classes.unpack_infer(inferred))
        self.assertEqual(len(unpacked), 3)
        self.assertTrue(all(elt is astroid_util.Uninferable
                            for elt in unpacked))

    def test_unpack_infer_empty_tuple(self):
        node = builder.extract_node('''
        ()
        ''')
        inferred = next(node.infer())
        with self.assertRaises(InferenceError):
            list(node_classes.unpack_infer(inferred))


if __name__ == '__main__':
    unittest.main()
