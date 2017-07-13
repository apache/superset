#!/usr/bin/env python
"""

C declarations, CPP macros, and C functions for f2py2e.
Only required declarations/macros/functions will be used.

Copyright 1999,2000 Pearu Peterson all rights reserved,
Pearu Peterson <pearu@ioc.ee>
Permission to use, modify, and distribute this software is given under the
terms of the NumPy License.

NO WARRANTY IS EXPRESSED OR IMPLIED.  USE AT YOUR OWN RISK.
$Date: 2005/05/06 11:42:34 $
Pearu Peterson

"""
from __future__ import division, absolute_import, print_function

import sys
import copy

from . import __version__

f2py_version = __version__.version
errmess = sys.stderr.write

##################### Definitions ##################

outneeds = {'includes0': [], 'includes': [], 'typedefs': [], 'typedefs_generated': [],
            'userincludes': [],
            'cppmacros': [], 'cfuncs': [], 'callbacks': [], 'f90modhooks': [],
            'commonhooks': []}
needs = {}
includes0 = {'includes0': '/*need_includes0*/'}
includes = {'includes': '/*need_includes*/'}
userincludes = {'userincludes': '/*need_userincludes*/'}
typedefs = {'typedefs': '/*need_typedefs*/'}
typedefs_generated = {'typedefs_generated': '/*need_typedefs_generated*/'}
cppmacros = {'cppmacros': '/*need_cppmacros*/'}
cfuncs = {'cfuncs': '/*need_cfuncs*/'}
callbacks = {'callbacks': '/*need_callbacks*/'}
f90modhooks = {'f90modhooks': '/*need_f90modhooks*/',
               'initf90modhooksstatic': '/*initf90modhooksstatic*/',
               'initf90modhooksdynamic': '/*initf90modhooksdynamic*/',
               }
commonhooks = {'commonhooks': '/*need_commonhooks*/',
               'initcommonhooks': '/*need_initcommonhooks*/',
               }

############ Includes ###################

includes0['math.h'] = '#include <math.h>'
includes0['string.h'] = '#include <string.h>'
includes0['setjmp.h'] = '#include <setjmp.h>'

includes['Python.h'] = '#include "Python.h"'
needs['arrayobject.h'] = ['Python.h']
includes['arrayobject.h'] = '''#define PY_ARRAY_UNIQUE_SYMBOL PyArray_API
#include "arrayobject.h"'''

includes['arrayobject.h'] = '#include "fortranobject.h"'
includes['stdarg.h'] = '#include <stdarg.h>'

############# Type definitions ###############

typedefs['unsigned_char'] = 'typedef unsigned char unsigned_char;'
typedefs['unsigned_short'] = 'typedef unsigned short unsigned_short;'
typedefs['unsigned_long'] = 'typedef unsigned long unsigned_long;'
typedefs['signed_char'] = 'typedef signed char signed_char;'
typedefs['long_long'] = """\
#ifdef _WIN32
typedef __int64 long_long;
#else
typedef long long long_long;
typedef unsigned long long unsigned_long_long;
#endif
"""
typedefs['unsigned_long_long'] = """\
#ifdef _WIN32
typedef __uint64 long_long;
#else
typedef unsigned long long unsigned_long_long;
#endif
"""
typedefs['long_double'] = """\
#ifndef _LONG_DOUBLE
typedef long double long_double;
#endif
"""
typedefs[
    'complex_long_double'] = 'typedef struct {long double r,i;} complex_long_double;'
typedefs['complex_float'] = 'typedef struct {float r,i;} complex_float;'
typedefs['complex_double'] = 'typedef struct {double r,i;} complex_double;'
typedefs['string'] = """typedef char * string;"""


############### CPP macros ####################
cppmacros['CFUNCSMESS'] = """\
#ifdef DEBUGCFUNCS
#define CFUNCSMESS(mess) fprintf(stderr,\"debug-capi:\"mess);
#define CFUNCSMESSPY(mess,obj) CFUNCSMESS(mess) \\
\tPyObject_Print((PyObject *)obj,stderr,Py_PRINT_RAW);\\
\tfprintf(stderr,\"\\n\");
#else
#define CFUNCSMESS(mess)
#define CFUNCSMESSPY(mess,obj)
#endif
"""
cppmacros['F_FUNC'] = """\
#if defined(PREPEND_FORTRAN)
#if defined(NO_APPEND_FORTRAN)
#if defined(UPPERCASE_FORTRAN)
#define F_FUNC(f,F) _##F
#else
#define F_FUNC(f,F) _##f
#endif
#else
#if defined(UPPERCASE_FORTRAN)
#define F_FUNC(f,F) _##F##_
#else
#define F_FUNC(f,F) _##f##_
#endif
#endif
#else
#if defined(NO_APPEND_FORTRAN)
#if defined(UPPERCASE_FORTRAN)
#define F_FUNC(f,F) F
#else
#define F_FUNC(f,F) f
#endif
#else
#if defined(UPPERCASE_FORTRAN)
#define F_FUNC(f,F) F##_
#else
#define F_FUNC(f,F) f##_
#endif
#endif
#endif
#if defined(UNDERSCORE_G77)
#define F_FUNC_US(f,F) F_FUNC(f##_,F##_)
#else
#define F_FUNC_US(f,F) F_FUNC(f,F)
#endif
"""
cppmacros['F_WRAPPEDFUNC'] = """\
#if defined(PREPEND_FORTRAN)
#if defined(NO_APPEND_FORTRAN)
#if defined(UPPERCASE_FORTRAN)
#define F_WRAPPEDFUNC(f,F) _F2PYWRAP##F
#else
#define F_WRAPPEDFUNC(f,F) _f2pywrap##f
#endif
#else
#if defined(UPPERCASE_FORTRAN)
#define F_WRAPPEDFUNC(f,F) _F2PYWRAP##F##_
#else
#define F_WRAPPEDFUNC(f,F) _f2pywrap##f##_
#endif
#endif
#else
#if defined(NO_APPEND_FORTRAN)
#if defined(UPPERCASE_FORTRAN)
#define F_WRAPPEDFUNC(f,F) F2PYWRAP##F
#else
#define F_WRAPPEDFUNC(f,F) f2pywrap##f
#endif
#else
#if defined(UPPERCASE_FORTRAN)
#define F_WRAPPEDFUNC(f,F) F2PYWRAP##F##_
#else
#define F_WRAPPEDFUNC(f,F) f2pywrap##f##_
#endif
#endif
#endif
#if defined(UNDERSCORE_G77)
#define F_WRAPPEDFUNC_US(f,F) F_WRAPPEDFUNC(f##_,F##_)
#else
#define F_WRAPPEDFUNC_US(f,F) F_WRAPPEDFUNC(f,F)
#endif
"""
cppmacros['F_MODFUNC'] = """\
#if defined(F90MOD2CCONV1) /*E.g. Compaq Fortran */
#if defined(NO_APPEND_FORTRAN)
#define F_MODFUNCNAME(m,f) $ ## m ## $ ## f
#else
#define F_MODFUNCNAME(m,f) $ ## m ## $ ## f ## _
#endif
#endif

#if defined(F90MOD2CCONV2) /*E.g. IBM XL Fortran, not tested though */
#if defined(NO_APPEND_FORTRAN)
#define F_MODFUNCNAME(m,f)  __ ## m ## _MOD_ ## f
#else
#define F_MODFUNCNAME(m,f)  __ ## m ## _MOD_ ## f ## _
#endif
#endif

#if defined(F90MOD2CCONV3) /*E.g. MIPSPro Compilers */
#if defined(NO_APPEND_FORTRAN)
#define F_MODFUNCNAME(m,f)  f ## .in. ## m
#else
#define F_MODFUNCNAME(m,f)  f ## .in. ## m ## _
#endif
#endif
/*
#if defined(UPPERCASE_FORTRAN)
#define F_MODFUNC(m,M,f,F) F_MODFUNCNAME(M,F)
#else
#define F_MODFUNC(m,M,f,F) F_MODFUNCNAME(m,f)
#endif
*/

#define F_MODFUNC(m,f) (*(f2pymodstruct##m##.##f))
"""
cppmacros['SWAPUNSAFE'] = """\
#define SWAP(a,b) (size_t)(a) = ((size_t)(a) ^ (size_t)(b));\\
 (size_t)(b) = ((size_t)(a) ^ (size_t)(b));\\
 (size_t)(a) = ((size_t)(a) ^ (size_t)(b))
"""
cppmacros['SWAP'] = """\
#define SWAP(a,b,t) {\\
\tt *c;\\
\tc = a;\\
\ta = b;\\
\tb = c;}
"""
# cppmacros['ISCONTIGUOUS']='#define ISCONTIGUOUS(m) (PyArray_FLAGS(m) &
# NPY_ARRAY_C_CONTIGUOUS)'
cppmacros['PRINTPYOBJERR'] = """\
#define PRINTPYOBJERR(obj)\\
\tfprintf(stderr,\"#modulename#.error is related to \");\\
\tPyObject_Print((PyObject *)obj,stderr,Py_PRINT_RAW);\\
\tfprintf(stderr,\"\\n\");
"""
cppmacros['MINMAX'] = """\
#ifndef max
#define max(a,b) ((a > b) ? (a) : (b))
#endif
#ifndef min
#define min(a,b) ((a < b) ? (a) : (b))
#endif
#ifndef MAX
#define MAX(a,b) ((a > b) ? (a) : (b))
#endif
#ifndef MIN
#define MIN(a,b) ((a < b) ? (a) : (b))
#endif
"""
needs['len..'] = ['f2py_size']
cppmacros['len..'] = """\
#define rank(var) var ## _Rank
#define shape(var,dim) var ## _Dims[dim]
#define old_rank(var) (PyArray_NDIM((PyArrayObject *)(capi_ ## var ## _tmp)))
#define old_shape(var,dim) PyArray_DIM(((PyArrayObject *)(capi_ ## var ## _tmp)),dim)
#define fshape(var,dim) shape(var,rank(var)-dim-1)
#define len(var) shape(var,0)
#define flen(var) fshape(var,0)
#define old_size(var) PyArray_SIZE((PyArrayObject *)(capi_ ## var ## _tmp))
/* #define index(i) capi_i ## i */
#define slen(var) capi_ ## var ## _len
#define size(var, ...) f2py_size((PyArrayObject *)(capi_ ## var ## _tmp), ## __VA_ARGS__, -1)
"""
needs['f2py_size'] = ['stdarg.h']
cfuncs['f2py_size'] = """\
static int f2py_size(PyArrayObject* var, ...)
{
  npy_int sz = 0;
  npy_int dim;
  npy_int rank;
  va_list argp;
  va_start(argp, var);
  dim = va_arg(argp, npy_int);
  if (dim==-1)
    {
      sz = PyArray_SIZE(var);
    }
  else
    {
      rank = PyArray_NDIM(var);
      if (dim>=1 && dim<=rank)
        sz = PyArray_DIM(var, dim-1);
      else
        fprintf(stderr, \"f2py_size: 2nd argument value=%d fails to satisfy 1<=value<=%d. Result will be 0.\\n\", dim, rank);
    }
  va_end(argp);
  return sz;
}
"""

cppmacros[
    'pyobj_from_char1'] = '#define pyobj_from_char1(v) (PyInt_FromLong(v))'
cppmacros[
    'pyobj_from_short1'] = '#define pyobj_from_short1(v) (PyInt_FromLong(v))'
needs['pyobj_from_int1'] = ['signed_char']
cppmacros['pyobj_from_int1'] = '#define pyobj_from_int1(v) (PyInt_FromLong(v))'
cppmacros[
    'pyobj_from_long1'] = '#define pyobj_from_long1(v) (PyLong_FromLong(v))'
needs['pyobj_from_long_long1'] = ['long_long']
cppmacros['pyobj_from_long_long1'] = """\
#ifdef HAVE_LONG_LONG
#define pyobj_from_long_long1(v) (PyLong_FromLongLong(v))
#else
#warning HAVE_LONG_LONG is not available. Redefining pyobj_from_long_long.
#define pyobj_from_long_long1(v) (PyLong_FromLong(v))
#endif
"""
needs['pyobj_from_long_double1'] = ['long_double']
cppmacros[
    'pyobj_from_long_double1'] = '#define pyobj_from_long_double1(v) (PyFloat_FromDouble(v))'
cppmacros[
    'pyobj_from_double1'] = '#define pyobj_from_double1(v) (PyFloat_FromDouble(v))'
cppmacros[
    'pyobj_from_float1'] = '#define pyobj_from_float1(v) (PyFloat_FromDouble(v))'
needs['pyobj_from_complex_long_double1'] = ['complex_long_double']
cppmacros[
    'pyobj_from_complex_long_double1'] = '#define pyobj_from_complex_long_double1(v) (PyComplex_FromDoubles(v.r,v.i))'
needs['pyobj_from_complex_double1'] = ['complex_double']
cppmacros[
    'pyobj_from_complex_double1'] = '#define pyobj_from_complex_double1(v) (PyComplex_FromDoubles(v.r,v.i))'
needs['pyobj_from_complex_float1'] = ['complex_float']
cppmacros[
    'pyobj_from_complex_float1'] = '#define pyobj_from_complex_float1(v) (PyComplex_FromDoubles(v.r,v.i))'
needs['pyobj_from_string1'] = ['string']
cppmacros[
    'pyobj_from_string1'] = '#define pyobj_from_string1(v) (PyString_FromString((char *)v))'
needs['pyobj_from_string1size'] = ['string']
cppmacros[
    'pyobj_from_string1size'] = '#define pyobj_from_string1size(v,len) (PyUString_FromStringAndSize((char *)v, len))'
needs['TRYPYARRAYTEMPLATE'] = ['PRINTPYOBJERR']
cppmacros['TRYPYARRAYTEMPLATE'] = """\
/* New SciPy */
#define TRYPYARRAYTEMPLATECHAR case NPY_STRING: *(char *)(PyArray_DATA(arr))=*v; break;
#define TRYPYARRAYTEMPLATELONG case NPY_LONG: *(long *)(PyArray_DATA(arr))=*v; break;
#define TRYPYARRAYTEMPLATEOBJECT case NPY_OBJECT: (PyArray_DESCR(arr)->f->setitem)(pyobj_from_ ## ctype ## 1(*v),PyArray_DATA(arr)); break;

#define TRYPYARRAYTEMPLATE(ctype,typecode) \\
        PyArrayObject *arr = NULL;\\
        if (!obj) return -2;\\
        if (!PyArray_Check(obj)) return -1;\\
        if (!(arr=(PyArrayObject *)obj)) {fprintf(stderr,\"TRYPYARRAYTEMPLATE:\");PRINTPYOBJERR(obj);return 0;}\\
        if (PyArray_DESCR(arr)->type==typecode)  {*(ctype *)(PyArray_DATA(arr))=*v; return 1;}\\
        switch (PyArray_TYPE(arr)) {\\
                case NPY_DOUBLE: *(double *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_INT: *(int *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_LONG: *(long *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_FLOAT: *(float *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_CDOUBLE: *(double *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_CFLOAT: *(float *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_BOOL: *(npy_bool *)(PyArray_DATA(arr))=(*v!=0); break;\\
                case NPY_UBYTE: *(unsigned char *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_BYTE: *(signed char *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_SHORT: *(short *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_USHORT: *(npy_ushort *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_UINT: *(npy_uint *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_ULONG: *(npy_ulong *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_LONGLONG: *(npy_longlong *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_ULONGLONG: *(npy_ulonglong *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_LONGDOUBLE: *(npy_longdouble *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_CLONGDOUBLE: *(npy_longdouble *)(PyArray_DATA(arr))=*v; break;\\
                case NPY_OBJECT: (PyArray_DESCR(arr)->f->setitem)(pyobj_from_ ## ctype ## 1(*v),PyArray_DATA(arr), arr); break;\\
        default: return -2;\\
        };\\
        return 1
"""

needs['TRYCOMPLEXPYARRAYTEMPLATE'] = ['PRINTPYOBJERR']
cppmacros['TRYCOMPLEXPYARRAYTEMPLATE'] = """\
#define TRYCOMPLEXPYARRAYTEMPLATEOBJECT case NPY_OBJECT: (PyArray_DESCR(arr)->f->setitem)(pyobj_from_complex_ ## ctype ## 1((*v)),PyArray_DATA(arr), arr); break;
#define TRYCOMPLEXPYARRAYTEMPLATE(ctype,typecode)\\
        PyArrayObject *arr = NULL;\\
        if (!obj) return -2;\\
        if (!PyArray_Check(obj)) return -1;\\
        if (!(arr=(PyArrayObject *)obj)) {fprintf(stderr,\"TRYCOMPLEXPYARRAYTEMPLATE:\");PRINTPYOBJERR(obj);return 0;}\\
        if (PyArray_DESCR(arr)->type==typecode) {\\
            *(ctype *)(PyArray_DATA(arr))=(*v).r;\\
            *(ctype *)(PyArray_DATA(arr)+sizeof(ctype))=(*v).i;\\
            return 1;\\
        }\\
        switch (PyArray_TYPE(arr)) {\\
                case NPY_CDOUBLE: *(double *)(PyArray_DATA(arr))=(*v).r;*(double *)(PyArray_DATA(arr)+sizeof(double))=(*v).i;break;\\
                case NPY_CFLOAT: *(float *)(PyArray_DATA(arr))=(*v).r;*(float *)(PyArray_DATA(arr)+sizeof(float))=(*v).i;break;\\
                case NPY_DOUBLE: *(double *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_LONG: *(long *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_FLOAT: *(float *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_INT: *(int *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_SHORT: *(short *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_UBYTE: *(unsigned char *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_BYTE: *(signed char *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_BOOL: *(npy_bool *)(PyArray_DATA(arr))=((*v).r!=0 && (*v).i!=0); break;\\
                case NPY_USHORT: *(npy_ushort *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_UINT: *(npy_uint *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_ULONG: *(npy_ulong *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_LONGLONG: *(npy_longlong *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_ULONGLONG: *(npy_ulonglong *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_LONGDOUBLE: *(npy_longdouble *)(PyArray_DATA(arr))=(*v).r; break;\\
                case NPY_CLONGDOUBLE: *(npy_longdouble *)(PyArray_DATA(arr))=(*v).r;*(npy_longdouble *)(PyArray_DATA(arr)+sizeof(npy_longdouble))=(*v).i;break;\\
                case NPY_OBJECT: (PyArray_DESCR(arr)->f->setitem)(pyobj_from_complex_ ## ctype ## 1((*v)),PyArray_DATA(arr), arr); break;\\
                default: return -2;\\
        };\\
        return -1;
"""
# cppmacros['NUMFROMARROBJ']="""\
# define NUMFROMARROBJ(typenum,ctype) \\
# \tif (PyArray_Check(obj)) arr = (PyArrayObject *)obj;\\
# \telse arr = (PyArrayObject *)PyArray_ContiguousFromObject(obj,typenum,0,0);\\
# \tif (arr) {\\
# \t\tif (PyArray_TYPE(arr)==NPY_OBJECT) {\\
# \t\t\tif (!ctype ## _from_pyobj(v,(PyArray_DESCR(arr)->getitem)(PyArray_DATA(arr)),\"\"))\\
# \t\t\tgoto capi_fail;\\
# \t\t} else {\\
# \t\t\t(PyArray_DESCR(arr)->cast[typenum])(PyArray_DATA(arr),1,(char*)v,1,1);\\
# \t\t}\\
# \t\tif ((PyObject *)arr != obj) { Py_DECREF(arr); }\\
# \t\treturn 1;\\
# \t}
# """
# XXX: Note that CNUMFROMARROBJ is identical with NUMFROMARROBJ
# cppmacros['CNUMFROMARROBJ']="""\
# define CNUMFROMARROBJ(typenum,ctype) \\
# \tif (PyArray_Check(obj)) arr = (PyArrayObject *)obj;\\
# \telse arr = (PyArrayObject *)PyArray_ContiguousFromObject(obj,typenum,0,0);\\
# \tif (arr) {\\
# \t\tif (PyArray_TYPE(arr)==NPY_OBJECT) {\\
# \t\t\tif (!ctype ## _from_pyobj(v,(PyArray_DESCR(arr)->getitem)(PyArray_DATA(arr)),\"\"))\\
# \t\t\tgoto capi_fail;\\
# \t\t} else {\\
# \t\t\t(PyArray_DESCR(arr)->cast[typenum])((void *)(PyArray_DATA(arr)),1,(void *)(v),1,1);\\
# \t\t}\\
# \t\tif ((PyObject *)arr != obj) { Py_DECREF(arr); }\\
# \t\treturn 1;\\
# \t}
# """


needs['GETSTRFROMPYTUPLE'] = ['STRINGCOPYN', 'PRINTPYOBJERR']
cppmacros['GETSTRFROMPYTUPLE'] = """\
#define GETSTRFROMPYTUPLE(tuple,index,str,len) {\\
\t\tPyObject *rv_cb_str = PyTuple_GetItem((tuple),(index));\\
\t\tif (rv_cb_str == NULL)\\
\t\t\tgoto capi_fail;\\
\t\tif (PyString_Check(rv_cb_str)) {\\
\t\t\tstr[len-1]='\\0';\\
\t\t\tSTRINGCOPYN((str),PyString_AS_STRING((PyStringObject*)rv_cb_str),(len));\\
\t\t} else {\\
\t\t\tPRINTPYOBJERR(rv_cb_str);\\
\t\t\tPyErr_SetString(#modulename#_error,\"string object expected\");\\
\t\t\tgoto capi_fail;\\
\t\t}\\
\t}
"""
cppmacros['GETSCALARFROMPYTUPLE'] = """\
#define GETSCALARFROMPYTUPLE(tuple,index,var,ctype,mess) {\\
\t\tif ((capi_tmp = PyTuple_GetItem((tuple),(index)))==NULL) goto capi_fail;\\
\t\tif (!(ctype ## _from_pyobj((var),capi_tmp,mess)))\\
\t\t\tgoto capi_fail;\\
\t}
"""

cppmacros['FAILNULL'] = """\\
#define FAILNULL(p) do {                                            \\
    if ((p) == NULL) {                                              \\
        PyErr_SetString(PyExc_MemoryError, "NULL pointer found");   \\
        goto capi_fail;                                             \\
    }                                                               \\
} while (0)
"""
needs['MEMCOPY'] = ['string.h', 'FAILNULL']
cppmacros['MEMCOPY'] = """\
#define MEMCOPY(to,from,n)\\
    do { FAILNULL(to); FAILNULL(from); (void)memcpy(to,from,n); } while (0)
"""
cppmacros['STRINGMALLOC'] = """\
#define STRINGMALLOC(str,len)\\
\tif ((str = (string)malloc(sizeof(char)*(len+1))) == NULL) {\\
\t\tPyErr_SetString(PyExc_MemoryError, \"out of memory\");\\
\t\tgoto capi_fail;\\
\t} else {\\
\t\t(str)[len] = '\\0';\\
\t}
"""
cppmacros['STRINGFREE'] = """\
#define STRINGFREE(str) do {if (!(str == NULL)) free(str);} while (0)
"""
needs['STRINGCOPYN'] = ['string.h', 'FAILNULL']
cppmacros['STRINGCOPYN'] = """\
#define STRINGCOPYN(to,from,buf_size)                           \\
    do {                                                        \\
        int _m = (buf_size);                                    \\
        char *_to = (to);                                       \\
        char *_from = (from);                                   \\
        FAILNULL(_to); FAILNULL(_from);                         \\
        (void)strncpy(_to, _from, sizeof(char)*_m);             \\
        _to[_m-1] = '\\0';                                      \\
        /* Padding with spaces instead of nulls */              \\
        for (_m -= 2; _m >= 0 && _to[_m] == '\\0'; _m--) {      \\
            _to[_m] = ' ';                                      \\
        }                                                       \\
    } while (0)
"""
needs['STRINGCOPY'] = ['string.h', 'FAILNULL']
cppmacros['STRINGCOPY'] = """\
#define STRINGCOPY(to,from)\\
    do { FAILNULL(to); FAILNULL(from); (void)strcpy(to,from); } while (0)
"""
cppmacros['CHECKGENERIC'] = """\
#define CHECKGENERIC(check,tcheck,name) \\
\tif (!(check)) {\\
\t\tPyErr_SetString(#modulename#_error,\"(\"tcheck\") failed for \"name);\\
\t\t/*goto capi_fail;*/\\
\t} else """
cppmacros['CHECKARRAY'] = """\
#define CHECKARRAY(check,tcheck,name) \\
\tif (!(check)) {\\
\t\tPyErr_SetString(#modulename#_error,\"(\"tcheck\") failed for \"name);\\
\t\t/*goto capi_fail;*/\\
\t} else """
cppmacros['CHECKSTRING'] = """\
#define CHECKSTRING(check,tcheck,name,show,var)\\
\tif (!(check)) {\\
\t\tchar errstring[256];\\
\t\tsprintf(errstring, \"%s: \"show, \"(\"tcheck\") failed for \"name, slen(var), var);\\
\t\tPyErr_SetString(#modulename#_error, errstring);\\
\t\t/*goto capi_fail;*/\\
\t} else """
cppmacros['CHECKSCALAR'] = """\
#define CHECKSCALAR(check,tcheck,name,show,var)\\
\tif (!(check)) {\\
\t\tchar errstring[256];\\
\t\tsprintf(errstring, \"%s: \"show, \"(\"tcheck\") failed for \"name, var);\\
\t\tPyErr_SetString(#modulename#_error,errstring);\\
\t\t/*goto capi_fail;*/\\
\t} else """
# cppmacros['CHECKDIMS']="""\
# define CHECKDIMS(dims,rank) \\
# \tfor (int i=0;i<(rank);i++)\\
# \t\tif (dims[i]<0) {\\
# \t\t\tfprintf(stderr,\"Unspecified array argument requires a complete dimension specification.\\n\");\\
# \t\t\tgoto capi_fail;\\
# \t\t}
# """
cppmacros[
    'ARRSIZE'] = '#define ARRSIZE(dims,rank) (_PyArray_multiply_list(dims,rank))'
cppmacros['OLDPYNUM'] = """\
#ifdef OLDPYNUM
#error You need to intall Numeric Python version 13 or higher. Get it from http:/sourceforge.net/project/?group_id=1369
#endif
"""
################# C functions ###############

cfuncs['calcarrindex'] = """\
static int calcarrindex(int *i,PyArrayObject *arr) {
\tint k,ii = i[0];
\tfor (k=1; k < PyArray_NDIM(arr); k++)
\t\tii += (ii*(PyArray_DIM(arr,k) - 1)+i[k]); /* assuming contiguous arr */
\treturn ii;
}"""
cfuncs['calcarrindextr'] = """\
static int calcarrindextr(int *i,PyArrayObject *arr) {
\tint k,ii = i[PyArray_NDIM(arr)-1];
\tfor (k=1; k < PyArray_NDIM(arr); k++)
\t\tii += (ii*(PyArray_DIM(arr,PyArray_NDIM(arr)-k-1) - 1)+i[PyArray_NDIM(arr)-k-1]); /* assuming contiguous arr */
\treturn ii;
}"""
cfuncs['forcomb'] = """\
static struct { int nd;npy_intp *d;int *i,*i_tr,tr; } forcombcache;
static int initforcomb(npy_intp *dims,int nd,int tr) {
  int k;
  if (dims==NULL) return 0;
  if (nd<0) return 0;
  forcombcache.nd = nd;
  forcombcache.d = dims;
  forcombcache.tr = tr;
  if ((forcombcache.i = (int *)malloc(sizeof(int)*nd))==NULL) return 0;
  if ((forcombcache.i_tr = (int *)malloc(sizeof(int)*nd))==NULL) return 0;
  for (k=1;k<nd;k++) {
    forcombcache.i[k] = forcombcache.i_tr[nd-k-1] = 0;
  }
  forcombcache.i[0] = forcombcache.i_tr[nd-1] = -1;
  return 1;
}
static int *nextforcomb(void) {
  int j,*i,*i_tr,k;
  int nd=forcombcache.nd;
  if ((i=forcombcache.i) == NULL) return NULL;
  if ((i_tr=forcombcache.i_tr) == NULL) return NULL;
  if (forcombcache.d == NULL) return NULL;
  i[0]++;
  if (i[0]==forcombcache.d[0]) {
    j=1;
    while ((j<nd) && (i[j]==forcombcache.d[j]-1)) j++;
    if (j==nd) {
      free(i);
      free(i_tr);
      return NULL;
    }
    for (k=0;k<j;k++) i[k] = i_tr[nd-k-1] = 0;
    i[j]++;
    i_tr[nd-j-1]++;
  } else
    i_tr[nd-1]++;
  if (forcombcache.tr) return i_tr;
  return i;
}"""
needs['try_pyarr_from_string'] = ['STRINGCOPYN', 'PRINTPYOBJERR', 'string']
cfuncs['try_pyarr_from_string'] = """\
static int try_pyarr_from_string(PyObject *obj,const string str) {
\tPyArrayObject *arr = NULL;
\tif (PyArray_Check(obj) && (!((arr = (PyArrayObject *)obj) == NULL)))
\t\t{ STRINGCOPYN(PyArray_DATA(arr),str,PyArray_NBYTES(arr)); }
\treturn 1;
capi_fail:
\tPRINTPYOBJERR(obj);
\tPyErr_SetString(#modulename#_error,\"try_pyarr_from_string failed\");
\treturn 0;
}
"""
needs['string_from_pyobj'] = ['string', 'STRINGMALLOC', 'STRINGCOPYN']
cfuncs['string_from_pyobj'] = """\
static int string_from_pyobj(string *str,int *len,const string inistr,PyObject *obj,const char *errmess) {
\tPyArrayObject *arr = NULL;
\tPyObject *tmp = NULL;
#ifdef DEBUGCFUNCS
fprintf(stderr,\"string_from_pyobj(str='%s',len=%d,inistr='%s',obj=%p)\\n\",(char*)str,*len,(char *)inistr,obj);
#endif
\tif (obj == Py_None) {
\t\tif (*len == -1)
\t\t\t*len = strlen(inistr); /* Will this cause problems? */
\t\tSTRINGMALLOC(*str,*len);
\t\tSTRINGCOPYN(*str,inistr,*len+1);
\t\treturn 1;
\t}
\tif (PyArray_Check(obj)) {
\t\tif ((arr = (PyArrayObject *)obj) == NULL)
\t\t\tgoto capi_fail;
\t\tif (!ISCONTIGUOUS(arr)) {
\t\t\tPyErr_SetString(PyExc_ValueError,\"array object is non-contiguous.\");
\t\t\tgoto capi_fail;
\t\t}
\t\tif (*len == -1)
\t\t\t*len = (PyArray_ITEMSIZE(arr))*PyArray_SIZE(arr);
\t\tSTRINGMALLOC(*str,*len);
\t\tSTRINGCOPYN(*str,PyArray_DATA(arr),*len+1);
\t\treturn 1;
\t}
\tif (PyString_Check(obj)) {
\t\ttmp = obj;
\t\tPy_INCREF(tmp);
\t}
#if PY_VERSION_HEX >= 0x03000000
\telse if (PyUnicode_Check(obj)) {
\t\ttmp = PyUnicode_AsASCIIString(obj);
\t}
\telse {
\t\tPyObject *tmp2;
\t\ttmp2 = PyObject_Str(obj);
\t\tif (tmp2) {
\t\t\ttmp = PyUnicode_AsASCIIString(tmp2);
\t\t\tPy_DECREF(tmp2);
\t\t}
\t\telse {
\t\t\ttmp = NULL;
\t\t}
\t}
#else
\telse {
\t\ttmp = PyObject_Str(obj);
\t}
#endif
\tif (tmp == NULL) goto capi_fail;
\tif (*len == -1)
\t\t*len = PyString_GET_SIZE(tmp);
\tSTRINGMALLOC(*str,*len);
\tSTRINGCOPYN(*str,PyString_AS_STRING(tmp),*len+1);
\tPy_DECREF(tmp);
\treturn 1;
capi_fail:
\tPy_XDECREF(tmp);
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL) err = #modulename#_error;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
needs['char_from_pyobj'] = ['int_from_pyobj']
cfuncs['char_from_pyobj'] = """\
static int char_from_pyobj(char* v,PyObject *obj,const char *errmess) {
\tint i=0;
\tif (int_from_pyobj(&i,obj,errmess)) {
\t\t*v = (char)i;
\t\treturn 1;
\t}
\treturn 0;
}
"""
needs['signed_char_from_pyobj'] = ['int_from_pyobj', 'signed_char']
cfuncs['signed_char_from_pyobj'] = """\
static int signed_char_from_pyobj(signed_char* v,PyObject *obj,const char *errmess) {
\tint i=0;
\tif (int_from_pyobj(&i,obj,errmess)) {
\t\t*v = (signed_char)i;
\t\treturn 1;
\t}
\treturn 0;
}
"""
needs['short_from_pyobj'] = ['int_from_pyobj']
cfuncs['short_from_pyobj'] = """\
static int short_from_pyobj(short* v,PyObject *obj,const char *errmess) {
\tint i=0;
\tif (int_from_pyobj(&i,obj,errmess)) {
\t\t*v = (short)i;
\t\treturn 1;
\t}
\treturn 0;
}
"""
cfuncs['int_from_pyobj'] = """\
static int int_from_pyobj(int* v,PyObject *obj,const char *errmess) {
\tPyObject* tmp = NULL;
\tif (PyInt_Check(obj)) {
\t\t*v = (int)PyInt_AS_LONG(obj);
\t\treturn 1;
\t}
\ttmp = PyNumber_Int(obj);
\tif (tmp) {
\t\t*v = PyInt_AS_LONG(tmp);
\t\tPy_DECREF(tmp);
\t\treturn 1;
\t}
\tif (PyComplex_Check(obj))
\t\ttmp = PyObject_GetAttrString(obj,\"real\");
\telse if (PyString_Check(obj) || PyUnicode_Check(obj))
\t\t/*pass*/;
\telse if (PySequence_Check(obj))
\t\ttmp = PySequence_GetItem(obj,0);
\tif (tmp) {
\t\tPyErr_Clear();
\t\tif (int_from_pyobj(v,tmp,errmess)) {Py_DECREF(tmp); return 1;}
\t\tPy_DECREF(tmp);
\t}
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL) err = #modulename#_error;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
cfuncs['long_from_pyobj'] = """\
static int long_from_pyobj(long* v,PyObject *obj,const char *errmess) {
\tPyObject* tmp = NULL;
\tif (PyInt_Check(obj)) {
\t\t*v = PyInt_AS_LONG(obj);
\t\treturn 1;
\t}
\ttmp = PyNumber_Int(obj);
\tif (tmp) {
\t\t*v = PyInt_AS_LONG(tmp);
\t\tPy_DECREF(tmp);
\t\treturn 1;
\t}
\tif (PyComplex_Check(obj))
\t\ttmp = PyObject_GetAttrString(obj,\"real\");
\telse if (PyString_Check(obj) || PyUnicode_Check(obj))
\t\t/*pass*/;
\telse if (PySequence_Check(obj))
\t\ttmp = PySequence_GetItem(obj,0);
\tif (tmp) {
\t\tPyErr_Clear();
\t\tif (long_from_pyobj(v,tmp,errmess)) {Py_DECREF(tmp); return 1;}
\t\tPy_DECREF(tmp);
\t}
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL) err = #modulename#_error;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
needs['long_long_from_pyobj'] = ['long_long']
cfuncs['long_long_from_pyobj'] = """\
static int long_long_from_pyobj(long_long* v,PyObject *obj,const char *errmess) {
\tPyObject* tmp = NULL;
\tif (PyLong_Check(obj)) {
\t\t*v = PyLong_AsLongLong(obj);
\t\treturn (!PyErr_Occurred());
\t}
\tif (PyInt_Check(obj)) {
\t\t*v = (long_long)PyInt_AS_LONG(obj);
\t\treturn 1;
\t}
\ttmp = PyNumber_Long(obj);
\tif (tmp) {
\t\t*v = PyLong_AsLongLong(tmp);
\t\tPy_DECREF(tmp);
\t\treturn (!PyErr_Occurred());
\t}
\tif (PyComplex_Check(obj))
\t\ttmp = PyObject_GetAttrString(obj,\"real\");
\telse if (PyString_Check(obj) || PyUnicode_Check(obj))
\t\t/*pass*/;
\telse if (PySequence_Check(obj))
\t\ttmp = PySequence_GetItem(obj,0);
\tif (tmp) {
\t\tPyErr_Clear();
\t\tif (long_long_from_pyobj(v,tmp,errmess)) {Py_DECREF(tmp); return 1;}
\t\tPy_DECREF(tmp);
\t}
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL) err = #modulename#_error;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
needs['long_double_from_pyobj'] = ['double_from_pyobj', 'long_double']
cfuncs['long_double_from_pyobj'] = """\
static int long_double_from_pyobj(long_double* v,PyObject *obj,const char *errmess) {
\tdouble d=0;
\tif (PyArray_CheckScalar(obj)){
\t\tif PyArray_IsScalar(obj, LongDouble) {
\t\t\tPyArray_ScalarAsCtype(obj, v);
\t\t\treturn 1;
\t\t}
\t\telse if (PyArray_Check(obj) && PyArray_TYPE(obj)==NPY_LONGDOUBLE) {
\t\t\t(*v) = *((npy_longdouble *)PyArray_DATA(obj));
\t\t\treturn 1;
\t\t}
\t}
\tif (double_from_pyobj(&d,obj,errmess)) {
\t\t*v = (long_double)d;
\t\treturn 1;
\t}
\treturn 0;
}
"""
cfuncs['double_from_pyobj'] = """\
static int double_from_pyobj(double* v,PyObject *obj,const char *errmess) {
\tPyObject* tmp = NULL;
\tif (PyFloat_Check(obj)) {
#ifdef __sgi
\t\t*v = PyFloat_AsDouble(obj);
#else
\t\t*v = PyFloat_AS_DOUBLE(obj);
#endif
\t\treturn 1;
\t}
\ttmp = PyNumber_Float(obj);
\tif (tmp) {
#ifdef __sgi
\t\t*v = PyFloat_AsDouble(tmp);
#else
\t\t*v = PyFloat_AS_DOUBLE(tmp);
#endif
\t\tPy_DECREF(tmp);
\t\treturn 1;
\t}
\tif (PyComplex_Check(obj))
\t\ttmp = PyObject_GetAttrString(obj,\"real\");
\telse if (PyString_Check(obj) || PyUnicode_Check(obj))
\t\t/*pass*/;
\telse if (PySequence_Check(obj))
\t\ttmp = PySequence_GetItem(obj,0);
\tif (tmp) {
\t\tPyErr_Clear();
\t\tif (double_from_pyobj(v,tmp,errmess)) {Py_DECREF(tmp); return 1;}
\t\tPy_DECREF(tmp);
\t}
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL) err = #modulename#_error;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
needs['float_from_pyobj'] = ['double_from_pyobj']
cfuncs['float_from_pyobj'] = """\
static int float_from_pyobj(float* v,PyObject *obj,const char *errmess) {
\tdouble d=0.0;
\tif (double_from_pyobj(&d,obj,errmess)) {
\t\t*v = (float)d;
\t\treturn 1;
\t}
\treturn 0;
}
"""
needs['complex_long_double_from_pyobj'] = ['complex_long_double', 'long_double',
                                           'complex_double_from_pyobj']
cfuncs['complex_long_double_from_pyobj'] = """\
static int complex_long_double_from_pyobj(complex_long_double* v,PyObject *obj,const char *errmess) {
\tcomplex_double cd={0.0,0.0};
\tif (PyArray_CheckScalar(obj)){
\t\tif PyArray_IsScalar(obj, CLongDouble) {
\t\t\tPyArray_ScalarAsCtype(obj, v);
\t\t\treturn 1;
\t\t}
\t\telse if (PyArray_Check(obj) && PyArray_TYPE(obj)==NPY_CLONGDOUBLE) {
\t\t\t(*v).r = ((npy_clongdouble *)PyArray_DATA(obj))->real;
\t\t\t(*v).i = ((npy_clongdouble *)PyArray_DATA(obj))->imag;
\t\t\treturn 1;
\t\t}
\t}
\tif (complex_double_from_pyobj(&cd,obj,errmess)) {
\t\t(*v).r = (long_double)cd.r;
\t\t(*v).i = (long_double)cd.i;
\t\treturn 1;
\t}
\treturn 0;
}
"""
needs['complex_double_from_pyobj'] = ['complex_double']
cfuncs['complex_double_from_pyobj'] = """\
static int complex_double_from_pyobj(complex_double* v,PyObject *obj,const char *errmess) {
\tPy_complex c;
\tif (PyComplex_Check(obj)) {
\t\tc=PyComplex_AsCComplex(obj);
\t\t(*v).r=c.real, (*v).i=c.imag;
\t\treturn 1;
\t}
\tif (PyArray_IsScalar(obj, ComplexFloating)) {
\t\tif (PyArray_IsScalar(obj, CFloat)) {
\t\t\tnpy_cfloat new;
\t\t\tPyArray_ScalarAsCtype(obj, &new);
\t\t\t(*v).r = (double)new.real;
\t\t\t(*v).i = (double)new.imag;
\t\t}
\t\telse if (PyArray_IsScalar(obj, CLongDouble)) {
\t\t\tnpy_clongdouble new;
\t\t\tPyArray_ScalarAsCtype(obj, &new);
\t\t\t(*v).r = (double)new.real;
\t\t\t(*v).i = (double)new.imag;
\t\t}
\t\telse { /* if (PyArray_IsScalar(obj, CDouble)) */
\t\t\tPyArray_ScalarAsCtype(obj, v);
\t\t}
\t\treturn 1;
\t}
\tif (PyArray_CheckScalar(obj)) { /* 0-dim array or still array scalar */
\t\tPyObject *arr;
\t\tif (PyArray_Check(obj)) {
\t\t\tarr = PyArray_Cast((PyArrayObject *)obj, NPY_CDOUBLE);
\t\t}
\t\telse {
\t\t\tarr = PyArray_FromScalar(obj, PyArray_DescrFromType(NPY_CDOUBLE));
\t\t}
\t\tif (arr==NULL) return 0;
\t\t(*v).r = ((npy_cdouble *)PyArray_DATA(arr))->real;
\t\t(*v).i = ((npy_cdouble *)PyArray_DATA(arr))->imag;
\t\treturn 1;
\t}
\t/* Python does not provide PyNumber_Complex function :-( */
\t(*v).i=0.0;
\tif (PyFloat_Check(obj)) {
#ifdef __sgi
\t\t(*v).r = PyFloat_AsDouble(obj);
#else
\t\t(*v).r = PyFloat_AS_DOUBLE(obj);
#endif
\t\treturn 1;
\t}
\tif (PyInt_Check(obj)) {
\t\t(*v).r = (double)PyInt_AS_LONG(obj);
\t\treturn 1;
\t}
\tif (PyLong_Check(obj)) {
\t\t(*v).r = PyLong_AsDouble(obj);
\t\treturn (!PyErr_Occurred());
\t}
\tif (PySequence_Check(obj) && !(PyString_Check(obj) || PyUnicode_Check(obj))) {
\t\tPyObject *tmp = PySequence_GetItem(obj,0);
\t\tif (tmp) {
\t\t\tif (complex_double_from_pyobj(v,tmp,errmess)) {
\t\t\t\tPy_DECREF(tmp);
\t\t\t\treturn 1;
\t\t\t}
\t\t\tPy_DECREF(tmp);
\t\t}
\t}
\t{
\t\tPyObject* err = PyErr_Occurred();
\t\tif (err==NULL)
\t\t\terr = PyExc_TypeError;
\t\tPyErr_SetString(err,errmess);
\t}
\treturn 0;
}
"""
needs['complex_float_from_pyobj'] = [
    'complex_float', 'complex_double_from_pyobj']
cfuncs['complex_float_from_pyobj'] = """\
static int complex_float_from_pyobj(complex_float* v,PyObject *obj,const char *errmess) {
\tcomplex_double cd={0.0,0.0};
\tif (complex_double_from_pyobj(&cd,obj,errmess)) {
\t\t(*v).r = (float)cd.r;
\t\t(*v).i = (float)cd.i;
\t\treturn 1;
\t}
\treturn 0;
}
"""
needs['try_pyarr_from_char'] = ['pyobj_from_char1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_char'] = 'static int try_pyarr_from_char(PyObject* obj,char* v) {\n\tTRYPYARRAYTEMPLATE(char,\'c\');\n}\n'
needs['try_pyarr_from_signed_char'] = ['TRYPYARRAYTEMPLATE', 'unsigned_char']
cfuncs[
    'try_pyarr_from_unsigned_char'] = 'static int try_pyarr_from_unsigned_char(PyObject* obj,unsigned_char* v) {\n\tTRYPYARRAYTEMPLATE(unsigned_char,\'b\');\n}\n'
needs['try_pyarr_from_signed_char'] = ['TRYPYARRAYTEMPLATE', 'signed_char']
cfuncs[
    'try_pyarr_from_signed_char'] = 'static int try_pyarr_from_signed_char(PyObject* obj,signed_char* v) {\n\tTRYPYARRAYTEMPLATE(signed_char,\'1\');\n}\n'
needs['try_pyarr_from_short'] = ['pyobj_from_short1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_short'] = 'static int try_pyarr_from_short(PyObject* obj,short* v) {\n\tTRYPYARRAYTEMPLATE(short,\'s\');\n}\n'
needs['try_pyarr_from_int'] = ['pyobj_from_int1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_int'] = 'static int try_pyarr_from_int(PyObject* obj,int* v) {\n\tTRYPYARRAYTEMPLATE(int,\'i\');\n}\n'
needs['try_pyarr_from_long'] = ['pyobj_from_long1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_long'] = 'static int try_pyarr_from_long(PyObject* obj,long* v) {\n\tTRYPYARRAYTEMPLATE(long,\'l\');\n}\n'
needs['try_pyarr_from_long_long'] = [
    'pyobj_from_long_long1', 'TRYPYARRAYTEMPLATE', 'long_long']
cfuncs[
    'try_pyarr_from_long_long'] = 'static int try_pyarr_from_long_long(PyObject* obj,long_long* v) {\n\tTRYPYARRAYTEMPLATE(long_long,\'L\');\n}\n'
needs['try_pyarr_from_float'] = ['pyobj_from_float1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_float'] = 'static int try_pyarr_from_float(PyObject* obj,float* v) {\n\tTRYPYARRAYTEMPLATE(float,\'f\');\n}\n'
needs['try_pyarr_from_double'] = ['pyobj_from_double1', 'TRYPYARRAYTEMPLATE']
cfuncs[
    'try_pyarr_from_double'] = 'static int try_pyarr_from_double(PyObject* obj,double* v) {\n\tTRYPYARRAYTEMPLATE(double,\'d\');\n}\n'
needs['try_pyarr_from_complex_float'] = [
    'pyobj_from_complex_float1', 'TRYCOMPLEXPYARRAYTEMPLATE', 'complex_float']
cfuncs[
    'try_pyarr_from_complex_float'] = 'static int try_pyarr_from_complex_float(PyObject* obj,complex_float* v) {\n\tTRYCOMPLEXPYARRAYTEMPLATE(float,\'F\');\n}\n'
needs['try_pyarr_from_complex_double'] = [
    'pyobj_from_complex_double1', 'TRYCOMPLEXPYARRAYTEMPLATE', 'complex_double']
cfuncs[
    'try_pyarr_from_complex_double'] = 'static int try_pyarr_from_complex_double(PyObject* obj,complex_double* v) {\n\tTRYCOMPLEXPYARRAYTEMPLATE(double,\'D\');\n}\n'

needs['create_cb_arglist'] = ['CFUNCSMESS', 'PRINTPYOBJERR', 'MINMAX']
cfuncs['create_cb_arglist'] = """\
static int create_cb_arglist(PyObject* fun,PyTupleObject* xa,const int maxnofargs,const int nofoptargs,int *nofargs,PyTupleObject **args,const char *errmess) {
\tPyObject *tmp = NULL;
\tPyObject *tmp_fun = NULL;
\tint tot,opt,ext,siz,i,di=0;
\tCFUNCSMESS(\"create_cb_arglist\\n\");
\ttot=opt=ext=siz=0;
\t/* Get the total number of arguments */
\tif (PyFunction_Check(fun))
\t\ttmp_fun = fun;
\telse {
\t\tdi = 1;
\t\tif (PyObject_HasAttrString(fun,\"im_func\")) {
\t\t\ttmp_fun = PyObject_GetAttrString(fun,\"im_func\");
\t\t}
\t\telse if (PyObject_HasAttrString(fun,\"__call__\")) {
\t\t\ttmp = PyObject_GetAttrString(fun,\"__call__\");
\t\t\tif (PyObject_HasAttrString(tmp,\"im_func\"))
\t\t\t\ttmp_fun = PyObject_GetAttrString(tmp,\"im_func\");
\t\t\telse {
\t\t\t\ttmp_fun = fun; /* built-in function */
\t\t\t\ttot = maxnofargs;
\t\t\t\tif (xa != NULL)
\t\t\t\t\ttot += PyTuple_Size((PyObject *)xa);
\t\t\t}
\t\t\tPy_XDECREF(tmp);
\t\t}
\t\telse if (PyFortran_Check(fun) || PyFortran_Check1(fun)) {
\t\t\ttot = maxnofargs;
\t\t\tif (xa != NULL)
\t\t\t\ttot += PyTuple_Size((PyObject *)xa);
\t\t\ttmp_fun = fun;
\t\t}
\t\telse if (F2PyCapsule_Check(fun)) {
\t\t\ttot = maxnofargs;
\t\t\tif (xa != NULL)
\t\t\t\text = PyTuple_Size((PyObject *)xa);
\t\t\tif(ext>0) {
\t\t\t\tfprintf(stderr,\"extra arguments tuple cannot be used with CObject call-back\\n\");
\t\t\t\tgoto capi_fail;
\t\t\t}
\t\t\ttmp_fun = fun;
\t\t}
\t}
if (tmp_fun==NULL) {
fprintf(stderr,\"Call-back argument must be function|instance|instance.__call__|f2py-function but got %s.\\n\",(fun==NULL?\"NULL\":Py_TYPE(fun)->tp_name));
goto capi_fail;
}
#if PY_VERSION_HEX >= 0x03000000
\tif (PyObject_HasAttrString(tmp_fun,\"__code__\")) {
\t\tif (PyObject_HasAttrString(tmp = PyObject_GetAttrString(tmp_fun,\"__code__\"),\"co_argcount\"))
#else
\tif (PyObject_HasAttrString(tmp_fun,\"func_code\")) {
\t\tif (PyObject_HasAttrString(tmp = PyObject_GetAttrString(tmp_fun,\"func_code\"),\"co_argcount\"))
#endif
\t\t\ttot = PyInt_AsLong(PyObject_GetAttrString(tmp,\"co_argcount\")) - di;
\t\tPy_XDECREF(tmp);
\t}
\t/* Get the number of optional arguments */
#if PY_VERSION_HEX >= 0x03000000
\tif (PyObject_HasAttrString(tmp_fun,\"__defaults__\")) {
\t\tif (PyTuple_Check(tmp = PyObject_GetAttrString(tmp_fun,\"__defaults__\")))
#else
\tif (PyObject_HasAttrString(tmp_fun,\"func_defaults\")) {
\t\tif (PyTuple_Check(tmp = PyObject_GetAttrString(tmp_fun,\"func_defaults\")))
#endif
\t\t\topt = PyTuple_Size(tmp);
\t\tPy_XDECREF(tmp);
\t}
\t/* Get the number of extra arguments */
\tif (xa != NULL)
\t\text = PyTuple_Size((PyObject *)xa);
\t/* Calculate the size of call-backs argument list */
\tsiz = MIN(maxnofargs+ext,tot);
\t*nofargs = MAX(0,siz-ext);
#ifdef DEBUGCFUNCS
\tfprintf(stderr,\"debug-capi:create_cb_arglist:maxnofargs(-nofoptargs),tot,opt,ext,siz,nofargs=%d(-%d),%d,%d,%d,%d,%d\\n\",maxnofargs,nofoptargs,tot,opt,ext,siz,*nofargs);
#endif
\tif (siz<tot-opt) {
\t\tfprintf(stderr,\"create_cb_arglist: Failed to build argument list (siz) with enough arguments (tot-opt) required by user-supplied function (siz,tot,opt=%d,%d,%d).\\n\",siz,tot,opt);
\t\tgoto capi_fail;
\t}
\t/* Initialize argument list */
\t*args = (PyTupleObject *)PyTuple_New(siz);
\tfor (i=0;i<*nofargs;i++) {
\t\tPy_INCREF(Py_None);
\t\tPyTuple_SET_ITEM((PyObject *)(*args),i,Py_None);
\t}
\tif (xa != NULL)
\t\tfor (i=(*nofargs);i<siz;i++) {
\t\t\ttmp = PyTuple_GetItem((PyObject *)xa,i-(*nofargs));
\t\t\tPy_INCREF(tmp);
\t\t\tPyTuple_SET_ITEM(*args,i,tmp);
\t\t}
\tCFUNCSMESS(\"create_cb_arglist-end\\n\");
\treturn 1;
capi_fail:
\tif ((PyErr_Occurred())==NULL)
\t\tPyErr_SetString(#modulename#_error,errmess);
\treturn 0;
}
"""


def buildcfuncs():
    from .capi_maps import c2capi_map
    for k in c2capi_map.keys():
        m = 'pyarr_from_p_%s1' % k
        cppmacros[
            m] = '#define %s(v) (PyArray_SimpleNewFromData(0,NULL,%s,(char *)v))' % (m, c2capi_map[k])
    k = 'string'
    m = 'pyarr_from_p_%s1' % k
    # NPY_CHAR compatibility, NPY_STRING with itemsize 1
    cppmacros[
        m] = '#define %s(v,dims) (PyArray_New(&PyArray_Type, 1, dims, NPY_STRING, NULL, v, 1, NPY_ARRAY_CARRAY, NULL))' % (m)


############ Auxiliary functions for sorting needs ###################

def append_needs(need, flag=1):
    global outneeds, needs
    if isinstance(need, list):
        for n in need:
            append_needs(n, flag)
    elif isinstance(need, str):
        if not need:
            return
        if need in includes0:
            n = 'includes0'
        elif need in includes:
            n = 'includes'
        elif need in typedefs:
            n = 'typedefs'
        elif need in typedefs_generated:
            n = 'typedefs_generated'
        elif need in cppmacros:
            n = 'cppmacros'
        elif need in cfuncs:
            n = 'cfuncs'
        elif need in callbacks:
            n = 'callbacks'
        elif need in f90modhooks:
            n = 'f90modhooks'
        elif need in commonhooks:
            n = 'commonhooks'
        else:
            errmess('append_needs: unknown need %s\n' % (repr(need)))
            return
        if need in outneeds[n]:
            return
        if flag:
            tmp = {}
            if need in needs:
                for nn in needs[need]:
                    t = append_needs(nn, 0)
                    if isinstance(t, dict):
                        for nnn in t.keys():
                            if nnn in tmp:
                                tmp[nnn] = tmp[nnn] + t[nnn]
                            else:
                                tmp[nnn] = t[nnn]
            for nn in tmp.keys():
                for nnn in tmp[nn]:
                    if nnn not in outneeds[nn]:
                        outneeds[nn] = [nnn] + outneeds[nn]
            outneeds[n].append(need)
        else:
            tmp = {}
            if need in needs:
                for nn in needs[need]:
                    t = append_needs(nn, flag)
                    if isinstance(t, dict):
                        for nnn in t.keys():
                            if nnn in tmp:
                                tmp[nnn] = t[nnn] + tmp[nnn]
                            else:
                                tmp[nnn] = t[nnn]
            if n not in tmp:
                tmp[n] = []
            tmp[n].append(need)
            return tmp
    else:
        errmess('append_needs: expected list or string but got :%s\n' %
                (repr(need)))


def get_needs():
    global outneeds, needs
    res = {}
    for n in outneeds.keys():
        out = []
        saveout = copy.copy(outneeds[n])
        while len(outneeds[n]) > 0:
            if outneeds[n][0] not in needs:
                out.append(outneeds[n][0])
                del outneeds[n][0]
            else:
                flag = 0
                for k in outneeds[n][1:]:
                    if k in needs[outneeds[n][0]]:
                        flag = 1
                        break
                if flag:
                    outneeds[n] = outneeds[n][1:] + [outneeds[n][0]]
                else:
                    out.append(outneeds[n][0])
                    del outneeds[n][0]
            if saveout and (0 not in map(lambda x, y: x == y, saveout, outneeds[n])) \
                    and outneeds[n] != []:
                print(n, saveout)
                errmess(
                    'get_needs: no progress in sorting needs, probably circular dependence, skipping.\n')
                out = out + saveout
                break
            saveout = copy.copy(outneeds[n])
        if out == []:
            out = [n]
        res[n] = out
    return res
