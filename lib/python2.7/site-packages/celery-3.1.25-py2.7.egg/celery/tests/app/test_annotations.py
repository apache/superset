from __future__ import absolute_import

from celery.app.annotations import MapAnnotation, prepare
from celery.utils.imports import qualname

from celery.tests.case import AppCase


class MyAnnotation(object):
    foo = 65


class AnnotationCase(AppCase):

    def setup(self):
        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

        @self.app.task(shared=False)
        def mul(x, y):
            return x * y
        self.mul = mul


class test_MapAnnotation(AnnotationCase):

    def test_annotate(self):
        x = MapAnnotation({self.add.name: {'foo': 1}})
        self.assertDictEqual(x.annotate(self.add), {'foo': 1})
        self.assertIsNone(x.annotate(self.mul))

    def test_annotate_any(self):
        x = MapAnnotation({'*': {'foo': 2}})
        self.assertDictEqual(x.annotate_any(), {'foo': 2})

        x = MapAnnotation()
        self.assertIsNone(x.annotate_any())


class test_prepare(AnnotationCase):

    def test_dict_to_MapAnnotation(self):
        x = prepare({self.add.name: {'foo': 3}})
        self.assertIsInstance(x[0], MapAnnotation)

    def test_returns_list(self):
        self.assertListEqual(prepare(1), [1])
        self.assertListEqual(prepare([1]), [1])
        self.assertListEqual(prepare((1, )), [1])
        self.assertEqual(prepare(None), ())

    def test_evalutes_qualnames(self):
        self.assertEqual(prepare(qualname(MyAnnotation))[0]().foo, 65)
        self.assertEqual(prepare([qualname(MyAnnotation)])[0]().foo, 65)
