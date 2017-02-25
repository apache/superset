from datetime import datetime, date, timedelta, time
from decimal import Decimal
from superset.utils import (
    json_int_dttm_ser, json_iso_dttm_ser, base_json_conv, parse_human_timedelta
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
