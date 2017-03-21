"""Results backends are used to store long-running query results

The Abstraction is flask-cache, which uses the BaseCache class from werkzeug
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

try:
    import cPickle as pickle
except ImportError:
    import pickle

import io
import logging

import boto3
from werkzeug.contrib.cache import BaseCache

from superset import app

config = app.config


class S3Cache(BaseCache):

    """S3 cache implementation.

    Adapted from examples in
    https://github.com/pallets/werkzeug/blob/master/werkzeug/contrib/cache.py.

    Timeout parameters are ignored as S3 doesn't support key-level expiration.
    To expire keys, set up an expiration policy as described in
    https://aws.amazon.com/blogs/aws/amazon-s3-object-expiration/.
    """

    def __init__(self, default_timeout=300):
        self.default_timeout = default_timeout

        self.s3_client = boto3.client('s3')

        self.bucket = config.get('S3_CACHE_BUCKET')
        self.key_prefix = config.get('S3_CACHE_KEY_PREFIX')

    def get(self, key):
        """Look up key in the cache and return the value for it.

        :param key: the key to be looked up.
        :returns: The value if it exists and is readable, else ``None``.
        """
        if not self._key_exists(key):
            return None
        else:
            value_file = io.BytesIO()

            try:
                self.s3_client.download_fileobj(
                    self.bucket,
                    self._full_s3_key(key),
                    value_file
                )
            except Exception as e:
                logging.warn('Error while trying to get key %s', key)
                logging.exception(e)

                return None
            else:
                value_file.seek(0)
                return pickle.load(value_file)

    def delete(self, key):
        """Delete `key` from the cache.

        :param key: the key to delete.
        :returns: Whether the key existed and has been deleted.
        :rtype: boolean
        """
        if not self._key_exists(key):
            return False
        else:
            try:
                self.s3_client.delete_objects(
                    Bucket=self.bucket,
                    Delete={
                        'Objects': [
                            {
                                'Key': self._full_s3_key(key)
                            }
                        ]
                    }
                )
            except Exception as e:
                logging.warn('Error while trying to delete key %s', key)
                logging.exception(e)

                return False
            else:
                return True

    def set(self, key, value, timeout=None):
        """Add a new key/value to the cache.

        If the key already exists, the existing value is overwritten.

        :param key: the key to set
        :param value: the value for the key
        :param timeout: the cache timeout for the key in seconds (if not
                        specified, it uses the default timeout). A timeout of
                        0 idicates that the cache never expires.
        :returns: ``True`` if key has been updated, ``False`` for backend
                  errors. Pickling errors, however, will raise a subclass of
                  ``pickle.PickleError``.
        :rtype: boolean
        """
        value_file = io.BytesIO()
        pickle.dump(value, value_file)

        try:
            value_file.seek(0)
            self.s3_client.upload_fileobj(
                value_file,
                self.bucket,
                self._full_s3_key(key)
            )
        except Exception as e:
            logging.warn('Error while trying to set key %s', key)
            logging.exception(e)

            return False
        else:
            return True

    def add(self, key, value, timeout=None):
        """Works like :meth:`set` but does not overwrite existing values.

        :param key: the key to set
        :param value: the value for the key
        :param timeout: the cache timeout for the key in seconds (if not
                        specified, it uses the default timeout). A timeout of
                        0 idicates that the cache never expires.
        :returns: Same as :meth:`set`, but also ``False`` for already
                  existing keys.
        :rtype: boolean
        """
        if self._key_exists(key):
            return False
        else:
            return self.set(key, value, timeout=timeout)

    def clear(self):
        """Clears the cache.

        Keep in mind that not all caches support completely clearing the cache.
        :returns: Whether the cache has been cleared.
        :rtype: boolean
        """
        return False

    def _full_s3_key(self, key):
        """Convert a cache key to a full S3 key, including the key prefix."""
        return '%s%s' % (self.key_prefix, key)

    def _key_exists(self, key):
        """Determine whether the given key exists in the bucket."""
        try:
            self.s3_client.head_object(
                Bucket=self.bucket,
                Key=self._full_s3_key(key)
            )
        except Exception:
            # head_object throws an exception when object doesn't exist
            return False
        else:
            return True
