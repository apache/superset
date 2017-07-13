# coding: utf-8

import pytest

from pandas.io.msgpack import packb, unpackb


class DummyException(Exception):
    pass


class TestExceptions(object):

    def test_raise_on_find_unsupported_value(self):
        import datetime
        pytest.raises(TypeError, packb, datetime.datetime.now())

    def test_raise_from_object_hook(self):
        def hook(obj):
            raise DummyException

        pytest.raises(DummyException, unpackb, packb({}), object_hook=hook)
        pytest.raises(DummyException, unpackb, packb({'fizz': 'buzz'}),
                      object_hook=hook)
        pytest.raises(DummyException, unpackb, packb({'fizz': 'buzz'}),
                      object_pairs_hook=hook)
        pytest.raises(DummyException, unpackb,
                      packb({'fizz': {'buzz': 'spam'}}), object_hook=hook)
        pytest.raises(DummyException, unpackb,
                      packb({'fizz': {'buzz': 'spam'}}),
                      object_pairs_hook=hook)

    def test_invalidvalue(self):
        pytest.raises(ValueError, unpackb, b'\xd9\x97#DL_')
