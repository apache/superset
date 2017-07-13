"""
Check accessing Exception.message
"""
# pylint: disable=import-error, no-absolute-import, broad-except

from unknown import ExtensionException
__revision__ = 0

class SubException(IndexError):
    """ empty """

_ = IndexError("test").message # [exception-message-attribute]
_ = ZeroDivisionError("error").message # [exception-message-attribute]
_ = ExtensionException("error").message
_ = SubException("error").message # [exception-message-attribute]

try:
    raise Exception('e')
except Exception as exception:
    _ = exception.message # [exception-message-attribute]
    del exception.message # [exception-message-attribute]
    exception.message += 'hello world' # [exception-message-attribute]
    exception.message = 'hello world'
