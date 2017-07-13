from pandas.io.common import _is_s3_url


class TestS3URL(object):

    def test_is_s3_url(self):
        assert _is_s3_url("s3://pandas/somethingelse.com")
        assert not _is_s3_url("s4://pandas/somethingelse.com")
