import pytest

from pandas.compat import StringIO
from pandas import read_sas


class TestSas(object):

    def test_sas_buffer_format(self):

        # GH14947
        b = StringIO("")
        with pytest.raises(ValueError):
            read_sas(b)
