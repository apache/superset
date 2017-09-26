from datetime import datetime, date, timedelta, time
from decimal import Decimal
from superset.utils import (
    json_int_dttm_ser,
    json_iso_dttm_ser,
    base_json_conv,
    parse_human_timedelta,
    zlib_compress,
    zlib_decompress_to_string,
    datetime_f,
    JSONEncodedDict,
    validate_json,
    SupersetException,
)
import unittest
import uuid

from mock import Mock, patch
import numpy


class UtilsTestCase(unittest.TestCase):
    def test_json_int_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        ts = 1577836800000.0
        assert json_int_dttm_ser(dttm) == ts
        assert json_int_dttm_ser(date(2020, 1, 1)) == ts
        assert json_int_dttm_ser(datetime(1970, 1, 1)) == 0
        assert json_int_dttm_ser(date(1970, 1, 1)) == 0
        assert json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)

        with self.assertRaises(TypeError):
            json_int_dttm_ser("this is not a date")

    def test_json_iso_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        dt = date(2020, 1, 1)
        t = time()
        assert json_iso_dttm_ser(dttm) == dttm.isoformat()
        assert json_iso_dttm_ser(dt) == dt.isoformat()
        assert json_iso_dttm_ser(t) == t.isoformat()

        with self.assertRaises(TypeError):
            json_iso_dttm_ser("this is not a date")

    def test_base_json_conv(self):
        assert isinstance(base_json_conv(numpy.bool_(1)), bool) is True
        assert isinstance(base_json_conv(numpy.int64(1)), int) is True
        assert isinstance(base_json_conv(set([1])), list) is True
        assert isinstance(base_json_conv(Decimal('1.0')), float) is True
        assert isinstance(base_json_conv(uuid.uuid4()), str) is True

    @patch('superset.utils.datetime')
    def test_parse_human_timedelta(self, mock_now):
        mock_now.return_value = datetime(2016, 12, 1)
        self.assertEquals(parse_human_timedelta('now'), timedelta(0))

    def test_zlib_compression(self):
        json_str = """{"test": 1}"""
        blob = zlib_compress(json_str)
        got_str = zlib_decompress_to_string(blob)
        self.assertEquals(json_str, got_str)

    def test_datetime_f(self):
        self.assertEquals(datetime_f(datetime(1990, 9, 21, 19, 11, 19, 626096)),
            '<nobr>1990-09-21T19:11:19.626096</nobr>')
        self.assertEquals(len(datetime_f(datetime.now())), 28)
        self.assertEquals(datetime_f(None), '<nobr>None</nobr>')
        iso = datetime.now().isoformat()[:10].split('-')
        [a, b, c] = [int(v) for v in iso]
        self.assertEquals(datetime_f(datetime(a, b, c)), '<nobr>00:00:00</nobr>')

    def test_json_encoded_obj(self):
        obj = {'a': 5, 'b': ['a', 'g', 5]}
        val = '{"a": 5, "b": ["a", "g", 5]}'
        jsonObj = JSONEncodedDict()
        resp = jsonObj.process_bind_param(obj, 'dialect')
        self.assertIn('"a": 5', resp)
        self.assertIn('"b": ["a", "g", 5]', resp)
        self.assertEquals(jsonObj.process_result_value(val, 'dialect'), obj)

    def test_validate_json(self):
        invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
        with self.assertRaises(SupersetException):
            validate_json(invalid)
