try:
    import cPickle as pickle
except ImportError:
    import pickle

import mock

from superset import app, results_backends
from .base_tests import SupersetTestCase

app.config['S3_CACHE_BUCKET'] = 'test-bucket'
app.config['S3_CACHE_KEY_PREFIX'] = 'test-prefix/'


class ResultsBackendsTests(SupersetTestCase):
    requires_examples = False

    @mock.patch('boto3.client')
    def setUp(self, mock_boto3_client):
        self.mock_boto3_client = mock_boto3_client
        self.mock_s3_client = mock.MagicMock()

        self.mock_boto3_client.return_value = self.mock_s3_client

        self.s3_cache = results_backends.S3Cache()
        self.s3_cache._key_exists = ResultsBackendsTests._mock_key_exists

    @staticmethod
    def _mock_download_fileobj(bucket, key, value_file):
        value_file.write(pickle.dumps('%s:%s' % (bucket, key)))

    @staticmethod
    def _mock_key_exists(key):
        return key == 'test-key'

    def test_s3_cache_initilization(self):
        self.mock_boto3_client.assert_called_with('s3')

    def test_s3_cache_set(self):
        result = self.s3_cache.set('test-key', 'test-value')

        self.assertTrue(result)
        self.mock_s3_client.upload_fileobj.assert_called_once()

        call_args = self.mock_s3_client.upload_fileobj.call_args_list[0][0]

        self.assertEquals(pickle.loads(call_args[0].getvalue()), 'test-value')
        self.assertEquals(call_args[1], 'test-bucket')
        self.assertEquals(call_args[2], 'test-prefix/test-key')

    def test_s3_cache_set_exception(self):
        self.mock_s3_client.upload_fileobj.side_effect = Exception('Something bad happened!')
        result = self.s3_cache.set('test-key', 'test-value')

        self.assertFalse(result)
        self.mock_s3_client.upload_fileobj.assert_called_once()

    def test_s3_cache_get_exists(self):
        self.mock_s3_client.download_fileobj.side_effect = (
            ResultsBackendsTests._mock_download_fileobj)
        result = self.s3_cache.get('test-key')

        self.assertEquals(result, 'test-bucket:test-prefix/test-key')
        self.mock_s3_client.download_fileobj.assert_called_once()

    def test_s3_cache_get_does_not_exist(self):
        result = self.s3_cache.get('test-key2')

        self.assertEquals(result, None)
        self.assertFalse(self.mock_s3_client.download_fileobj.called)

    def test_s3_cache_get_exception(self):
        self.mock_s3_client.download_fileobj.side_effect = Exception('Something bad happened')
        result = self.s3_cache.get('test-key')

        self.assertEquals(result, None)
        self.mock_s3_client.download_fileobj.assert_called_once()

    def test_s3_cache_delete_exists(self):
        result = self.s3_cache.delete('test-key')

        self.assertTrue(result)
        self.mock_s3_client.delete_objects.assert_called_once_with(
            Bucket='test-bucket',
            Delete={'Objects': [{'Key': 'test-prefix/test-key'}]}
        )

    def test_s3_cache_delete_does_not_exist(self):
        result = self.s3_cache.delete('test-key2')

        self.assertFalse(result)
        self.assertFalse(self.mock_s3_client.delete_objects.called)

    def test_s3_cache_delete_exception(self):
        self.mock_s3_client.delete_objects.side_effect = Exception('Something bad happened')
        result = self.s3_cache.delete('test-key')

        self.assertFalse(result)
        self.mock_s3_client.delete_objects.assert_called_once()

    def test_s3_cache_add_exists(self):
        result = self.s3_cache.add('test-key', 'test-value')

        self.assertFalse(result)
        self.assertFalse(self.mock_s3_client.upload_fileobj.called)

    def test_s3_cache_add_does_not_exist(self):
        result = self.s3_cache.add('test-key2', 'test-value')

        self.assertTrue(result)
        self.mock_s3_client.upload_fileobj.assert_called_once()

        call_args = self.mock_s3_client.upload_fileobj.call_args_list[0][0]

        self.assertEquals(pickle.loads(call_args[0].getvalue()), 'test-value')
        self.assertEquals(call_args[1], 'test-bucket')
        self.assertEquals(call_args[2], 'test-prefix/test-key2')

    def test_s3_cache_add_exception(self):
        self.mock_s3_client.upload_fileobj.side_effect = Exception('Something bad happened')
        result = self.s3_cache.add('test-key2', 'test-value')

        self.assertFalse(result)
        self.mock_s3_client.upload_fileobj.assert_called_once()
