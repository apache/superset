from __future__ import absolute_import

import sys

from celery.utils.serialization import (
    UnpickleableExceptionWrapper,
    get_pickleable_etype,
)

from celery.tests.case import Case, mask_modules


class test_AAPickle(Case):

    def test_no_cpickle(self):
        prev = sys.modules.pop('celery.utils.serialization', None)
        try:
            with mask_modules('cPickle'):
                from celery.utils.serialization import pickle
                import pickle as orig_pickle
                self.assertIs(pickle.dumps, orig_pickle.dumps)
        finally:
            sys.modules['celery.utils.serialization'] = prev


class test_UnpickleExceptionWrapper(Case):

    def test_init(self):
        x = UnpickleableExceptionWrapper('foo', 'Bar', [10, lambda x: x])
        self.assertTrue(x.exc_args)
        self.assertEqual(len(x.exc_args), 2)


class test_get_pickleable_etype(Case):

    def test_get_pickleable_etype(self):

        class Unpickleable(Exception):
            def __reduce__(self):
                raise ValueError('foo')

        self.assertIs(get_pickleable_etype(Unpickleable), Exception)
