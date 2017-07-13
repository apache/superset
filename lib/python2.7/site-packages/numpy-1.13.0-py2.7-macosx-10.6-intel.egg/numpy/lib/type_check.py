"""Automatically adapted for numpy Sep 19, 2005 by convertcode.py

"""
from __future__ import division, absolute_import, print_function

__all__ = ['iscomplexobj', 'isrealobj', 'imag', 'iscomplex',
           'isreal', 'nan_to_num', 'real', 'real_if_close',
           'typename', 'asfarray', 'mintypecode', 'asscalar',
           'common_type']

import numpy.core.numeric as _nx
from numpy.core.numeric import asarray, asanyarray, array, isnan, zeros
from .ufunclike import isneginf, isposinf

_typecodes_by_elsize = 'GDFgdfQqLlIiHhBb?'

def mintypecode(typechars,typeset='GDFgdf',default='d'):
    """
    Return the character for the minimum-size type to which given types can
    be safely cast.

    The returned type character must represent the smallest size dtype such
    that an array of the returned type can handle the data from an array of
    all types in `typechars` (or if `typechars` is an array, then its
    dtype.char).

    Parameters
    ----------
    typechars : list of str or array_like
        If a list of strings, each string should represent a dtype.
        If array_like, the character representation of the array dtype is used.
    typeset : str or list of str, optional
        The set of characters that the returned character is chosen from.
        The default set is 'GDFgdf'.
    default : str, optional
        The default character, this is returned if none of the characters in
        `typechars` matches a character in `typeset`.

    Returns
    -------
    typechar : str
        The character representing the minimum-size type that was found.

    See Also
    --------
    dtype, sctype2char, maximum_sctype

    Examples
    --------
    >>> np.mintypecode(['d', 'f', 'S'])
    'd'
    >>> x = np.array([1.1, 2-3.j])
    >>> np.mintypecode(x)
    'D'

    >>> np.mintypecode('abceh', default='G')
    'G'

    """
    typecodes = [(isinstance(t, str) and t) or asarray(t).dtype.char
                 for t in typechars]
    intersection = [t for t in typecodes if t in typeset]
    if not intersection:
        return default
    if 'F' in intersection and 'd' in intersection:
        return 'D'
    l = []
    for t in intersection:
        i = _typecodes_by_elsize.index(t)
        l.append((i, t))
    l.sort()
    return l[0][1]

def asfarray(a, dtype=_nx.float_):
    """
    Return an array converted to a float type.

    Parameters
    ----------
    a : array_like
        The input array.
    dtype : str or dtype object, optional
        Float type code to coerce input array `a`.  If `dtype` is one of the
        'int' dtypes, it is replaced with float64.

    Returns
    -------
    out : ndarray
        The input `a` as a float ndarray.

    Examples
    --------
    >>> np.asfarray([2, 3])
    array([ 2.,  3.])
    >>> np.asfarray([2, 3], dtype='float')
    array([ 2.,  3.])
    >>> np.asfarray([2, 3], dtype='int8')
    array([ 2.,  3.])

    """
    dtype = _nx.obj2sctype(dtype)
    if not issubclass(dtype, _nx.inexact):
        dtype = _nx.float_
    return asarray(a, dtype=dtype)


def real(val):
    """
    Return the real part of the complex argument.

    Parameters
    ----------
    val : array_like
        Input array.

    Returns
    -------
    out : ndarray or scalar
        The real component of the complex argument. If `val` is real, the type
        of `val` is used for the output.  If `val` has complex elements, the
        returned type is float.

    See Also
    --------
    real_if_close, imag, angle

    Examples
    --------
    >>> a = np.array([1+2j, 3+4j, 5+6j])
    >>> a.real
    array([ 1.,  3.,  5.])
    >>> a.real = 9
    >>> a
    array([ 9.+2.j,  9.+4.j,  9.+6.j])
    >>> a.real = np.array([9, 8, 7])
    >>> a
    array([ 9.+2.j,  8.+4.j,  7.+6.j])
    >>> np.real(1 + 1j)
    1.0

    """
    try:
        return val.real
    except AttributeError:
        return asanyarray(val).real


def imag(val):
    """
    Return the imaginary part of the complex argument.

    Parameters
    ----------
    val : array_like
        Input array.

    Returns
    -------
    out : ndarray or scalar
        The imaginary component of the complex argument. If `val` is real,
        the type of `val` is used for the output.  If `val` has complex
        elements, the returned type is float.

    See Also
    --------
    real, angle, real_if_close

    Examples
    --------
    >>> a = np.array([1+2j, 3+4j, 5+6j])
    >>> a.imag
    array([ 2.,  4.,  6.])
    >>> a.imag = np.array([8, 10, 12])
    >>> a
    array([ 1. +8.j,  3.+10.j,  5.+12.j])
    >>> np.imag(1 + 1j)
    1.0

    """
    try:
        return val.imag
    except AttributeError:
        return asanyarray(val).imag


def iscomplex(x):
    """
    Returns a bool array, where True if input element is complex.

    What is tested is whether the input has a non-zero imaginary part, not if
    the input type is complex.

    Parameters
    ----------
    x : array_like
        Input array.

    Returns
    -------
    out : ndarray of bools
        Output array.

    See Also
    --------
    isreal
    iscomplexobj : Return True if x is a complex type or an array of complex
                   numbers.

    Examples
    --------
    >>> np.iscomplex([1+1j, 1+0j, 4.5, 3, 2, 2j])
    array([ True, False, False, False, False,  True], dtype=bool)

    """
    ax = asanyarray(x)
    if issubclass(ax.dtype.type, _nx.complexfloating):
        return ax.imag != 0
    res = zeros(ax.shape, bool)
    return +res  # convet to array-scalar if needed

def isreal(x):
    """
    Returns a bool array, where True if input element is real.

    If element has complex type with zero complex part, the return value
    for that element is True.

    Parameters
    ----------
    x : array_like
        Input array.

    Returns
    -------
    out : ndarray, bool
        Boolean array of same shape as `x`.

    See Also
    --------
    iscomplex
    isrealobj : Return True if x is not a complex type.

    Examples
    --------
    >>> np.isreal([1+1j, 1+0j, 4.5, 3, 2, 2j])
    array([False,  True,  True,  True,  True, False], dtype=bool)

    """
    return imag(x) == 0

def iscomplexobj(x):
    """
    Check for a complex type or an array of complex numbers.

    The type of the input is checked, not the value. Even if the input
    has an imaginary part equal to zero, `iscomplexobj` evaluates to True.

    Parameters
    ----------
    x : any
        The input can be of any type and shape.

    Returns
    -------
    iscomplexobj : bool
        The return value, True if `x` is of a complex type or has at least
        one complex element.

    See Also
    --------
    isrealobj, iscomplex

    Examples
    --------
    >>> np.iscomplexobj(1)
    False
    >>> np.iscomplexobj(1+0j)
    True
    >>> np.iscomplexobj([3, 1+0j, True])
    True

    """
    try:
        dtype = x.dtype
        type_ = dtype.type
    except AttributeError:
        type_ = asarray(x).dtype.type
    return issubclass(type_, _nx.complexfloating)


def isrealobj(x):
    """
    Return True if x is a not complex type or an array of complex numbers.

    The type of the input is checked, not the value. So even if the input
    has an imaginary part equal to zero, `isrealobj` evaluates to False
    if the data type is complex.

    Parameters
    ----------
    x : any
        The input can be of any type and shape.

    Returns
    -------
    y : bool
        The return value, False if `x` is of a complex type.

    See Also
    --------
    iscomplexobj, isreal

    Examples
    --------
    >>> np.isrealobj(1)
    True
    >>> np.isrealobj(1+0j)
    False
    >>> np.isrealobj([3, 1+0j, True])
    False

    """
    return not iscomplexobj(x)

#-----------------------------------------------------------------------------

def _getmaxmin(t):
    from numpy.core import getlimits
    f = getlimits.finfo(t)
    return f.max, f.min

def nan_to_num(x, copy=True):
    """
    Replace nan with zero and inf with finite numbers.

    Returns an array or scalar replacing Not a Number (NaN) with zero,
    (positive) infinity with a very large number and negative infinity
    with a very small (or negative) number.

    Parameters
    ----------
    x : array_like
        Input data.
    copy : bool, optional
        Whether to create a copy of `x` (True) or to replace values
        in-place (False). The in-place operation only occurs if
        casting to an array does not require a copy.
        Default is True.

        .. versionadded:: 1.13

    Returns
    -------
    out : ndarray
        New Array with the same shape as `x` and dtype of the element in
        `x`  with the greatest precision. If `x` is inexact, then NaN is
        replaced by zero, and infinity (-infinity) is replaced by the
        largest (smallest or most negative) floating point value that fits
        in the output dtype. If `x` is not inexact, then a copy of `x` is
        returned.

    See Also
    --------
    isinf : Shows which elements are positive or negative infinity.
    isneginf : Shows which elements are negative infinity.
    isposinf : Shows which elements are positive infinity.
    isnan : Shows which elements are Not a Number (NaN).
    isfinite : Shows which elements are finite (not NaN, not infinity)

    Notes
    -----
    NumPy uses the IEEE Standard for Binary Floating-Point for Arithmetic
    (IEEE 754). This means that Not a Number is not equivalent to infinity.


    Examples
    --------
    >>> np.set_printoptions(precision=8)
    >>> x = np.array([np.inf, -np.inf, np.nan, -128, 128])
    >>> np.nan_to_num(x)
    array([  1.79769313e+308,  -1.79769313e+308,   0.00000000e+000,
            -1.28000000e+002,   1.28000000e+002])

    """
    x = _nx.array(x, subok=True, copy=copy)
    xtype = x.dtype.type
    if not issubclass(xtype, _nx.inexact):
        return x

    iscomplex = issubclass(xtype, _nx.complexfloating)
    isscalar = (x.ndim == 0)

    x = x[None] if isscalar else x
    dest = (x.real, x.imag) if iscomplex else (x,)
    maxf, minf = _getmaxmin(x.real.dtype)
    for d in dest:
        _nx.copyto(d, 0.0, where=isnan(d))
        _nx.copyto(d, maxf, where=isposinf(d))
        _nx.copyto(d, minf, where=isneginf(d))
    return x[0] if isscalar else x

#-----------------------------------------------------------------------------

def real_if_close(a,tol=100):
    """
    If complex input returns a real array if complex parts are close to zero.

    "Close to zero" is defined as `tol` * (machine epsilon of the type for
    `a`).

    Parameters
    ----------
    a : array_like
        Input array.
    tol : float
        Tolerance in machine epsilons for the complex part of the elements
        in the array.

    Returns
    -------
    out : ndarray
        If `a` is real, the type of `a` is used for the output.  If `a`
        has complex elements, the returned type is float.

    See Also
    --------
    real, imag, angle

    Notes
    -----
    Machine epsilon varies from machine to machine and between data types
    but Python floats on most platforms have a machine epsilon equal to
    2.2204460492503131e-16.  You can use 'np.finfo(np.float).eps' to print
    out the machine epsilon for floats.

    Examples
    --------
    >>> np.finfo(np.float).eps
    2.2204460492503131e-16

    >>> np.real_if_close([2.1 + 4e-14j], tol=1000)
    array([ 2.1])
    >>> np.real_if_close([2.1 + 4e-13j], tol=1000)
    array([ 2.1 +4.00000000e-13j])

    """
    a = asanyarray(a)
    if not issubclass(a.dtype.type, _nx.complexfloating):
        return a
    if tol > 1:
        from numpy.core import getlimits
        f = getlimits.finfo(a.dtype.type)
        tol = f.eps * tol
    if _nx.all(_nx.absolute(a.imag) < tol):
        a = a.real
    return a


def asscalar(a):
    """
    Convert an array of size 1 to its scalar equivalent.

    Parameters
    ----------
    a : ndarray
        Input array of size 1.

    Returns
    -------
    out : scalar
        Scalar representation of `a`. The output data type is the same type
        returned by the input's `item` method.

    Examples
    --------
    >>> np.asscalar(np.array([24]))
    24

    """
    return a.item()

#-----------------------------------------------------------------------------

_namefromtype = {'S1': 'character',
                 '?': 'bool',
                 'b': 'signed char',
                 'B': 'unsigned char',
                 'h': 'short',
                 'H': 'unsigned short',
                 'i': 'integer',
                 'I': 'unsigned integer',
                 'l': 'long integer',
                 'L': 'unsigned long integer',
                 'q': 'long long integer',
                 'Q': 'unsigned long long integer',
                 'f': 'single precision',
                 'd': 'double precision',
                 'g': 'long precision',
                 'F': 'complex single precision',
                 'D': 'complex double precision',
                 'G': 'complex long double precision',
                 'S': 'string',
                 'U': 'unicode',
                 'V': 'void',
                 'O': 'object'
                 }

def typename(char):
    """
    Return a description for the given data type code.

    Parameters
    ----------
    char : str
        Data type code.

    Returns
    -------
    out : str
        Description of the input data type code.

    See Also
    --------
    dtype, typecodes

    Examples
    --------
    >>> typechars = ['S1', '?', 'B', 'D', 'G', 'F', 'I', 'H', 'L', 'O', 'Q',
    ...              'S', 'U', 'V', 'b', 'd', 'g', 'f', 'i', 'h', 'l', 'q']
    >>> for typechar in typechars:
    ...     print(typechar, ' : ', np.typename(typechar))
    ...
    S1  :  character
    ?  :  bool
    B  :  unsigned char
    D  :  complex double precision
    G  :  complex long double precision
    F  :  complex single precision
    I  :  unsigned integer
    H  :  unsigned short
    L  :  unsigned long integer
    O  :  object
    Q  :  unsigned long long integer
    S  :  string
    U  :  unicode
    V  :  void
    b  :  signed char
    d  :  double precision
    g  :  long precision
    f  :  single precision
    i  :  integer
    h  :  short
    l  :  long integer
    q  :  long long integer

    """
    return _namefromtype[char]

#-----------------------------------------------------------------------------

#determine the "minimum common type" for a group of arrays.
array_type = [[_nx.half, _nx.single, _nx.double, _nx.longdouble],
              [None, _nx.csingle, _nx.cdouble, _nx.clongdouble]]
array_precision = {_nx.half: 0,
                   _nx.single: 1,
                   _nx.double: 2,
                   _nx.longdouble: 3,
                   _nx.csingle: 1,
                   _nx.cdouble: 2,
                   _nx.clongdouble: 3}
def common_type(*arrays):
    """
    Return a scalar type which is common to the input arrays.

    The return type will always be an inexact (i.e. floating point) scalar
    type, even if all the arrays are integer arrays. If one of the inputs is
    an integer array, the minimum precision type that is returned is a
    64-bit floating point dtype.

    All input arrays can be safely cast to the returned dtype without loss
    of information.

    Parameters
    ----------
    array1, array2, ... : ndarrays
        Input arrays.

    Returns
    -------
    out : data type code
        Data type code.

    See Also
    --------
    dtype, mintypecode

    Examples
    --------
    >>> np.common_type(np.arange(2, dtype=np.float32))
    <type 'numpy.float32'>
    >>> np.common_type(np.arange(2, dtype=np.float32), np.arange(2))
    <type 'numpy.float64'>
    >>> np.common_type(np.arange(4), np.array([45, 6.j]), np.array([45.0]))
    <type 'numpy.complex128'>

    """
    is_complex = False
    precision = 0
    for a in arrays:
        t = a.dtype.type
        if iscomplexobj(a):
            is_complex = True
        if issubclass(t, _nx.integer):
            p = 2  # array_precision[_nx.double]
        else:
            p = array_precision.get(t, None)
            if p is None:
                raise TypeError("can't get common type for non-numeric array")
        precision = max(precision, p)
    if is_complex:
        return array_type[1][precision]
    else:
        return array_type[0][precision]
