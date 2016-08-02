from datetime import datetime, date
from caravel import utils
import unittest


class UtilsTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(UtilsTestCase, self).__init__(*args, **kwargs)

    def test_jsonDateSerialization(self):
        utils.json_int_dttm_ser(date.today())
        utils.json_int_dttm_ser(datetime.now())
