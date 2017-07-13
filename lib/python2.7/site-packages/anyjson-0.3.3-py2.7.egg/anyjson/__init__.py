"""Wraps the best available JSON implementation available in a common
interface"""

import sys

VERSION = (0, 3, 3)
__version__ = ".".join(map(str, VERSION[0:3])) + "".join(VERSION[3:])
__author__ = "Rune Halvorsen"
__contact__ = "runefh@gmail.com"
__homepage__ = "http://bitbucket.org/runeh/anyjson/"
__docformat__ = "restructuredtext"

# -eof meta-

#: The json implementation object. This is probably not useful to you,
#: except to get the name of the implementation in use. The name is
#: available through ``implementation.name``.
implementation = None

# json.loads does not support buffer() objects,
# so we load() and StringIO instead, and it won't copy.
if sys.version_info[0] == 3:
    from io import StringIO
else:
    try:
        from cStringIO import StringIO  # noqa
    except ImportError:
        from StringIO import StringIO   # noqa

#: List of known json modules, and the names of their loads/dumps
#: methods, as well as the exceptions they throw.  Exception can be either
#: an exception class or a string.
_modules = [("yajl", "dumps", TypeError, "loads", ValueError, "load"),
            ("jsonlib2", "write", "WriteError", "read", "ReadError", None),
            ("jsonlib", "write", "WriteError", "read", "ReadError", None),
            ("simplejson", "dumps", TypeError, "loads", ValueError, "load"),
            ("json", "dumps", TypeError, "loads", ValueError, "load"),
            ("django.utils.simplejson", "dumps", TypeError, "loads", ValueError, "load"),
            ("cjson", "encode", "EncodeError", "decode", "DecodeError", None)
           ]

_fields = ("modname", "encoder", "encerror",
           "decoder", "decerror", "filedecoder")


class _JsonImplementation(object):
    """Incapsulates a JSON implementation"""

    def __init__(self, modspec):
        modinfo = dict(zip(_fields, modspec))

        if modinfo["modname"] == "cjson":
            import warnings
            warnings.warn("cjson is deprecated! See http://pypi.python.org/pypi/python-cjson/1.0.5", DeprecationWarning)

        # No try block. We want importerror to end up at caller
        module = self._attempt_load(modinfo["modname"])

        self.implementation = modinfo["modname"]
        self._encode = getattr(module, modinfo["encoder"])
        self._decode = getattr(module, modinfo["decoder"])
        fdec = modinfo["filedecoder"]
        self._filedecode = fdec and getattr(module, fdec)
        self._encode_error = modinfo["encerror"]
        self._decode_error = modinfo["decerror"]

        if isinstance(modinfo["encerror"], basestring):
            self._encode_error = getattr(module, modinfo["encerror"])
        if isinstance(modinfo["decerror"], basestring):
            self._decode_error = getattr(module, modinfo["decerror"])

        self.name = modinfo["modname"]

    def __repr__(self):
        return "<_JsonImplementation instance using %s>" % self.name

    def _attempt_load(self, modname):
        """Attempt to load module name modname, returning it on success,
        throwing ImportError if module couldn't be imported"""
        __import__(modname)
        return sys.modules[modname]

    def dumps(self, data):
        """Serialize the datastructure to json. Returns a string. Raises
        TypeError if the object could not be serialized."""
        try:
            return self._encode(data)
        except self._encode_error, exc:
            raise TypeError, TypeError(*exc.args), sys.exc_info()[2]
    serialize = dumps

    def loads(self, s):
        """deserialize the string to python data types. Raises
        ValueError if the string could not be parsed."""
        # uses StringIO to support buffer objects.
        try:
            if self._filedecode and not isinstance(s, basestring):
                return self._filedecode(StringIO(s))
            return self._decode(s)
        except self._decode_error, exc:
            raise ValueError, ValueError(*exc.args), sys.exc_info()[2]
    deserialize = loads


def force_implementation(modname):
    """Forces anyjson to use a specific json module if it's available"""
    global implementation
    for name, spec in [(e[0], e) for e in _modules]:
        if name == modname:
            implementation = _JsonImplementation(spec)
            return
    raise ImportError("No module named: %s" % modname)


if __name__ == "__main__":
    # If run as a script, we do nothing but print an error message.
    # We do NOT try to load a compatible module because that may throw an
    # exception, which renders the package uninstallable with easy_install
    # (It trys to execfile the script when installing, to make sure it works)
    print "Running anyjson as a stand alone script is not supported"
    sys.exit(1)
else:
    for modspec in _modules:
        try:
            implementation = _JsonImplementation(modspec)
            break
        except ImportError:
            pass
    else:
        raise ImportError("No supported JSON module found")


    def loads(value):
        """Serialize the object to JSON."""
        return implementation.loads(value)
    deserialize = loads   # compat


    def dumps(value):
        """Deserialize JSON-encoded object to a Python object."""
        return implementation.dumps(value)
    serialize = dumps
