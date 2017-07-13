import sys

__all__ = (
    'text_type', 'string_types', 'izip', 'iteritems', 'itervalues',
    'with_metaclass',
)

if sys.version_info[0] >= 3:
    text_type = str
    string_types = (str, )
    izip = zip

    def iteritems(o):
        return o.items()

    def itervalues(o):
        return o.values()

else:
    text_type = unicode
    string_types = (basestring, )
    from itertools import izip

    def iteritems(o):
        return o.iteritems()

    def itervalues(o):
        return o.itervalues()


def with_metaclass(meta, base=object):
    return meta("NewBase", (base,), {})
