"""
============
Array basics
============

Array types and conversions between types
=========================================

NumPy supports a much greater variety of numerical types than Python does.
This section shows which are available, and how to modify an array's data-type.

==========  ==========================================================
Data type   Description
==========  ==========================================================
bool_       Boolean (True or False) stored as a byte
int_        Default integer type (same as C ``long``; normally either
            ``int64`` or ``int32``)
intc        Identical to C ``int`` (normally ``int32`` or ``int64``)
intp        Integer used for indexing (same as C ``ssize_t``; normally
            either ``int32`` or ``int64``)
int8        Byte (-128 to 127)
int16       Integer (-32768 to 32767)
int32       Integer (-2147483648 to 2147483647)
int64       Integer (-9223372036854775808 to 9223372036854775807)
uint8       Unsigned integer (0 to 255)
uint16      Unsigned integer (0 to 65535)
uint32      Unsigned integer (0 to 4294967295)
uint64      Unsigned integer (0 to 18446744073709551615)
float_      Shorthand for ``float64``.
float16     Half precision float: sign bit, 5 bits exponent,
            10 bits mantissa
float32     Single precision float: sign bit, 8 bits exponent,
            23 bits mantissa
float64     Double precision float: sign bit, 11 bits exponent,
            52 bits mantissa
complex_    Shorthand for ``complex128``.
complex64   Complex number, represented by two 32-bit floats (real
            and imaginary components)
complex128  Complex number, represented by two 64-bit floats (real
            and imaginary components)
==========  ==========================================================

Additionally to ``intc`` the platform dependent C integer types ``short``,
``long``, ``longlong`` and their unsigned versions are defined.

NumPy numerical types are instances of ``dtype`` (data-type) objects, each
having unique characteristics.  Once you have imported NumPy using

  ::

    >>> import numpy as np

the dtypes are available as ``np.bool_``, ``np.float32``, etc.

Advanced types, not listed in the table above, are explored in
section :ref:`structured_arrays`.

There are 5 basic numerical types representing booleans (bool), integers (int),
unsigned integers (uint) floating point (float) and complex. Those with numbers
in their name indicate the bitsize of the type (i.e. how many bits are needed
to represent a single value in memory).  Some types, such as ``int`` and
``intp``, have differing bitsizes, dependent on the platforms (e.g. 32-bit
vs. 64-bit machines).  This should be taken into account when interfacing
with low-level code (such as C or Fortran) where the raw memory is addressed.

Data-types can be used as functions to convert python numbers to array scalars
(see the array scalar section for an explanation), python sequences of numbers
to arrays of that type, or as arguments to the dtype keyword that many numpy
functions or methods accept. Some examples::

    >>> import numpy as np
    >>> x = np.float32(1.0)
    >>> x
    1.0
    >>> y = np.int_([1,2,4])
    >>> y
    array([1, 2, 4])
    >>> z = np.arange(3, dtype=np.uint8)
    >>> z
    array([0, 1, 2], dtype=uint8)

Array types can also be referred to by character codes, mostly to retain
backward compatibility with older packages such as Numeric.  Some
documentation may still refer to these, for example::

  >>> np.array([1, 2, 3], dtype='f')
  array([ 1.,  2.,  3.], dtype=float32)

We recommend using dtype objects instead.

To convert the type of an array, use the .astype() method (preferred) or
the type itself as a function. For example: ::

    >>> z.astype(float)                 #doctest: +NORMALIZE_WHITESPACE
    array([  0.,  1.,  2.])
    >>> np.int8(z)
    array([0, 1, 2], dtype=int8)

Note that, above, we use the *Python* float object as a dtype.  NumPy knows
that ``int`` refers to ``np.int_``, ``bool`` means ``np.bool_``,
that ``float`` is ``np.float_`` and ``complex`` is ``np.complex_``.
The other data-types do not have Python equivalents.

To determine the type of an array, look at the dtype attribute::

    >>> z.dtype
    dtype('uint8')

dtype objects also contain information about the type, such as its bit-width
and its byte-order.  The data type can also be used indirectly to query
properties of the type, such as whether it is an integer::

    >>> d = np.dtype(int)
    >>> d
    dtype('int32')

    >>> np.issubdtype(d, int)
    True

    >>> np.issubdtype(d, float)
    False


Array Scalars
=============

NumPy generally returns elements of arrays as array scalars (a scalar
with an associated dtype).  Array scalars differ from Python scalars, but
for the most part they can be used interchangeably (the primary
exception is for versions of Python older than v2.x, where integer array
scalars cannot act as indices for lists and tuples).  There are some
exceptions, such as when code requires very specific attributes of a scalar
or when it checks specifically whether a value is a Python scalar. Generally,
problems are easily fixed by explicitly converting array scalars
to Python scalars, using the corresponding Python type function
(e.g., ``int``, ``float``, ``complex``, ``str``, ``unicode``).

The primary advantage of using array scalars is that
they preserve the array type (Python may not have a matching scalar type
available, e.g. ``int16``).  Therefore, the use of array scalars ensures
identical behaviour between arrays and scalars, irrespective of whether the
value is inside an array or not.  NumPy scalars also have many of the same
methods arrays do.

Extended Precision
==================

Python's floating-point numbers are usually 64-bit floating-point numbers,
nearly equivalent to ``np.float64``. In some unusual situations it may be
useful to use floating-point numbers with more precision. Whether this
is possible in numpy depends on the hardware and on the development
environment: specifically, x86 machines provide hardware floating-point
with 80-bit precision, and while most C compilers provide this as their
``long double`` type, MSVC (standard for Windows builds) makes
``long double`` identical to ``double`` (64 bits). NumPy makes the
compiler's ``long double`` available as ``np.longdouble`` (and
``np.clongdouble`` for the complex numbers). You can find out what your
numpy provides with``np.finfo(np.longdouble)``.

NumPy does not provide a dtype with more precision than C
``long double``s; in particular, the 128-bit IEEE quad precision
data type (FORTRAN's ``REAL*16``) is not available.

For efficient memory alignment, ``np.longdouble`` is usually stored
padded with zero bits, either to 96 or 128 bits. Which is more efficient
depends on hardware and development environment; typically on 32-bit
systems they are padded to 96 bits, while on 64-bit systems they are
typically padded to 128 bits. ``np.longdouble`` is padded to the system
default; ``np.float96`` and ``np.float128`` are provided for users who
want specific padding. In spite of the names, ``np.float96`` and
``np.float128`` provide only as much precision as ``np.longdouble``,
that is, 80 bits on most x86 machines and 64 bits in standard
Windows builds.

Be warned that even if ``np.longdouble`` offers more precision than
python ``float``, it is easy to lose that extra precision, since
python often forces values to pass through ``float``. For example,
the ``%`` formatting operator requires its arguments to be converted
to standard python types, and it is therefore impossible to preserve
extended precision even if many decimal places are requested. It can
be useful to test your code with the value
``1 + np.finfo(np.longdouble).eps``.

"""
from __future__ import division, absolute_import, print_function
