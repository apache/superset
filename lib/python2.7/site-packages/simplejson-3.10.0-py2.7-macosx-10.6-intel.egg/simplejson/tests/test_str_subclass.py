from unittest import TestCase

import simplejson
from simplejson.compat import text_type, u

# Tests for issue demonstrated in https://github.com/simplejson/simplejson/issues/144
class WonkyTextSubclass(text_type):
    def __getslice__(self, start, end):
        return self.__class__('not what you wanted!')

class TestStrSubclass(TestCase):
    def test_dump_load(self):
        for s in ['', '"hello"', 'text', u('\u005c')]:
            self.assertEqual(
                s,
                simplejson.loads(simplejson.dumps(WonkyTextSubclass(s))))
