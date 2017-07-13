"""
============================
``ctypes`` Utility Functions
============================

See Also
---------
load_library : Load a C library.
ndpointer : Array restype/argtype with verification.
as_ctypes : Create a ctypes array from an ndarray.
as_array : Create an ndarray from a ctypes array.

References
----------
.. [1] "SciPy Cookbook: ctypes", http://www.scipy.org/Cookbook/Ctypes

Examples
--------
Load the C library:

>>> _lib = np.ctypeslib.load_library('libmystuff', '.')     #doctest: +SKIP

Our result type, an ndarray that must be of type double, be 1-dimensional
and is C-contiguous in memory:

>>> array_1d_double = np.ctypeslib.ndpointer(
...                          dtype=np.double,
...                          ndim=1, flags='CONTIGUOUS')    #doctest: +SKIP

Our C-function typically takes an array and updates its values
in-place.  For example::

    void foo_func(double* x, int length)
    {
        int i;
        for (i = 0; i < length; i++) {
            x[i] = i*i;
        }
    }

We wrap it using:

>>> _lib.foo_func.restype = None                      #doctest: +SKIP
>>> _lib.foo_func.argtypes = [array_1d_double, c_int] #doctest: +SKIP

Then, we're ready to call ``foo_func``:

>>> out = np.empty(15, dtype=np.double)
>>> _lib.foo_func(out, len(out))                #doctest: +SKIP

"""
from __future__ import division, absolute_import, print_function

__all__ = ['load_library', 'ndpointer', 'test', 'ctypes_load_library',
           'c_intp', 'as_ctypes', 'as_array']

import sys, os
from numpy import integer, ndarray, dtype as _dtype, deprecate, array
from numpy.core.multiarray import _flagdict, flagsobj

try:
    import ctypes
except ImportError:
    ctypes = None

if ctypes is None:
    def _dummy(*args, **kwds):
        """
        Dummy object that raises an ImportError if ctypes is not available.

        Raises
        ------
        ImportError
            If ctypes is not available.

        """
        raise ImportError("ctypes is not available.")
    ctypes_load_library = _dummy
    load_library = _dummy
    as_ctypes = _dummy
    as_array = _dummy
    from numpy import intp as c_intp
    _ndptr_base = object
else:
    import numpy.core._internal as nic
    c_intp = nic._getintp_ctype()
    del nic
    _ndptr_base = ctypes.c_void_p

    # Adapted from Albert Strasheim
    def load_library(libname, loader_path):
        """
        It is possible to load a library using 
        >>> lib = ctypes.cdll[<full_path_name>]

        But there are cross-platform considerations, such as library file extensions,
        plus the fact Windows will just load the first library it finds with that name.  
        NumPy supplies the load_library function as a convenience.

        Parameters
        ----------
        libname : str
            Name of the library, which can have 'lib' as a prefix,
            but without an extension.
        loader_path : str
            Where the library can be found.

        Returns
        -------
        ctypes.cdll[libpath] : library object
           A ctypes library object 

        Raises
        ------
        OSError
            If there is no library with the expected extension, or the 
            library is defective and cannot be loaded.
        """
        if ctypes.__version__ < '1.0.1':
            import warnings
            warnings.warn("All features of ctypes interface may not work " \
                          "with ctypes < 1.0.1", stacklevel=2)

        ext = os.path.splitext(libname)[1]
        if not ext:
            # Try to load library with platform-specific name, otherwise
            # default to libname.[so|pyd].  Sometimes, these files are built
            # erroneously on non-linux platforms.
            from numpy.distutils.misc_util import get_shared_lib_extension
            so_ext = get_shared_lib_extension()
            libname_ext = [libname + so_ext]
            # mac, windows and linux >= py3.2 shared library and loadable
            # module have different extensions so try both
            so_ext2 = get_shared_lib_extension(is_python_ext=True)
            if not so_ext2 == so_ext:
                libname_ext.insert(0, libname + so_ext2)
        else:
            libname_ext = [libname]

        loader_path = os.path.abspath(loader_path)
        if not os.path.isdir(loader_path):
            libdir = os.path.dirname(loader_path)
        else:
            libdir = loader_path

        for ln in libname_ext:
            libpath = os.path.join(libdir, ln)
            if os.path.exists(libpath):
                try:
                    return ctypes.cdll[libpath]
                except OSError:
                    ## defective lib file
                    raise
        ## if no successful return in the libname_ext loop:
        raise OSError("no file with expected extension")

    ctypes_load_library = deprecate(load_library, 'ctypes_load_library',
                                    'load_library')

def _num_fromflags(flaglist):
    num = 0
    for val in flaglist:
        num += _flagdict[val]
    return num

_flagnames = ['C_CONTIGUOUS', 'F_CONTIGUOUS', 'ALIGNED', 'WRITEABLE',
              'OWNDATA', 'UPDATEIFCOPY']
def _flags_fromnum(num):
    res = []
    for key in _flagnames:
        value = _flagdict[key]
        if (num & value):
            res.append(key)
    return res


class _ndptr(_ndptr_base):

    def _check_retval_(self):
        """This method is called when this class is used as the .restype
        attribute for a shared-library function.   It constructs a numpy
        array from a void pointer."""
        return array(self)

    @property
    def __array_interface__(self):
        return {'descr': self._dtype_.descr,
                '__ref': self,
                'strides': None,
                'shape': self._shape_,
                'version': 3,
                'typestr': self._dtype_.descr[0][1],
                'data': (self.value, False),
                }

    @classmethod
    def from_param(cls, obj):
        if not isinstance(obj, ndarray):
            raise TypeError("argument must be an ndarray")
        if cls._dtype_ is not None \
               and obj.dtype != cls._dtype_:
            raise TypeError("array must have data type %s" % cls._dtype_)
        if cls._ndim_ is not None \
               and obj.ndim != cls._ndim_:
            raise TypeError("array must have %d dimension(s)" % cls._ndim_)
        if cls._shape_ is not None \
               and obj.shape != cls._shape_:
            raise TypeError("array must have shape %s" % str(cls._shape_))
        if cls._flags_ is not None \
               and ((obj.flags.num & cls._flags_) != cls._flags_):
            raise TypeError("array must have flags %s" %
                    _flags_fromnum(cls._flags_))
        return obj.ctypes


# Factory for an array-checking class with from_param defined for
#  use with ctypes argtypes mechanism
_pointer_type_cache = {}
def ndpointer(dtype=None, ndim=None, shape=None, flags=None):
    """
    Array-checking restype/argtypes.

    An ndpointer instance is used to describe an ndarray in restypes
    and argtypes specifications.  This approach is more flexible than
    using, for example, ``POINTER(c_double)``, since several restrictions
    can be specified, which are verified upon calling the ctypes function.
    These include data type, number of dimensions, shape and flags.  If a
    given array does not satisfy the specified restrictions,
    a ``TypeError`` is raised.

    Parameters
    ----------
    dtype : data-type, optional
        Array data-type.
    ndim : int, optional
        Number of array dimensions.
    shape : tuple of ints, optional
        Array shape.
    flags : str or tuple of str
        Array flags; may be one or more of:

          - C_CONTIGUOUS / C / CONTIGUOUS
          - F_CONTIGUOUS / F / FORTRAN
          - OWNDATA / O
          - WRITEABLE / W
          - ALIGNED / A
          - UPDATEIFCOPY / U

    Returns
    -------
    klass : ndpointer type object
        A type object, which is an ``_ndtpr`` instance containing
        dtype, ndim, shape and flags information.

    Raises
    ------
    TypeError
        If a given array does not satisfy the specified restrictions.

    Examples
    --------
    >>> clib.somefunc.argtypes = [np.ctypeslib.ndpointer(dtype=np.float64,
    ...                                                  ndim=1,
    ...                                                  flags='C_CONTIGUOUS')]
    ... #doctest: +SKIP
    >>> clib.somefunc(np.array([1, 2, 3], dtype=np.float64))
    ... #doctest: +SKIP

    """

    if dtype is not None:
        dtype = _dtype(dtype)
    num = None
    if flags is not None:
        if isinstance(flags, str):
            flags = flags.split(',')
        elif isinstance(flags, (int, integer)):
            num = flags
            flags = _flags_fromnum(num)
        elif isinstance(flags, flagsobj):
            num = flags.num
            flags = _flags_fromnum(num)
        if num is None:
            try:
                flags = [x.strip().upper() for x in flags]
            except:
                raise TypeError("invalid flags specification")
            num = _num_fromflags(flags)
    try:
        return _pointer_type_cache[(dtype, ndim, shape, num)]
    except KeyError:
        pass
    if dtype is None:
        name = 'any'
    elif dtype.names:
        name = str(id(dtype))
    else:
        name = dtype.str
    if ndim is not None:
        name += "_%dd" % ndim
    if shape is not None:
        try:
            strshape = [str(x) for x in shape]
        except TypeError:
            strshape = [str(shape)]
            shape = (shape,)
        shape = tuple(shape)
        name += "_"+"x".join(strshape)
    if flags is not None:
        name += "_"+"_".join(flags)
    else:
        flags = []
    klass = type("ndpointer_%s"%name, (_ndptr,),
                 {"_dtype_": dtype,
                  "_shape_" : shape,
                  "_ndim_" : ndim,
                  "_flags_" : num})
    _pointer_type_cache[(dtype, shape, ndim, num)] = klass
    return klass

if ctypes is not None:
    ct = ctypes
    ################################################################
    # simple types

    # maps the numpy typecodes like '<f8' to simple ctypes types like
    # c_double. Filled in by prep_simple.
    _typecodes = {}

    def prep_simple(simple_type, dtype):
        """Given a ctypes simple type, construct and attach an
        __array_interface__ property to it if it does not yet have one.
        """
        try: simple_type.__array_interface__
        except AttributeError: pass
        else: return

        typestr = _dtype(dtype).str
        _typecodes[typestr] = simple_type

        def __array_interface__(self):
            return {'descr': [('', typestr)],
                    '__ref': self,
                    'strides': None,
                    'shape': (),
                    'version': 3,
                    'typestr': typestr,
                    'data': (ct.addressof(self), False),
                    }

        simple_type.__array_interface__ = property(__array_interface__)

    simple_types = [
        ((ct.c_byte, ct.c_short, ct.c_int, ct.c_long, ct.c_longlong), "i"),
        ((ct.c_ubyte, ct.c_ushort, ct.c_uint, ct.c_ulong, ct.c_ulonglong), "u"),
        ((ct.c_float, ct.c_double), "f"),
    ]

    # Prep that numerical ctypes types:
    for types, code in simple_types:
        for tp in types:
            prep_simple(tp, "%c%d" % (code, ct.sizeof(tp)))

    ################################################################
    # array types

    _ARRAY_TYPE = type(ct.c_int * 1)

    def prep_array(array_type):
        """Given a ctypes array type, construct and attach an
        __array_interface__ property to it if it does not yet have one.
        """
        try: array_type.__array_interface__
        except AttributeError: pass
        else: return

        shape = []
        ob = array_type
        while type(ob) is _ARRAY_TYPE:
            shape.append(ob._length_)
            ob = ob._type_
        shape = tuple(shape)
        ai = ob().__array_interface__
        descr = ai['descr']
        typestr = ai['typestr']

        def __array_interface__(self):
            return {'descr': descr,
                    '__ref': self,
                    'strides': None,
                    'shape': shape,
                    'version': 3,
                    'typestr': typestr,
                    'data': (ct.addressof(self), False),
                    }

        array_type.__array_interface__ = property(__array_interface__)

    def prep_pointer(pointer_obj, shape):
        """Given a ctypes pointer object, construct and
        attach an __array_interface__ property to it if it does not
        yet have one.
        """
        try: pointer_obj.__array_interface__
        except AttributeError: pass
        else: return

        contents = pointer_obj.contents
        dtype = _dtype(type(contents))

        inter = {'version': 3,
                 'typestr': dtype.str,
                 'data': (ct.addressof(contents), False),
                 'shape': shape}

        pointer_obj.__array_interface__ = inter

    ################################################################
    # public functions

    def as_array(obj, shape=None):
        """Create a numpy array from a ctypes array or a ctypes POINTER.
        The numpy array shares the memory with the ctypes object.

        The size parameter must be given if converting from a ctypes POINTER.
        The size parameter is ignored if converting from a ctypes array
        """
        tp = type(obj)
        try: tp.__array_interface__
        except AttributeError:
            if hasattr(obj, 'contents'):
                prep_pointer(obj, shape)
            else:
                prep_array(tp)
        return array(obj, copy=False)

    def as_ctypes(obj):
        """Create and return a ctypes object from a numpy array.  Actually
        anything that exposes the __array_interface__ is accepted."""
        ai = obj.__array_interface__
        if ai["strides"]:
            raise TypeError("strided arrays not supported")
        if ai["version"] != 3:
            raise TypeError("only __array_interface__ version 3 supported")
        addr, readonly = ai["data"]
        if readonly:
            raise TypeError("readonly arrays unsupported")
        tp = _typecodes[ai["typestr"]]
        for dim in ai["shape"][::-1]:
            tp = tp * dim
        result = tp.from_address(addr)
        result.__keep = ai
        return result
