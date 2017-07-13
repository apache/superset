"""
Check for indexing exceptions.
"""
# pylint: disable=import-error, no-absolute-import

from unknown import ExtensionException
__revision__ = 0

class SubException(IndexError):
    """ empty """

_ = IndexError("test")[0] # [indexing-exception]
_ = ZeroDivisionError("error")[0] # [indexing-exception]
_ = ExtensionException("error")[0]
_ = SubException("error")[1] # [indexing-exception]
