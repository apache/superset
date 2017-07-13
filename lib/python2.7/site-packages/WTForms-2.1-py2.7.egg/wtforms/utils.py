

class UnsetValue(object):
    """
    An unset value.

    This is used in situations where a blank value like `None` is acceptable
    usually as the default value of a class variable or function parameter
    (iow, usually when `None` is a valid value.)
    """
    def __str__(self):
        return '<unset value>'

    def __repr__(self):
        return '<unset value>'

    def __bool__(self):
        return False

    def __nonzero__(self):
        return False

unset_value = UnsetValue()


class WebobInputWrapper(object):
    """
    Wrap a webob MultiDict for use as passing as `formdata` to Field.

    Since for consistency, we have decided in WTForms to support as input a
    small subset of the API provided in common between cgi.FieldStorage,
    Django's QueryDict, and Werkzeug's MultiDict, we need to wrap Webob, the
    only supported framework whose multidict does not fit this API, but is
    nevertheless used by a lot of frameworks.

    While we could write a full wrapper to support all the methods, this will
    undoubtedly result in bugs due to some subtle differences between the
    various wrappers. So we will keep it simple.
    """

    def __init__(self, multidict):
        self._wrapped = multidict

    def __iter__(self):
        return iter(self._wrapped)

    def __len__(self):
        return len(self._wrapped)

    def __contains__(self, name):
        return (name in self._wrapped)

    def getlist(self, name):
        return self._wrapped.getall(name)
