# -*- coding: utf-8 -*-

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals


class SupersetException(Exception):
    pass


class SupersetTimeoutException(SupersetException):
    pass


class SupersetSecurityException(SupersetException):
    pass


class MetricPermException(SupersetException):
    pass


class NoDataException(SupersetException):
    def __init__(self, *args, **kwargs):
        SupersetException.__init__(self, *args, **kwargs)
        self.status = int(kwargs.get('status')) if kwargs.get('status') else 400


class SupersetTemplateException(SupersetException):
    pass
