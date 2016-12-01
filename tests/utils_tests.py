from datetime import datetime, date, timedelta
from superset import utils
import unittest

from mock import Mock, patch

class UtilsTestCase(unittest.TestCase):
    def test_json_int_dttm_ser(self):
        dttm = datetime(2020, 1, 1)
        ts = 1577836800000.0
        json_int_dttm_ser = utils.json_int_dttm_ser
        assert json_int_dttm_ser(dttm) == ts
        assert json_int_dttm_ser(date(2020, 1, 1)) == ts
        assert json_int_dttm_ser(datetime(1970, 1, 1)) == 0
        assert json_int_dttm_ser(date(1970, 1, 1)) == 0
        assert json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)

        with self.assertRaises(TypeError):
            utils.json_int_dttm_ser("this is not a date")

    @patch('superset.utils.datetime')
    def test_parse_human_timedelta(self, mock_now):
        mock_now.return_value = datetime(2016, 12, 1)
        self.assertEquals(utils.parse_human_timedelta('now'), timedelta(0))
