"""Results backends are used to store long-running query results

The Abstraction is flask-cache, which uses the BaseCache class from werkzeug
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from werkzeug.contrib.cache import BaseCache


class S3Cache(BaseCache):

    """S3 cache"""

    def __init__(self, default_timeout=300):
        self.default_timeout = default_timeout

    def get(self, key):
        return None

    def delete(self, key):
        return True

    def set(self, key, value, timeout=None):
        return True

    def add(self, key, value, timeout=None):
        """Works like :meth:`set` but does not overwrite the values of already
        existing keys.
        :param key: the key to set
        :param value: the value for the key
        :param timeout: the cache timeout for the key in seconds (if not
                        specified, it uses the default timeout). A timeout of
                        0 idicates that the cache never expires.
        :returns: Same as :meth:`set`, but also ``False`` for already
                  existing keys.
        :rtype: boolean
        """
        return True

    def clear(self):
        """Clears the cache.  Keep in mind that not all caches support
        completely clearing the cache.
        :returns: Whether the cache has been cleared.
        :rtype: boolean
        """
        return True
