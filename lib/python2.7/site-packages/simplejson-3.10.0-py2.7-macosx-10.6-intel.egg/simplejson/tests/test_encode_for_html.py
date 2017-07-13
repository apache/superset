import unittest

import simplejson as json

class TestEncodeForHTML(unittest.TestCase):

    def setUp(self):
        self.decoder = json.JSONDecoder()
        self.encoder = json.JSONEncoderForHTML()

    def test_basic_encode(self):
        self.assertEqual(r'"\u0026"', self.encoder.encode('&'))
        self.assertEqual(r'"\u003c"', self.encoder.encode('<'))
        self.assertEqual(r'"\u003e"', self.encoder.encode('>'))

    def test_basic_roundtrip(self):
        for char in '&<>':
            self.assertEqual(
                char, self.decoder.decode(
                    self.encoder.encode(char)))

    def test_prevent_script_breakout(self):
        bad_string = '</script><script>alert("gotcha")</script>'
        self.assertEqual(
            r'"\u003c/script\u003e\u003cscript\u003e'
            r'alert(\"gotcha\")\u003c/script\u003e"',
            self.encoder.encode(bad_string))
        self.assertEqual(
            bad_string, self.decoder.decode(
                self.encoder.encode(bad_string)))
