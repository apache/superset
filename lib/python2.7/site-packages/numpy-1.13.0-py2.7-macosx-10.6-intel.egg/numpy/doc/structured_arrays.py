"""
=================
Structured Arrays
=================

Introduction
============

NumPy provides powerful capabilities to create arrays of structured datatype.
These arrays permit one to manipulate the data by named fields. A simple 
example will show what is meant.: ::

 >>> x = np.array([(1,2.,'Hello'), (2,3.,"World")],
 ...              dtype=[('foo', 'i4'),('bar', 'f4'), ('baz', 'S10')])
 >>> x
 array([(1, 2.0, 'Hello'), (2, 3.0, 'World')],
      dtype=[('foo', '>i4'), ('bar', '>f4'), ('baz', '|S10')])

Here we have created a one-dimensional array of length 2. Each element of
this array is a structure that contains three items, a 32-bit integer, a 32-bit
float, and a string of length 10 or less. If we index this array at the second
position we get the second structure: ::

 >>> x[1]
 (2,3.,"World")

Conveniently, one can access any field of the array by indexing using the
string that names that field. ::

 >>> y = x['bar']
 >>> y
 array([ 2.,  3.], dtype=float32)
 >>> y[:] = 2*y
 >>> y
 array([ 4.,  6.], dtype=float32)
 >>> x
 array([(1, 4.0, 'Hello'), (2, 6.0, 'World')],
       dtype=[('foo', '>i4'), ('bar', '>f4'), ('baz', '|S10')])

In these examples, y is a simple float array consisting of the 2nd field
in the structured type. But, rather than being a copy of the data in the structured
array, it is a view, i.e., it shares exactly the same memory locations.
Thus, when we updated this array by doubling its values, the structured
array shows the corresponding values as doubled as well. Likewise, if one
changes the structured array, the field view also changes: ::

 >>> x[1] = (-1,-1.,"Master")
 >>> x
 array([(1, 4.0, 'Hello'), (-1, -1.0, 'Master')],
       dtype=[('foo', '>i4'), ('bar', '>f4'), ('baz', '|S10')])
 >>> y
 array([ 4., -1.], dtype=float32)

Defining Structured Arrays
==========================

One defines a structured array through the dtype object.  There are
**several** alternative ways to define the fields of a record.  Some of
these variants provide backward compatibility with Numeric, numarray, or
another module, and should not be used except for such purposes. These
will be so noted. One specifies record structure in
one of four alternative ways, using an argument (as supplied to a dtype
function keyword or a dtype object constructor itself).  This
argument must be one of the following: 1) string, 2) tuple, 3) list, or
4) dictionary.  Each of these is briefly described below.

1) String argument.
In this case, the constructor expects a comma-separated list of type
specifiers, optionally with extra shape information. The fields are 
given the default names 'f0', 'f1', 'f2' and so on.
The type specifiers can take 4 different forms: ::

  a) b1, i1, i2, i4, i8, u1, u2, u4, u8, f2, f4, f8, c8, c16, a<n>
     (representing bytes, ints, unsigned ints, floats, complex and
      fixed length strings of specified byte lengths)
  b) int8,...,uint8,...,float16, float32, float64, complex64, complex128
     (this time with bit sizes)
  c) older Numeric/numarray type specifications (e.g. Float32).
     Don't use these in new code!
  d) Single character type specifiers (e.g H for unsigned short ints).
     Avoid using these unless you must. Details can be found in the
     NumPy book

These different styles can be mixed within the same string (but why would you
want to do that?). Furthermore, each type specifier can be prefixed
with a repetition number, or a shape. In these cases an array
element is created, i.e., an array within a record. That array
is still referred to as a single field. An example: ::

 >>> x = np.zeros(3, dtype='3int8, float32, (2,3)float64')
 >>> x
 array([([0, 0, 0], 0.0, [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]),
        ([0, 0, 0], 0.0, [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]),
        ([0, 0, 0], 0.0, [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]])],
       dtype=[('f0', '|i1', 3), ('f1', '>f4'), ('f2', '>f8', (2, 3))])

By using strings to define the record structure, it precludes being
able to name the fields in the original definition. The names can
be changed as shown later, however.

2) Tuple argument: The only relevant tuple case that applies to record
structures is when a structure is mapped to an existing data type. This
is done by pairing in a tuple, the existing data type with a matching
dtype definition (using any of the variants being described here). As
an example (using a definition using a list, so see 3) for further
details): ::

 >>> x = np.zeros(3, dtype=('i4',[('r','u1'), ('g','u1'), ('b','u1'), ('a','u1')]))
 >>> x
 array([0, 0, 0])
 >>> x['r']
 array([0, 0, 0], dtype=uint8)

In this case, an array is produced that looks and acts like a simple int32 array,
but also has definitions for fields that use only one byte of the int32 (a bit
like Fortran equivalencing).

3) List argument: In this case the record structure is defined with a list of
tuples. Each tuple has 2 or 3 elements specifying: 1) The name of the field
('' is permitted), 2) the type of the field, and 3) the shape (optional).
For example::

 >>> x = np.zeros(3, dtype=[('x','f4'),('y',np.float32),('value','f4',(2,2))])
 >>> x
 array([(0.0, 0.0, [[0.0, 0.0], [0.0, 0.0]]),
        (0.0, 0.0, [[0.0, 0.0], [0.0, 0.0]]),
        (0.0, 0.0, [[0.0, 0.0], [0.0, 0.0]])],
       dtype=[('x', '>f4'), ('y', '>f4'), ('value', '>f4', (2, 2))])

4) Dictionary argument: two different forms are permitted. The first consists
of a dictionary with two required keys ('names' and 'formats'), each having an
equal sized list of values. The format list contains any type/shape specifier
allowed in other contexts. The names must be strings. There are two optional
keys: 'offsets' and 'titles'. Each must be a correspondingly matching list to
the required two where offsets contain integer offsets for each field, and
titles are objects containing metadata for each field (these do not have
to be strings), where the value of None is permitted. As an example: ::

 >>> x = np.zeros(3, dtype={'names':['col1', 'col2'], 'formats':['i4','f4']})
 >>> x
 array([(0, 0.0), (0, 0.0), (0, 0.0)],
       dtype=[('col1', '>i4'), ('col2', '>f4')])

The other dictionary form permitted is a dictionary of name keys with tuple
values specifying type, offset, and an optional title. ::

 >>> x = np.zeros(3, dtype={'col1':('i1',0,'title 1'), 'col2':('f4',1,'title 2')})
 >>> x
 array([(0, 0.0), (0, 0.0), (0, 0.0)],
       dtype=[(('title 1', 'col1'), '|i1'), (('title 2', 'col2'), '>f4')])

Accessing and modifying field names
===================================

The field names are an attribute of the dtype object defining the structure.
For the last example: ::

 >>> x.dtype.names
 ('col1', 'col2')
 >>> x.dtype.names = ('x', 'y')
 >>> x
 array([(0, 0.0), (0, 0.0), (0, 0.0)],
      dtype=[(('title 1', 'x'), '|i1'), (('title 2', 'y'), '>f4')])
 >>> x.dtype.names = ('x', 'y', 'z') # wrong number of names
 <type 'exceptions.ValueError'>: must replace all names at once with a sequence of length 2

Accessing field titles
====================================

The field titles provide a standard place to put associated info for fields.
They do not have to be strings. ::

 >>> x.dtype.fields['x'][2]
 'title 1'

Accessing multiple fields at once
====================================

You can access multiple fields at once using a list of field names: ::

 >>> x = np.array([(1.5,2.5,(1.0,2.0)),(3.,4.,(4.,5.)),(1.,3.,(2.,6.))],
         dtype=[('x','f4'),('y',np.float32),('value','f4',(2,2))])

Notice that `x` is created with a list of tuples. ::

 >>> x[['x','y']]
 array([(1.5, 2.5), (3.0, 4.0), (1.0, 3.0)],
      dtype=[('x', '<f4'), ('y', '<f4')])
 >>> x[['x','value']]
 array([(1.5, [[1.0, 2.0], [1.0, 2.0]]), (3.0, [[4.0, 5.0], [4.0, 5.0]]),
       (1.0, [[2.0, 6.0], [2.0, 6.0]])],
      dtype=[('x', '<f4'), ('value', '<f4', (2, 2))])

The fields are returned in the order they are asked for.::

 >>> x[['y','x']]
 array([(2.5, 1.5), (4.0, 3.0), (3.0, 1.0)],
      dtype=[('y', '<f4'), ('x', '<f4')])

Filling structured arrays
=========================

Structured arrays can be filled by field or row by row. ::

 >>> arr = np.zeros((5,), dtype=[('var1','f8'),('var2','f8')])
 >>> arr['var1'] = np.arange(5)

If you fill it in row by row, it takes a take a tuple
(but not a list or array!)::

 >>> arr[0] = (10,20)
 >>> arr
 array([(10.0, 20.0), (1.0, 0.0), (2.0, 0.0), (3.0, 0.0), (4.0, 0.0)],
      dtype=[('var1', '<f8'), ('var2', '<f8')])

Record Arrays
=============

For convenience, numpy provides "record arrays" which allow one to access
fields of structured arrays by attribute rather than by index. Record arrays
are structured arrays wrapped using a subclass of ndarray,
:class:`numpy.recarray`, which allows field access by attribute on the array
object, and record arrays also use a special datatype, :class:`numpy.record`,
which allows field access by attribute on the individual elements of the array. 

The simplest way to create a record array is with :func:`numpy.rec.array`: ::

 >>> recordarr = np.rec.array([(1,2.,'Hello'),(2,3.,"World")], 
 ...                    dtype=[('foo', 'i4'),('bar', 'f4'), ('baz', 'S10')])
 >>> recordarr.bar
 array([ 2.,  3.], dtype=float32)
 >>> recordarr[1:2]
 rec.array([(2, 3.0, 'World')], 
       dtype=[('foo', '<i4'), ('bar', '<f4'), ('baz', 'S10')])
 >>> recordarr[1:2].foo
 array([2], dtype=int32)
 >>> recordarr.foo[1:2]
 array([2], dtype=int32)
 >>> recordarr[1].baz
 'World'

numpy.rec.array can convert a wide variety of arguments into record arrays,
including normal structured arrays: ::

 >>> arr = array([(1,2.,'Hello'),(2,3.,"World")], 
 ...             dtype=[('foo', 'i4'), ('bar', 'f4'), ('baz', 'S10')])
 >>> recordarr = np.rec.array(arr)

The numpy.rec module provides a number of other convenience functions for
creating record arrays, see :ref:`record array creation routines
<routines.array-creation.rec>`.

A record array representation of a structured array can be obtained using the
appropriate :ref:`view`: ::

 >>> arr = np.array([(1,2.,'Hello'),(2,3.,"World")], 
 ...                dtype=[('foo', 'i4'),('bar', 'f4'), ('baz', 'a10')])
 >>> recordarr = arr.view(dtype=dtype((np.record, arr.dtype)), 
 ...                      type=np.recarray)

For convenience, viewing an ndarray as type `np.recarray` will automatically
convert to `np.record` datatype, so the dtype can be left out of the view: ::

 >>> recordarr = arr.view(np.recarray)
 >>> recordarr.dtype
 dtype((numpy.record, [('foo', '<i4'), ('bar', '<f4'), ('baz', 'S10')]))

To get back to a plain ndarray both the dtype and type must be reset. The
following view does so, taking into account the unusual case that the
recordarr was not a structured type: ::

 >>> arr2 = recordarr.view(recordarr.dtype.fields or recordarr.dtype, np.ndarray)

Record array fields accessed by index or by attribute are returned as a record
array if the field has a structured type but as a plain ndarray otherwise. ::

 >>> recordarr = np.rec.array([('Hello', (1,2)),("World", (3,4))], 
 ...                 dtype=[('foo', 'S6'),('bar', [('A', int), ('B', int)])])
 >>> type(recordarr.foo)
 <type 'numpy.ndarray'>
 >>> type(recordarr.bar)
 <class 'numpy.core.records.recarray'>

Note that if a field has the same name as an ndarray attribute, the ndarray
attribute takes precedence. Such fields will be inaccessible by attribute but
may still be accessed by index.


"""
from __future__ import division, absolute_import, print_function
