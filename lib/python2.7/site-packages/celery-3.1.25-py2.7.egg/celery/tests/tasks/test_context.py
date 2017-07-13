# -*- coding: utf-8 -*-'
from __future__ import absolute_import

from celery.app.task import Context
from celery.tests.case import AppCase


# Retreive the values of all context attributes as a
# dictionary in an implementation-agnostic manner.
def get_context_as_dict(ctx, getter=getattr):
    defaults = {}
    for attr_name in dir(ctx):
        if attr_name.startswith('_'):
            continue   # Ignore pseudo-private attributes
        attr = getter(ctx, attr_name)
        if callable(attr):
            continue   # Ignore methods and other non-trivial types
        defaults[attr_name] = attr
    return defaults
default_context = get_context_as_dict(Context())


class test_Context(AppCase):

    def test_default_context(self):
        # A bit of a tautological test, since it uses the same
        # initializer as the default_context constructor.
        defaults = dict(default_context, children=[])
        self.assertDictEqual(get_context_as_dict(Context()), defaults)

    def test_updated_context(self):
        expected = dict(default_context)
        changes = dict(id='unique id', args=['some', 1], wibble='wobble')
        ctx = Context()
        expected.update(changes)
        ctx.update(changes)
        self.assertDictEqual(get_context_as_dict(ctx), expected)
        self.assertDictEqual(get_context_as_dict(Context()), default_context)

    def test_modified_context(self):
        expected = dict(default_context)
        ctx = Context()
        expected['id'] = 'unique id'
        expected['args'] = ['some', 1]
        ctx.id = 'unique id'
        ctx.args = ['some', 1]
        self.assertDictEqual(get_context_as_dict(ctx), expected)
        self.assertDictEqual(get_context_as_dict(Context()), default_context)

    def test_cleared_context(self):
        changes = dict(id='unique id', args=['some', 1], wibble='wobble')
        ctx = Context()
        ctx.update(changes)
        ctx.clear()
        defaults = dict(default_context, children=[])
        self.assertDictEqual(get_context_as_dict(ctx), defaults)
        self.assertDictEqual(get_context_as_dict(Context()), defaults)

    def test_context_get(self):
        expected = dict(default_context)
        changes = dict(id='unique id', args=['some', 1], wibble='wobble')
        ctx = Context()
        expected.update(changes)
        ctx.update(changes)
        ctx_dict = get_context_as_dict(ctx, getter=Context.get)
        self.assertDictEqual(ctx_dict, expected)
        self.assertDictEqual(get_context_as_dict(Context()), default_context)
