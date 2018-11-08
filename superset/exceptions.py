# pylint: disable=C,R,W


class SupersetException(Exception):
    status = 500

    def __init__(self, msg):
        super(SupersetException, self).__init__(msg)


class SupersetTimeoutException(SupersetException):
    pass


class SupersetSecurityException(SupersetException):
    status = 401

    def __init__(self, msg, link=None):
        super(SupersetSecurityException, self).__init__(msg)
        self.link = link


class MetricPermException(SupersetException):
    pass


class NoDataException(SupersetException):
    status = 400


class NullValueException(SupersetException):
    status = 400


class SupersetTemplateException(SupersetException):
    pass


class SpatialException(SupersetException):
    pass
