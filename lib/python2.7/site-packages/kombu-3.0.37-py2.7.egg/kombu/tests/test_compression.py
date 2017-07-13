from __future__ import absolute_import

import sys

from kombu import compression

from .case import Case, SkipTest, mask_modules


class test_compression(Case):

    def setUp(self):
        try:
            import bz2  # noqa
        except ImportError:
            self.has_bzip2 = False
        else:
            self.has_bzip2 = True

    @mask_modules('bz2')
    def test_no_bz2(self):
        c = sys.modules.pop('kombu.compression')
        try:
            import kombu.compression
            self.assertFalse(hasattr(kombu.compression, 'bz2'))
        finally:
            if c is not None:
                sys.modules['kombu.compression'] = c

    def test_encoders(self):
        encoders = compression.encoders()
        self.assertIn('application/x-gzip', encoders)
        if self.has_bzip2:
            self.assertIn('application/x-bz2', encoders)

    def test_compress__decompress__zlib(self):
        text = b'The Quick Brown Fox Jumps Over The Lazy Dog'
        c, ctype = compression.compress(text, 'zlib')
        self.assertNotEqual(text, c)
        d = compression.decompress(c, ctype)
        self.assertEqual(d, text)

    def test_compress__decompress__bzip2(self):
        if not self.has_bzip2:
            raise SkipTest('bzip2 not available')
        text = b'The Brown Quick Fox Over The Lazy Dog Jumps'
        c, ctype = compression.compress(text, 'bzip2')
        self.assertNotEqual(text, c)
        d = compression.decompress(c, ctype)
        self.assertEqual(d, text)
