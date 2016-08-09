from datetime import datetime, date, timedelta
from caravel import utils
import unittest


class UtilsTestCase(unittest.TestCase):
    def test_json_int_dttm_ser(self):
        today = date.today()
        now = datetime.now()
        ms = utils.json_int_dttm_ser(today)
        deser = (utils.EPOCH + timedelta(milliseconds=ms)).date()
        assert today == deser, "Serialization error: %s is not %s" % (str(today), str(deser))
        ms = utils.json_int_dttm_ser(now)
        deser = (utils.EPOCH + timedelta(milliseconds=ms))
        assert now == deser, "Serialization error: %s is not %s" % (str(now), str(deser))

        with self.assertRaises(TypeError):
            utils.json_int_dttm_ser("this is not a date")

