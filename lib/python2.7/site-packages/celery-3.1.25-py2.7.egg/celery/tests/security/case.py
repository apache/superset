from __future__ import absolute_import

from celery.tests.case import AppCase, SkipTest

import sys


class SecurityCase(AppCase):

    def setup(self):
        if sys.version_info[0] == 3:
            raise SkipTest('PyOpenSSL does not work on Python 3')
        try:
            from OpenSSL import crypto  # noqa
        except ImportError:
            raise SkipTest('OpenSSL.crypto not installed')
