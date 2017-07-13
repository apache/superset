"""
Msgpack serializer support for reading and writing pandas data structures
to disk

portions of msgpack_numpy package, by Lev Givon were incorporated
into this module (and tests_packers.py)

License
=======

Copyright (c) 2013, Lev Givon.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above
  copyright notice, this list of conditions and the following
  disclaimer in the documentation and/or other materials provided
  with the distribution.
* Neither the name of Lev Givon nor the names of any
  contributors may be used to endorse or promote products derived
  from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""

from datetime import datetime, date, timedelta
from dateutil.parser import parse
import os
from textwrap import dedent
import warnings

import numpy as np
from pandas import compat
from pandas.compat import u, u_safe

from pandas.core.dtypes.common import (
    is_categorical_dtype, is_object_dtype,
    needs_i8_conversion, pandas_dtype)

from pandas import (Timestamp, Period, Series, DataFrame,  # noqa
                    Index, MultiIndex, Float64Index, Int64Index,
                    Panel, RangeIndex, PeriodIndex, DatetimeIndex, NaT,
                    Categorical, CategoricalIndex)
from pandas._libs.tslib import NaTType
from pandas.core.sparse.api import SparseSeries, SparseDataFrame
from pandas.core.sparse.array import BlockIndex, IntIndex
from pandas.core.generic import NDFrame
from pandas.errors import PerformanceWarning
from pandas.io.common import get_filepath_or_buffer
from pandas.core.internals import BlockManager, make_block, _safe_reshape
import pandas.core.internals as internals

from pandas.io.msgpack import Unpacker as _Unpacker, Packer as _Packer, ExtType
from pandas.util._move import (
    BadMove as _BadMove,
    move_into_mutable_buffer as _move_into_mutable_buffer,
)

# check whcih compression libs we have installed
try:
    import zlib

    def _check_zlib():
        pass
except ImportError:
    def _check_zlib():
        raise ImportError('zlib is not installed')

_check_zlib.__doc__ = dedent(
    """\
    Check if zlib is installed.

    Raises
    ------
    ImportError
        Raised when zlib is not installed.
    """,
)

try:
    import blosc

    def _check_blosc():
        pass
except ImportError:
    def _check_blosc():
        raise ImportError('blosc is not installed')

_check_blosc.__doc__ = dedent(
    """\
    Check if blosc is installed.

    Raises
    ------
    ImportError
        Raised when blosc is not installed.
    """,
)

# until we can pass this into our conversion functions,
# this is pretty hacky
compressor = None


def to_msgpack(path_or_buf, *args, **kwargs):
    """
    msgpack (serialize) object to input file path

    THIS IS AN EXPERIMENTAL LIBRARY and the storage format
    may not be stable until a future release.

    Parameters
    ----------
    path_or_buf : string File path, buffer-like, or None
                  if None, return generated string
    args : an object or objects to serialize
    encoding: encoding for unicode objects
    append : boolean whether to append to an existing msgpack
             (default is False)
    compress : type of compressor (zlib or blosc), default to None (no
               compression)
    """
    global compressor
    compressor = kwargs.pop('compress', None)
    if compressor:
        compressor = u(compressor)
    append = kwargs.pop('append', None)
    if append:
        mode = 'a+b'
    else:
        mode = 'wb'

    def writer(fh):
        for a in args:
            fh.write(pack(a, **kwargs))

    if isinstance(path_or_buf, compat.string_types):
        with open(path_or_buf, mode) as fh:
            writer(fh)
    elif path_or_buf is None:
        buf = compat.BytesIO()
        writer(buf)
        return buf.getvalue()
    else:
        writer(path_or_buf)


def read_msgpack(path_or_buf, encoding='utf-8', iterator=False, **kwargs):
    """
    Load msgpack pandas object from the specified
    file path

    THIS IS AN EXPERIMENTAL LIBRARY and the storage format
    may not be stable until a future release.

    Parameters
    ----------
    path_or_buf : string File path, BytesIO like or string
    encoding: Encoding for decoding msgpack str type
    iterator : boolean, if True, return an iterator to the unpacker
               (default is False)

    Returns
    -------
    obj : type of object stored in file

    """
    path_or_buf, _, _ = get_filepath_or_buffer(path_or_buf)
    if iterator:
        return Iterator(path_or_buf)

    def read(fh):
        l = list(unpack(fh, encoding=encoding, **kwargs))
        if len(l) == 1:
            return l[0]
        return l

    # see if we have an actual file
    if isinstance(path_or_buf, compat.string_types):

        try:
            exists = os.path.exists(path_or_buf)
        except (TypeError, ValueError):
            exists = False

        if exists:
            with open(path_or_buf, 'rb') as fh:
                return read(fh)

    # treat as a binary-like
    if isinstance(path_or_buf, compat.binary_type):
        fh = None
        try:
            fh = compat.BytesIO(path_or_buf)
            return read(fh)
        finally:
            if fh is not None:
                fh.close()

    # a buffer like
    if hasattr(path_or_buf, 'read') and compat.callable(path_or_buf.read):
        return read(path_or_buf)

    raise ValueError('path_or_buf needs to be a string file path or file-like')


dtype_dict = {21: np.dtype('M8[ns]'),
              u('datetime64[ns]'): np.dtype('M8[ns]'),
              u('datetime64[us]'): np.dtype('M8[us]'),
              22: np.dtype('m8[ns]'),
              u('timedelta64[ns]'): np.dtype('m8[ns]'),
              u('timedelta64[us]'): np.dtype('m8[us]'),

              # this is platform int, which we need to remap to np.int64
              # for compat on windows platforms
              7: np.dtype('int64'),
              'category': 'category'
              }


def dtype_for(t):
    """ return my dtype mapping, whether number or name """
    if t in dtype_dict:
        return dtype_dict[t]
    return np.typeDict.get(t, t)


c2f_dict = {'complex': np.float64,
            'complex128': np.float64,
            'complex64': np.float32}

# numpy 1.6.1 compat
if hasattr(np, 'float128'):
    c2f_dict['complex256'] = np.float128


def c2f(r, i, ctype_name):
    """
    Convert strings to complex number instance with specified numpy type.
    """

    ftype = c2f_dict[ctype_name]
    return np.typeDict[ctype_name](ftype(r) + 1j * ftype(i))


def convert(values):
    """ convert the numpy values to a list """

    dtype = values.dtype

    if is_categorical_dtype(values):
        return values

    elif is_object_dtype(dtype):
        return values.ravel().tolist()

    if needs_i8_conversion(dtype):
        values = values.view('i8')
    v = values.ravel()

    if compressor == 'zlib':
        _check_zlib()

        # return string arrays like they are
        if dtype == np.object_:
            return v.tolist()

        # convert to a bytes array
        v = v.tostring()
        return ExtType(0, zlib.compress(v))

    elif compressor == 'blosc':
        _check_blosc()

        # return string arrays like they are
        if dtype == np.object_:
            return v.tolist()

        # convert to a bytes array
        v = v.tostring()
        return ExtType(0, blosc.compress(v, typesize=dtype.itemsize))

    # ndarray (on original dtype)
    return ExtType(0, v.tostring())


def unconvert(values, dtype, compress=None):

    as_is_ext = isinstance(values, ExtType) and values.code == 0

    if as_is_ext:
        values = values.data

    if is_categorical_dtype(dtype):
        return values

    elif is_object_dtype(dtype):
        return np.array(values, dtype=object)

    dtype = pandas_dtype(dtype).base

    if not as_is_ext:
        values = values.encode('latin1')

    if compress:
        if compress == u'zlib':
            _check_zlib()
            decompress = zlib.decompress
        elif compress == u'blosc':
            _check_blosc()
            decompress = blosc.decompress
        else:
            raise ValueError("compress must be one of 'zlib' or 'blosc'")

        try:
            return np.frombuffer(
                _move_into_mutable_buffer(decompress(values)),
                dtype=dtype,
            )
        except _BadMove as e:
            # Pull the decompressed data off of the `_BadMove` exception.
            # We don't just store this in the locals because we want to
            # minimize the risk of giving users access to a `bytes` object
            # whose data is also given to a mutable buffer.
            values = e.args[0]
            if len(values) > 1:
                # The empty string and single characters are memoized in many
                # string creating functions in the capi. This case should not
                # warn even though we need to make a copy because we are only
                # copying at most 1 byte.
                warnings.warn(
                    'copying data after decompressing; this may mean that'
                    ' decompress is caching its result',
                    PerformanceWarning,
                )
                # fall through to copying `np.fromstring`

    # Copy the string into a numpy array.
    return np.fromstring(values, dtype=dtype)


def encode(obj):
    """
    Data encoder
    """
    tobj = type(obj)
    if isinstance(obj, Index):
        if isinstance(obj, RangeIndex):
            return {u'typ': u'range_index',
                    u'klass': u(obj.__class__.__name__),
                    u'name': getattr(obj, 'name', None),
                    u'start': getattr(obj, '_start', None),
                    u'stop': getattr(obj, '_stop', None),
                    u'step': getattr(obj, '_step', None)}
        elif isinstance(obj, PeriodIndex):
            return {u'typ': u'period_index',
                    u'klass': u(obj.__class__.__name__),
                    u'name': getattr(obj, 'name', None),
                    u'freq': u_safe(getattr(obj, 'freqstr', None)),
                    u'dtype': u(obj.dtype.name),
                    u'data': convert(obj.asi8),
                    u'compress': compressor}
        elif isinstance(obj, DatetimeIndex):
            tz = getattr(obj, 'tz', None)

            # store tz info and data as UTC
            if tz is not None:
                tz = u(tz.zone)
                obj = obj.tz_convert('UTC')
            return {u'typ': u'datetime_index',
                    u'klass': u(obj.__class__.__name__),
                    u'name': getattr(obj, 'name', None),
                    u'dtype': u(obj.dtype.name),
                    u'data': convert(obj.asi8),
                    u'freq': u_safe(getattr(obj, 'freqstr', None)),
                    u'tz': tz,
                    u'compress': compressor}
        elif isinstance(obj, MultiIndex):
            return {u'typ': u'multi_index',
                    u'klass': u(obj.__class__.__name__),
                    u'names': getattr(obj, 'names', None),
                    u'dtype': u(obj.dtype.name),
                    u'data': convert(obj.values),
                    u'compress': compressor}
        else:
            return {u'typ': u'index',
                    u'klass': u(obj.__class__.__name__),
                    u'name': getattr(obj, 'name', None),
                    u'dtype': u(obj.dtype.name),
                    u'data': convert(obj.values),
                    u'compress': compressor}

    elif isinstance(obj, Categorical):
        return {u'typ': u'category',
                u'klass': u(obj.__class__.__name__),
                u'name': getattr(obj, 'name', None),
                u'codes': obj.codes,
                u'categories': obj.categories,
                u'ordered': obj.ordered,
                u'compress': compressor}

    elif isinstance(obj, Series):
        if isinstance(obj, SparseSeries):
            raise NotImplementedError(
                'msgpack sparse series is not implemented'
            )
            # d = {'typ': 'sparse_series',
            #     'klass': obj.__class__.__name__,
            #     'dtype': obj.dtype.name,
            #     'index': obj.index,
            #     'sp_index': obj.sp_index,
            #     'sp_values': convert(obj.sp_values),
            #     'compress': compressor}
            # for f in ['name', 'fill_value', 'kind']:
            #    d[f] = getattr(obj, f, None)
            # return d
        else:
            return {u'typ': u'series',
                    u'klass': u(obj.__class__.__name__),
                    u'name': getattr(obj, 'name', None),
                    u'index': obj.index,
                    u'dtype': u(obj.dtype.name),
                    u'data': convert(obj.values),
                    u'compress': compressor}
    elif issubclass(tobj, NDFrame):
        if isinstance(obj, SparseDataFrame):
            raise NotImplementedError(
                'msgpack sparse frame is not implemented'
            )
            # d = {'typ': 'sparse_dataframe',
            #     'klass': obj.__class__.__name__,
            #     'columns': obj.columns}
            # for f in ['default_fill_value', 'default_kind']:
            #    d[f] = getattr(obj, f, None)
            # d['data'] = dict([(name, ss)
            #                 for name, ss in compat.iteritems(obj)])
            # return d
        else:

            data = obj._data
            if not data.is_consolidated():
                data = data.consolidate()

            # the block manager
            return {u'typ': u'block_manager',
                    u'klass': u(obj.__class__.__name__),
                    u'axes': data.axes,
                    u'blocks': [{u'locs': b.mgr_locs.as_array,
                                 u'values': convert(b.values),
                                 u'shape': b.values.shape,
                                 u'dtype': u(b.dtype.name),
                                 u'klass': u(b.__class__.__name__),
                                 u'compress': compressor} for b in data.blocks]
                    }

    elif isinstance(obj, (datetime, date, np.datetime64, timedelta,
                          np.timedelta64, NaTType)):
        if isinstance(obj, Timestamp):
            tz = obj.tzinfo
            if tz is not None:
                tz = u(tz.zone)
            freq = obj.freq
            if freq is not None:
                freq = u(freq.freqstr)
            return {u'typ': u'timestamp',
                    u'value': obj.value,
                    u'freq': freq,
                    u'tz': tz}
        if isinstance(obj, NaTType):
            return {u'typ': u'nat'}
        elif isinstance(obj, np.timedelta64):
            return {u'typ': u'timedelta64',
                    u'data': obj.view('i8')}
        elif isinstance(obj, timedelta):
            return {u'typ': u'timedelta',
                    u'data': (obj.days, obj.seconds, obj.microseconds)}
        elif isinstance(obj, np.datetime64):
            return {u'typ': u'datetime64',
                    u'data': u(str(obj))}
        elif isinstance(obj, datetime):
            return {u'typ': u'datetime',
                    u'data': u(obj.isoformat())}
        elif isinstance(obj, date):
            return {u'typ': u'date',
                    u'data': u(obj.isoformat())}
        raise Exception("cannot encode this datetimelike object: %s" % obj)
    elif isinstance(obj, Period):
        return {u'typ': u'period',
                u'ordinal': obj.ordinal,
                u'freq': u(obj.freq)}
    elif isinstance(obj, BlockIndex):
        return {u'typ': u'block_index',
                u'klass': u(obj.__class__.__name__),
                u'blocs': obj.blocs,
                u'blengths': obj.blengths,
                u'length': obj.length}
    elif isinstance(obj, IntIndex):
        return {u'typ': u'int_index',
                u'klass': u(obj.__class__.__name__),
                u'indices': obj.indices,
                u'length': obj.length}
    elif isinstance(obj, np.ndarray):
        return {u'typ': u'ndarray',
                u'shape': obj.shape,
                u'ndim': obj.ndim,
                u'dtype': u(obj.dtype.name),
                u'data': convert(obj),
                u'compress': compressor}
    elif isinstance(obj, np.number):
        if np.iscomplexobj(obj):
            return {u'typ': u'np_scalar',
                    u'sub_typ': u'np_complex',
                    u'dtype': u(obj.dtype.name),
                    u'real': u(obj.real.__repr__()),
                    u'imag': u(obj.imag.__repr__())}
        else:
            return {u'typ': u'np_scalar',
                    u'dtype': u(obj.dtype.name),
                    u'data': u(obj.__repr__())}
    elif isinstance(obj, complex):
        return {u'typ': u'np_complex',
                u'real': u(obj.real.__repr__()),
                u'imag': u(obj.imag.__repr__())}

    return obj


def decode(obj):
    """
    Decoder for deserializing numpy data types.
    """

    typ = obj.get(u'typ')
    if typ is None:
        return obj
    elif typ == u'timestamp':
        freq = obj[u'freq'] if 'freq' in obj else obj[u'offset']
        return Timestamp(obj[u'value'], tz=obj[u'tz'], freq=freq)
    elif typ == u'nat':
        return NaT
    elif typ == u'period':
        return Period(ordinal=obj[u'ordinal'], freq=obj[u'freq'])
    elif typ == u'index':
        dtype = dtype_for(obj[u'dtype'])
        data = unconvert(obj[u'data'], dtype,
                         obj.get(u'compress'))
        return globals()[obj[u'klass']](data, dtype=dtype, name=obj[u'name'])
    elif typ == u'range_index':
        return globals()[obj[u'klass']](obj[u'start'],
                                        obj[u'stop'],
                                        obj[u'step'],
                                        name=obj[u'name'])
    elif typ == u'multi_index':
        dtype = dtype_for(obj[u'dtype'])
        data = unconvert(obj[u'data'], dtype,
                         obj.get(u'compress'))
        data = [tuple(x) for x in data]
        return globals()[obj[u'klass']].from_tuples(data, names=obj[u'names'])
    elif typ == u'period_index':
        data = unconvert(obj[u'data'], np.int64, obj.get(u'compress'))
        d = dict(name=obj[u'name'], freq=obj[u'freq'])
        return globals()[obj[u'klass']]._from_ordinals(data, **d)
    elif typ == u'datetime_index':
        data = unconvert(obj[u'data'], np.int64, obj.get(u'compress'))
        d = dict(name=obj[u'name'], freq=obj[u'freq'], verify_integrity=False)
        result = globals()[obj[u'klass']](data, **d)
        tz = obj[u'tz']

        # reverse tz conversion
        if tz is not None:
            result = result.tz_localize('UTC').tz_convert(tz)
        return result

    elif typ == u'category':
        from_codes = globals()[obj[u'klass']].from_codes
        return from_codes(codes=obj[u'codes'],
                          categories=obj[u'categories'],
                          ordered=obj[u'ordered'])

    elif typ == u'series':
        dtype = dtype_for(obj[u'dtype'])
        pd_dtype = pandas_dtype(dtype)

        index = obj[u'index']
        result = globals()[obj[u'klass']](unconvert(obj[u'data'], dtype,
                                                    obj[u'compress']),
                                          index=index,
                                          dtype=pd_dtype,
                                          name=obj[u'name'])
        return result

    elif typ == u'block_manager':
        axes = obj[u'axes']

        def create_block(b):
            values = _safe_reshape(unconvert(
                b[u'values'], dtype_for(b[u'dtype']),
                b[u'compress']), b[u'shape'])

            # locs handles duplicate column names, and should be used instead
            # of items; see GH 9618
            if u'locs' in b:
                placement = b[u'locs']
            else:
                placement = axes[0].get_indexer(b[u'items'])
            return make_block(values=values,
                              klass=getattr(internals, b[u'klass']),
                              placement=placement,
                              dtype=b[u'dtype'])

        blocks = [create_block(b) for b in obj[u'blocks']]
        return globals()[obj[u'klass']](BlockManager(blocks, axes))
    elif typ == u'datetime':
        return parse(obj[u'data'])
    elif typ == u'datetime64':
        return np.datetime64(parse(obj[u'data']))
    elif typ == u'date':
        return parse(obj[u'data']).date()
    elif typ == u'timedelta':
        return timedelta(*obj[u'data'])
    elif typ == u'timedelta64':
        return np.timedelta64(int(obj[u'data']))
    # elif typ == 'sparse_series':
    #    dtype = dtype_for(obj['dtype'])
    #    return globals()[obj['klass']](
    #        unconvert(obj['sp_values'], dtype, obj['compress']),
    #        sparse_index=obj['sp_index'], index=obj['index'],
    #        fill_value=obj['fill_value'], kind=obj['kind'], name=obj['name'])
    # elif typ == 'sparse_dataframe':
    #    return globals()[obj['klass']](
    #        obj['data'], columns=obj['columns'],
    #        default_fill_value=obj['default_fill_value'],
    #        default_kind=obj['default_kind']
    #    )
    # elif typ == 'sparse_panel':
    #    return globals()[obj['klass']](
    #        obj['data'], items=obj['items'],
    #        default_fill_value=obj['default_fill_value'],
    #        default_kind=obj['default_kind'])
    elif typ == u'block_index':
        return globals()[obj[u'klass']](obj[u'length'], obj[u'blocs'],
                                        obj[u'blengths'])
    elif typ == u'int_index':
        return globals()[obj[u'klass']](obj[u'length'], obj[u'indices'])
    elif typ == u'ndarray':
        return unconvert(obj[u'data'], np.typeDict[obj[u'dtype']],
                         obj.get(u'compress')).reshape(obj[u'shape'])
    elif typ == u'np_scalar':
        if obj.get(u'sub_typ') == u'np_complex':
            return c2f(obj[u'real'], obj[u'imag'], obj[u'dtype'])
        else:
            dtype = dtype_for(obj[u'dtype'])
            try:
                return dtype(obj[u'data'])
            except:
                return dtype.type(obj[u'data'])
    elif typ == u'np_complex':
        return complex(obj[u'real'] + u'+' + obj[u'imag'] + u'j')
    elif isinstance(obj, (dict, list, set)):
        return obj
    else:
        return obj


def pack(o, default=encode,
         encoding='utf-8', unicode_errors='strict', use_single_float=False,
         autoreset=1, use_bin_type=1):
    """
    Pack an object and return the packed bytes.
    """

    return Packer(default=default, encoding=encoding,
                  unicode_errors=unicode_errors,
                  use_single_float=use_single_float,
                  autoreset=autoreset,
                  use_bin_type=use_bin_type).pack(o)


def unpack(packed, object_hook=decode,
           list_hook=None, use_list=False, encoding='utf-8',
           unicode_errors='strict', object_pairs_hook=None,
           max_buffer_size=0, ext_hook=ExtType):
    """
    Unpack a packed object, return an iterator
    Note: packed lists will be returned as tuples
    """

    return Unpacker(packed, object_hook=object_hook,
                    list_hook=list_hook,
                    use_list=use_list, encoding=encoding,
                    unicode_errors=unicode_errors,
                    object_pairs_hook=object_pairs_hook,
                    max_buffer_size=max_buffer_size,
                    ext_hook=ext_hook)


class Packer(_Packer):

    def __init__(self, default=encode,
                 encoding='utf-8',
                 unicode_errors='strict',
                 use_single_float=False,
                 autoreset=1,
                 use_bin_type=1):
        super(Packer, self).__init__(default=default,
                                     encoding=encoding,
                                     unicode_errors=unicode_errors,
                                     use_single_float=use_single_float,
                                     autoreset=autoreset,
                                     use_bin_type=use_bin_type)


class Unpacker(_Unpacker):

    def __init__(self, file_like=None, read_size=0, use_list=False,
                 object_hook=decode,
                 object_pairs_hook=None, list_hook=None, encoding='utf-8',
                 unicode_errors='strict', max_buffer_size=0, ext_hook=ExtType):
        super(Unpacker, self).__init__(file_like=file_like,
                                       read_size=read_size,
                                       use_list=use_list,
                                       object_hook=object_hook,
                                       object_pairs_hook=object_pairs_hook,
                                       list_hook=list_hook,
                                       encoding=encoding,
                                       unicode_errors=unicode_errors,
                                       max_buffer_size=max_buffer_size,
                                       ext_hook=ext_hook)


class Iterator(object):

    """ manage the unpacking iteration,
        close the file on completion """

    def __init__(self, path, **kwargs):
        self.path = path
        self.kwargs = kwargs

    def __iter__(self):

        needs_closing = True
        try:

            # see if we have an actual file
            if isinstance(self.path, compat.string_types):

                try:
                    path_exists = os.path.exists(self.path)
                except TypeError:
                    path_exists = False

                if path_exists:
                    fh = open(self.path, 'rb')
                else:
                    fh = compat.BytesIO(self.path)

            else:

                if not hasattr(self.path, 'read'):
                    fh = compat.BytesIO(self.path)

                else:

                    # a file-like
                    needs_closing = False
                    fh = self.path

            unpacker = unpack(fh)
            for o in unpacker:
                yield o
        finally:
            if needs_closing:
                fh.close()
