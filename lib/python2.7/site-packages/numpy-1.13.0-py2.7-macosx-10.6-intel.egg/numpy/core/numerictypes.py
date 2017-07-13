"""
numerictypes: Define the numeric type objects

This module is designed so "from numerictypes import \\*" is safe.
Exported symbols include:

  Dictionary with all registered number types (including aliases):
    typeDict

  Type objects (not all will be available, depends on platform):
      see variable sctypes for which ones you have

    Bit-width names

    int8 int16 int32 int64 int128
    uint8 uint16 uint32 uint64 uint128
    float16 float32 float64 float96 float128 float256
    complex32 complex64 complex128 complex192 complex256 complex512
    datetime64 timedelta64

    c-based names

    bool_

    object_

    void, str_, unicode_

    byte, ubyte,
    short, ushort
    intc, uintc,
    intp, uintp,
    int_, uint,
    longlong, ulonglong,

    single, csingle,
    float_, complex_,
    longfloat, clongfloat,

   As part of the type-hierarchy:    xx -- is bit-width

   generic
     +-> bool_                                  (kind=b)
     +-> number                                 (kind=i)
     |     integer
     |     signedinteger   (intxx)
     |     byte
     |     short
     |     intc
     |     intp           int0
     |     int_
     |     longlong
     +-> unsignedinteger  (uintxx)              (kind=u)
     |     ubyte
     |     ushort
     |     uintc
     |     uintp          uint0
     |     uint_
     |     ulonglong
     +-> inexact
     |   +-> floating           (floatxx)       (kind=f)
     |   |     half
     |   |     single
     |   |     float_  (double)
     |   |     longfloat
     |   \\-> complexfloating    (complexxx)     (kind=c)
     |         csingle  (singlecomplex)
     |         complex_ (cfloat, cdouble)
     |         clongfloat (longcomplex)
     +-> flexible
     |     character
     |     void                                 (kind=V)
     |
     |     str_     (string_, bytes_)           (kind=S)    [Python 2]
     |     unicode_                             (kind=U)    [Python 2]
     |
     |     bytes_   (string_)                   (kind=S)    [Python 3]
     |     str_     (unicode_)                  (kind=U)    [Python 3]
     |
     \\-> object_ (not used much)                (kind=O)

"""
from __future__ import division, absolute_import, print_function

import types as _types
import sys
import numbers

from numpy.compat import bytes, long
from numpy.core.multiarray import (
        typeinfo, ndarray, array, empty, dtype, datetime_data,
        datetime_as_string, busday_offset, busday_count, is_busday,
        busdaycalendar
        )


# we add more at the bottom
__all__ = ['sctypeDict', 'sctypeNA', 'typeDict', 'typeNA', 'sctypes',
           'ScalarType', 'obj2sctype', 'cast', 'nbytes', 'sctype2char',
           'maximum_sctype', 'issctype', 'typecodes', 'find_common_type',
           'issubdtype', 'datetime_data', 'datetime_as_string',
           'busday_offset', 'busday_count', 'is_busday', 'busdaycalendar',
           ]


# we don't export these for import *, but we do want them accessible
# as numerictypes.bool, etc.
if sys.version_info[0] >= 3:
    from builtins import bool, int, float, complex, object, str
    unicode = str
else:
    from __builtin__ import bool, int, float, complex, object, unicode, str


# String-handling utilities to avoid locale-dependence.

# "import string" is costly to import!
# Construct the translation tables directly
#   "A" = chr(65), "a" = chr(97)
_all_chars = [chr(_m) for _m in range(256)]
_ascii_upper = _all_chars[65:65+26]
_ascii_lower = _all_chars[97:97+26]
LOWER_TABLE = "".join(_all_chars[:65] + _ascii_lower + _all_chars[65+26:])
UPPER_TABLE = "".join(_all_chars[:97] + _ascii_upper + _all_chars[97+26:])


def english_lower(s):
    """ Apply English case rules to convert ASCII strings to all lower case.

    This is an internal utility function to replace calls to str.lower() such
    that we can avoid changing behavior with changing locales. In particular,
    Turkish has distinct dotted and dotless variants of the Latin letter "I" in
    both lowercase and uppercase. Thus, "I".lower() != "i" in a "tr" locale.

    Parameters
    ----------
    s : str

    Returns
    -------
    lowered : str

    Examples
    --------
    >>> from numpy.core.numerictypes import english_lower
    >>> english_lower('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_')
    'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz0123456789_'
    >>> english_lower('')
    ''
    """
    lowered = s.translate(LOWER_TABLE)
    return lowered

def english_upper(s):
    """ Apply English case rules to convert ASCII strings to all upper case.

    This is an internal utility function to replace calls to str.upper() such
    that we can avoid changing behavior with changing locales. In particular,
    Turkish has distinct dotted and dotless variants of the Latin letter "I" in
    both lowercase and uppercase. Thus, "i".upper() != "I" in a "tr" locale.

    Parameters
    ----------
    s : str

    Returns
    -------
    uppered : str

    Examples
    --------
    >>> from numpy.core.numerictypes import english_upper
    >>> english_upper('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_')
    'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
    >>> english_upper('')
    ''
    """
    uppered = s.translate(UPPER_TABLE)
    return uppered

def english_capitalize(s):
    """ Apply English case rules to convert the first character of an ASCII
    string to upper case.

    This is an internal utility function to replace calls to str.capitalize()
    such that we can avoid changing behavior with changing locales.

    Parameters
    ----------
    s : str

    Returns
    -------
    capitalized : str

    Examples
    --------
    >>> from numpy.core.numerictypes import english_capitalize
    >>> english_capitalize('int8')
    'Int8'
    >>> english_capitalize('Int8')
    'Int8'
    >>> english_capitalize('')
    ''
    """
    if s:
        return english_upper(s[0]) + s[1:]
    else:
        return s


sctypeDict = {}      # Contains all leaf-node scalar types with aliases
sctypeNA = {}        # Contails all leaf-node types -> numarray type equivalences
allTypes = {}      # Collect the types we will add to the module here

def _evalname(name):
    k = 0
    for ch in name:
        if ch in '0123456789':
            break
        k += 1
    try:
        bits = int(name[k:])
    except ValueError:
        bits = 0
    base = name[:k]
    return base, bits

def bitname(obj):
    """Return a bit-width name for a given type object"""
    name = obj.__name__
    base = ''
    char = ''
    try:
        if name[-1] == '_':
            newname = name[:-1]
        else:
            newname = name
        info = typeinfo[english_upper(newname)]
        assert(info[-1] == obj)  # sanity check
        bits = info[2]

    except KeyError:     # bit-width name
        base, bits = _evalname(name)
        char = base[0]

    if name == 'bool_':
        char = 'b'
        base = 'bool'
    elif name == 'void':
        char = 'V'
        base = 'void'
    elif name == 'object_':
        char = 'O'
        base = 'object'
        bits = 0
    elif name == 'datetime64':
        char = 'M'
    elif name == 'timedelta64':
        char = 'm'

    if sys.version_info[0] >= 3:
        if name == 'bytes_':
            char = 'S'
            base = 'bytes'
        elif name == 'str_':
            char = 'U'
            base = 'str'
    else:
        if name == 'string_':
            char = 'S'
            base = 'string'
        elif name == 'unicode_':
            char = 'U'
            base = 'unicode'

    bytes = bits // 8

    if char != '' and bytes != 0:
        char = "%s%d" % (char, bytes)

    return base, bits, char


def _add_types():
    for a in typeinfo.keys():
        name = english_lower(a)
        if isinstance(typeinfo[a], tuple):
            typeobj = typeinfo[a][-1]

            # define C-name and insert typenum and typechar references also
            allTypes[name] = typeobj
            sctypeDict[name] = typeobj
            sctypeDict[typeinfo[a][0]] = typeobj
            sctypeDict[typeinfo[a][1]] = typeobj

        else:  # generic class
            allTypes[name] = typeinfo[a]
_add_types()

def _add_aliases():
    for a in typeinfo.keys():
        name = english_lower(a)
        if not isinstance(typeinfo[a], tuple):
            continue
        typeobj = typeinfo[a][-1]
        # insert bit-width version for this class (if relevant)
        base, bit, char = bitname(typeobj)
        if base[-3:] == 'int' or char[0] in 'ui':
            continue
        if base != '':
            myname = "%s%d" % (base, bit)
            if ((name != 'longdouble' and name != 'clongdouble') or
                   myname not in allTypes.keys()):
                allTypes[myname] = typeobj
                sctypeDict[myname] = typeobj
                if base == 'complex':
                    na_name = '%s%d' % (english_capitalize(base), bit//2)
                elif base == 'bool':
                    na_name = english_capitalize(base)
                    sctypeDict[na_name] = typeobj
                else:
                    na_name = "%s%d" % (english_capitalize(base), bit)
                    sctypeDict[na_name] = typeobj
                sctypeNA[na_name] = typeobj
                sctypeDict[na_name] = typeobj
                sctypeNA[typeobj] = na_name
                sctypeNA[typeinfo[a][0]] = na_name
        if char != '':
            sctypeDict[char] = typeobj
            sctypeNA[char] = na_name
_add_aliases()

# Integers are handled so that the int32 and int64 types should agree
# exactly with NPY_INT32, NPY_INT64. We need to enforce the same checking
# as is done in arrayobject.h where the order of getting a bit-width match
# is long, longlong, int, short, char.
def _add_integer_aliases():
    _ctypes = ['LONG', 'LONGLONG', 'INT', 'SHORT', 'BYTE']
    for ctype in _ctypes:
        val = typeinfo[ctype]
        bits = val[2]
        charname = 'i%d' % (bits//8,)
        ucharname = 'u%d' % (bits//8,)
        intname = 'int%d' % bits
        UIntname = 'UInt%d' % bits
        Intname = 'Int%d' % bits
        uval = typeinfo['U'+ctype]
        typeobj = val[-1]
        utypeobj = uval[-1]
        if intname not in allTypes.keys():
            uintname = 'uint%d' % bits
            allTypes[intname] = typeobj
            allTypes[uintname] = utypeobj
            sctypeDict[intname] = typeobj
            sctypeDict[uintname] = utypeobj
            sctypeDict[Intname] = typeobj
            sctypeDict[UIntname] = utypeobj
            sctypeDict[charname] = typeobj
            sctypeDict[ucharname] = utypeobj
            sctypeNA[Intname] = typeobj
            sctypeNA[UIntname] = utypeobj
            sctypeNA[charname] = typeobj
            sctypeNA[ucharname] = utypeobj
        sctypeNA[typeobj] = Intname
        sctypeNA[utypeobj] = UIntname
        sctypeNA[val[0]] = Intname
        sctypeNA[uval[0]] = UIntname
_add_integer_aliases()

# We use these later
void = allTypes['void']
generic = allTypes['generic']

#
# Rework the Python names (so that float and complex and int are consistent
#                            with Python usage)
#
def _set_up_aliases():
    type_pairs = [('complex_', 'cdouble'),
                  ('int0', 'intp'),
                  ('uint0', 'uintp'),
                  ('single', 'float'),
                  ('csingle', 'cfloat'),
                  ('singlecomplex', 'cfloat'),
                  ('float_', 'double'),
                  ('intc', 'int'),
                  ('uintc', 'uint'),
                  ('int_', 'long'),
                  ('uint', 'ulong'),
                  ('cfloat', 'cdouble'),
                  ('longfloat', 'longdouble'),
                  ('clongfloat', 'clongdouble'),
                  ('longcomplex', 'clongdouble'),
                  ('bool_', 'bool'),
                  ('unicode_', 'unicode'),
                  ('object_', 'object')]
    if sys.version_info[0] >= 3:
        type_pairs.extend([('bytes_', 'string'),
                           ('str_', 'unicode'),
                           ('string_', 'string')])
    else:
        type_pairs.extend([('str_', 'string'),
                           ('string_', 'string'),
                           ('bytes_', 'string')])
    for alias, t in type_pairs:
        allTypes[alias] = allTypes[t]
        sctypeDict[alias] = sctypeDict[t]
    # Remove aliases overriding python types and modules
    to_remove = ['ulong', 'object', 'unicode', 'int', 'long', 'float',
                 'complex', 'bool', 'string', 'datetime', 'timedelta']
    if sys.version_info[0] >= 3:
        # Py3K
        to_remove.append('bytes')
        to_remove.append('str')
        to_remove.remove('unicode')
        to_remove.remove('long')
    for t in to_remove:
        try:
            del allTypes[t]
            del sctypeDict[t]
        except KeyError:
            pass
_set_up_aliases()

# Now, construct dictionary to lookup character codes from types
_sctype2char_dict = {}
def _construct_char_code_lookup():
    for name in typeinfo.keys():
        tup = typeinfo[name]
        if isinstance(tup, tuple):
            if tup[0] not in ['p', 'P']:
                _sctype2char_dict[tup[-1]] = tup[0]
_construct_char_code_lookup()


sctypes = {'int': [],
           'uint':[],
           'float':[],
           'complex':[],
           'others':[bool, object, bytes, unicode, void]}

def _add_array_type(typename, bits):
    try:
        t = allTypes['%s%d' % (typename, bits)]
    except KeyError:
        pass
    else:
        sctypes[typename].append(t)

def _set_array_types():
    ibytes = [1, 2, 4, 8, 16, 32, 64]
    fbytes = [2, 4, 8, 10, 12, 16, 32, 64]
    for bytes in ibytes:
        bits = 8*bytes
        _add_array_type('int', bits)
        _add_array_type('uint', bits)
    for bytes in fbytes:
        bits = 8*bytes
        _add_array_type('float', bits)
        _add_array_type('complex', 2*bits)
    _gi = dtype('p')
    if _gi.type not in sctypes['int']:
        indx = 0
        sz = _gi.itemsize
        _lst = sctypes['int']
        while (indx < len(_lst) and sz >= _lst[indx](0).itemsize):
            indx += 1
        sctypes['int'].insert(indx, _gi.type)
        sctypes['uint'].insert(indx, dtype('P').type)
_set_array_types()


genericTypeRank = ['bool', 'int8', 'uint8', 'int16', 'uint16',
                   'int32', 'uint32', 'int64', 'uint64', 'int128',
                   'uint128', 'float16',
                   'float32', 'float64', 'float80', 'float96', 'float128',
                   'float256',
                   'complex32', 'complex64', 'complex128', 'complex160',
                   'complex192', 'complex256', 'complex512', 'object']

def maximum_sctype(t):
    """
    Return the scalar type of highest precision of the same kind as the input.

    Parameters
    ----------
    t : dtype or dtype specifier
        The input data type. This can be a `dtype` object or an object that
        is convertible to a `dtype`.

    Returns
    -------
    out : dtype
        The highest precision data type of the same kind (`dtype.kind`) as `t`.

    See Also
    --------
    obj2sctype, mintypecode, sctype2char
    dtype

    Examples
    --------
    >>> np.maximum_sctype(np.int)
    <type 'numpy.int64'>
    >>> np.maximum_sctype(np.uint8)
    <type 'numpy.uint64'>
    >>> np.maximum_sctype(np.complex)
    <type 'numpy.complex192'>

    >>> np.maximum_sctype(str)
    <type 'numpy.string_'>

    >>> np.maximum_sctype('i2')
    <type 'numpy.int64'>
    >>> np.maximum_sctype('f4')
    <type 'numpy.float96'>

    """
    g = obj2sctype(t)
    if g is None:
        return t
    t = g
    name = t.__name__
    base, bits = _evalname(name)
    if bits == 0:
        return t
    else:
        return sctypes[base][-1]

try:
    buffer_type = _types.BufferType
except AttributeError:
    # Py3K
    buffer_type = memoryview

_python_types = {int: 'int_',
                 float: 'float_',
                 complex: 'complex_',
                 bool: 'bool_',
                 bytes: 'bytes_',
                 unicode: 'unicode_',
                 buffer_type: 'void',
                 }

if sys.version_info[0] >= 3:
    def _python_type(t):
        """returns the type corresponding to a certain Python type"""
        if not isinstance(t, type):
            t = type(t)
        return allTypes[_python_types.get(t, 'object_')]
else:
    def _python_type(t):
        """returns the type corresponding to a certain Python type"""
        if not isinstance(t, _types.TypeType):
            t = type(t)
        return allTypes[_python_types.get(t, 'object_')]

def issctype(rep):
    """
    Determines whether the given object represents a scalar data-type.

    Parameters
    ----------
    rep : any
        If `rep` is an instance of a scalar dtype, True is returned. If not,
        False is returned.

    Returns
    -------
    out : bool
        Boolean result of check whether `rep` is a scalar dtype.

    See Also
    --------
    issubsctype, issubdtype, obj2sctype, sctype2char

    Examples
    --------
    >>> np.issctype(np.int32)
    True
    >>> np.issctype(list)
    False
    >>> np.issctype(1.1)
    False

    Strings are also a scalar type:

    >>> np.issctype(np.dtype('str'))
    True

    """
    if not isinstance(rep, (type, dtype)):
        return False
    try:
        res = obj2sctype(rep)
        if res and res != object_:
            return True
        return False
    except:
        return False

def obj2sctype(rep, default=None):
    """
    Return the scalar dtype or NumPy equivalent of Python type of an object.

    Parameters
    ----------
    rep : any
        The object of which the type is returned.
    default : any, optional
        If given, this is returned for objects whose types can not be
        determined. If not given, None is returned for those objects.

    Returns
    -------
    dtype : dtype or Python type
        The data type of `rep`.

    See Also
    --------
    sctype2char, issctype, issubsctype, issubdtype, maximum_sctype

    Examples
    --------
    >>> np.obj2sctype(np.int32)
    <type 'numpy.int32'>
    >>> np.obj2sctype(np.array([1., 2.]))
    <type 'numpy.float64'>
    >>> np.obj2sctype(np.array([1.j]))
    <type 'numpy.complex128'>

    >>> np.obj2sctype(dict)
    <type 'numpy.object_'>
    >>> np.obj2sctype('string')
    <type 'numpy.string_'>

    >>> np.obj2sctype(1, default=list)
    <type 'list'>

    """
    try:
        if issubclass(rep, generic):
            return rep
    except TypeError:
        pass
    if isinstance(rep, dtype):
        return rep.type
    if isinstance(rep, type):
        return _python_type(rep)
    if isinstance(rep, ndarray):
        return rep.dtype.type
    try:
        res = dtype(rep)
    except:
        return default
    return res.type


def issubclass_(arg1, arg2):
    """
    Determine if a class is a subclass of a second class.

    `issubclass_` is equivalent to the Python built-in ``issubclass``,
    except that it returns False instead of raising a TypeError if one
    of the arguments is not a class.

    Parameters
    ----------
    arg1 : class
        Input class. True is returned if `arg1` is a subclass of `arg2`.
    arg2 : class or tuple of classes.
        Input class. If a tuple of classes, True is returned if `arg1` is a
        subclass of any of the tuple elements.

    Returns
    -------
    out : bool
        Whether `arg1` is a subclass of `arg2` or not.

    See Also
    --------
    issubsctype, issubdtype, issctype

    Examples
    --------
    >>> np.issubclass_(np.int32, np.int)
    True
    >>> np.issubclass_(np.int32, np.float)
    False

    """
    try:
        return issubclass(arg1, arg2)
    except TypeError:
        return False

def issubsctype(arg1, arg2):
    """
    Determine if the first argument is a subclass of the second argument.

    Parameters
    ----------
    arg1, arg2 : dtype or dtype specifier
        Data-types.

    Returns
    -------
    out : bool
        The result.

    See Also
    --------
    issctype, issubdtype,obj2sctype

    Examples
    --------
    >>> np.issubsctype('S8', str)
    True
    >>> np.issubsctype(np.array([1]), np.int)
    True
    >>> np.issubsctype(np.array([1]), np.float)
    False

    """
    return issubclass(obj2sctype(arg1), obj2sctype(arg2))

def issubdtype(arg1, arg2):
    """
    Returns True if first argument is a typecode lower/equal in type hierarchy.

    Parameters
    ----------
    arg1, arg2 : dtype_like
        dtype or string representing a typecode.

    Returns
    -------
    out : bool

    See Also
    --------
    issubsctype, issubclass_
    numpy.core.numerictypes : Overview of numpy type hierarchy.

    Examples
    --------
    >>> np.issubdtype('S1', str)
    True
    >>> np.issubdtype(np.float64, np.float32)
    False

    """
    if issubclass_(arg2, generic):
        return issubclass(dtype(arg1).type, arg2)
    mro = dtype(arg2).type.mro()
    if len(mro) > 1:
        val = mro[1]
    else:
        val = mro[0]
    return issubclass(dtype(arg1).type, val)


# This dictionary allows look up based on any alias for an array data-type
class _typedict(dict):
    """
    Base object for a dictionary for look-up with any alias for an array dtype.

    Instances of `_typedict` can not be used as dictionaries directly,
    first they have to be populated.

    """

    def __getitem__(self, obj):
        return dict.__getitem__(self, obj2sctype(obj))

nbytes = _typedict()
_alignment = _typedict()
_maxvals = _typedict()
_minvals = _typedict()
def _construct_lookups():
    for name, val in typeinfo.items():
        if not isinstance(val, tuple):
            continue
        obj = val[-1]
        nbytes[obj] = val[2] // 8
        _alignment[obj] = val[3]
        if (len(val) > 5):
            _maxvals[obj] = val[4]
            _minvals[obj] = val[5]
        else:
            _maxvals[obj] = None
            _minvals[obj] = None

_construct_lookups()

def sctype2char(sctype):
    """
    Return the string representation of a scalar dtype.

    Parameters
    ----------
    sctype : scalar dtype or object
        If a scalar dtype, the corresponding string character is
        returned. If an object, `sctype2char` tries to infer its scalar type
        and then return the corresponding string character.

    Returns
    -------
    typechar : str
        The string character corresponding to the scalar type.

    Raises
    ------
    ValueError
        If `sctype` is an object for which the type can not be inferred.

    See Also
    --------
    obj2sctype, issctype, issubsctype, mintypecode

    Examples
    --------
    >>> for sctype in [np.int32, np.float, np.complex, np.string_, np.ndarray]:
    ...     print(np.sctype2char(sctype))
    l
    d
    D
    S
    O

    >>> x = np.array([1., 2-1.j])
    >>> np.sctype2char(x)
    'D'
    >>> np.sctype2char(list)
    'O'

    """
    sctype = obj2sctype(sctype)
    if sctype is None:
        raise ValueError("unrecognized type")
    return _sctype2char_dict[sctype]

# Create dictionary of casting functions that wrap sequences
# indexed by type or type character


cast = _typedict()
try:
    ScalarType = [_types.IntType, _types.FloatType, _types.ComplexType,
                  _types.LongType, _types.BooleanType,
                   _types.StringType, _types.UnicodeType, _types.BufferType]
except AttributeError:
    # Py3K
    ScalarType = [int, float, complex, int, bool, bytes, str, memoryview]

ScalarType.extend(_sctype2char_dict.keys())
ScalarType = tuple(ScalarType)
for key in _sctype2char_dict.keys():
    cast[key] = lambda x, k=key: array(x, copy=False).astype(k)

# Create the typestring lookup dictionary
_typestr = _typedict()
for key in _sctype2char_dict.keys():
    if issubclass(key, allTypes['flexible']):
        _typestr[key] = _sctype2char_dict[key]
    else:
        _typestr[key] = empty((1,), key).dtype.str[1:]

# Make sure all typestrings are in sctypeDict
for key, val in _typestr.items():
    if val not in sctypeDict:
        sctypeDict[val] = key

# Add additional strings to the sctypeDict

if sys.version_info[0] >= 3:
    _toadd = ['int', 'float', 'complex', 'bool', 'object',
              'str', 'bytes', 'object', ('a', allTypes['bytes_'])]
else:
    _toadd = ['int', 'float', 'complex', 'bool', 'object', 'string',
              ('str', allTypes['string_']),
              'unicode', 'object', ('a', allTypes['string_'])]

for name in _toadd:
    if isinstance(name, tuple):
        sctypeDict[name[0]] = name[1]
    else:
        sctypeDict[name] = allTypes['%s_' % name]

del _toadd, name

# Now add the types we've determined to this module
for key in allTypes:
    globals()[key] = allTypes[key]
    __all__.append(key)

del key

typecodes = {'Character':'c',
             'Integer':'bhilqp',
             'UnsignedInteger':'BHILQP',
             'Float':'efdg',
             'Complex':'FDG',
             'AllInteger':'bBhHiIlLqQpP',
             'AllFloat':'efdgFDG',
             'Datetime': 'Mm',
             'All':'?bhilqpBHILQPefdgFDGSUVOMm'}

# backwards compatibility --- deprecated name
typeDict = sctypeDict
typeNA = sctypeNA

# b -> boolean
# u -> unsigned integer
# i -> signed integer
# f -> floating point
# c -> complex
# M -> datetime
# m -> timedelta
# S -> string
# U -> Unicode string
# V -> record
# O -> Python object
_kind_list = ['b', 'u', 'i', 'f', 'c', 'S', 'U', 'V', 'O', 'M', 'm']

__test_types = '?'+typecodes['AllInteger'][:-2]+typecodes['AllFloat']+'O'
__len_test_types = len(__test_types)

# Keep incrementing until a common type both can be coerced to
#  is found.  Otherwise, return None
def _find_common_coerce(a, b):
    if a > b:
        return a
    try:
        thisind = __test_types.index(a.char)
    except ValueError:
        return None
    return _can_coerce_all([a, b], start=thisind)

# Find a data-type that all data-types in a list can be coerced to
def _can_coerce_all(dtypelist, start=0):
    N = len(dtypelist)
    if N == 0:
        return None
    if N == 1:
        return dtypelist[0]
    thisind = start
    while thisind < __len_test_types:
        newdtype = dtype(__test_types[thisind])
        numcoerce = len([x for x in dtypelist if newdtype >= x])
        if numcoerce == N:
            return newdtype
        thisind += 1
    return None

def _register_types():
    numbers.Integral.register(integer)
    numbers.Complex.register(inexact)
    numbers.Real.register(floating)

_register_types()

def find_common_type(array_types, scalar_types):
    """
    Determine common type following standard coercion rules.

    Parameters
    ----------
    array_types : sequence
        A list of dtypes or dtype convertible objects representing arrays.
    scalar_types : sequence
        A list of dtypes or dtype convertible objects representing scalars.

    Returns
    -------
    datatype : dtype
        The common data type, which is the maximum of `array_types` ignoring
        `scalar_types`, unless the maximum of `scalar_types` is of a
        different kind (`dtype.kind`). If the kind is not understood, then
        None is returned.

    See Also
    --------
    dtype, common_type, can_cast, mintypecode

    Examples
    --------
    >>> np.find_common_type([], [np.int64, np.float32, np.complex])
    dtype('complex128')
    >>> np.find_common_type([np.int64, np.float32], [])
    dtype('float64')

    The standard casting rules ensure that a scalar cannot up-cast an
    array unless the scalar is of a fundamentally different kind of data
    (i.e. under a different hierarchy in the data type hierarchy) then
    the array:

    >>> np.find_common_type([np.float32], [np.int64, np.float64])
    dtype('float32')

    Complex is of a different type, so it up-casts the float in the
    `array_types` argument:

    >>> np.find_common_type([np.float32], [np.complex])
    dtype('complex128')

    Type specifier strings are convertible to dtypes and can therefore
    be used instead of dtypes:

    >>> np.find_common_type(['f4', 'f4', 'i4'], ['c8'])
    dtype('complex128')

    """
    array_types = [dtype(x) for x in array_types]
    scalar_types = [dtype(x) for x in scalar_types]

    maxa = _can_coerce_all(array_types)
    maxsc = _can_coerce_all(scalar_types)

    if maxa is None:
        return maxsc

    if maxsc is None:
        return maxa

    try:
        index_a = _kind_list.index(maxa.kind)
        index_sc = _kind_list.index(maxsc.kind)
    except ValueError:
        return None

    if index_sc > index_a:
        return _find_common_coerce(maxsc, maxa)
    else:
        return maxa
