from datetime import datetime, date
from caravel import utils
import unittest


class UtilsTestCase(unittest.TestCase):
    def test_json_int_dttm_ser(self):
        utils.json_int_dttm_ser(date.today())
        utils.json_int_dttm_ser(datetime.now())
