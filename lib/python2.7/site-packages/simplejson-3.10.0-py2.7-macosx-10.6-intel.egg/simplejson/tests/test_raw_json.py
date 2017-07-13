import unittest
import simplejson as json

dct1 = {
    'key1': 'value1'
}

dct2 = {
    'key2': 'value2',
    'd1': dct1
}

dct3 = {
    'key2': 'value2',
    'd1': json.dumps(dct1)
}

dct4 = {
    'key2': 'value2',
    'd1': json.RawJSON(json.dumps(dct1))
}


class TestRawJson(unittest.TestCase):

    def test_normal_str(self):
        self.assertNotEqual(json.dumps(dct2), json.dumps(dct3))

    def test_raw_json_str(self):
        self.assertEqual(json.dumps(dct2), json.dumps(dct4))
        self.assertEqual(dct2, json.loads(json.dumps(dct4)))

    def test_list(self):
        self.assertEqual(
            json.dumps([dct2]),
            json.dumps([json.RawJSON(json.dumps(dct2))]))
        self.assertEqual(
            [dct2],
            json.loads(json.dumps([json.RawJSON(json.dumps(dct2))])))

    def test_direct(self):
        self.assertEqual(
            json.dumps(dct2),
            json.dumps(json.RawJSON(json.dumps(dct2))))
        self.assertEqual(
            dct2,
            json.loads(json.dumps(json.RawJSON(json.dumps(dct2)))))
