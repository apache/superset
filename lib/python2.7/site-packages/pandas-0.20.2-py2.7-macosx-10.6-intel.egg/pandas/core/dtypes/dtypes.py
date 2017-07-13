""" define extension dtypes """

import re
import numpy as np
from pandas import compat


class ExtensionDtype(object):
    """
    A np.dtype duck-typed class, suitable for holding a custom dtype.

    THIS IS NOT A REAL NUMPY DTYPE
    """
    name = None
    names = None
    type = None
    subdtype = None
    kind = None
    str = None
    num = 100
    shape = tuple()
    itemsize = 8
    base = None
    isbuiltin = 0
    isnative = 0
    _metadata = []
    _cache = {}

    def __unicode__(self):
        return self.name

    def __str__(self):
        """
        Return a string representation for a particular Object

        Invoked by str(df) in both py2/py3.
        Yields Bytestring in Py2, Unicode String in py3.
        """

        if compat.PY3:
            return self.__unicode__()
        return self.__bytes__()

    def __bytes__(self):
        """
        Return a string representation for a particular object.

        Invoked by bytes(obj) in py3 only.
        Yields a bytestring in both py2/py3.
        """
        from pandas.core.config import get_option

        encoding = get_option("display.encoding")
        return self.__unicode__().encode(encoding, 'replace')

    def __repr__(self):
        """
        Return a string representation for a particular object.

        Yields Bytestring in Py2, Unicode String in py3.
        """
        return str(self)

    def __hash__(self):
        raise NotImplementedError("sub-classes should implement an __hash__ "
                                  "method")

    def __eq__(self, other):
        raise NotImplementedError("sub-classes should implement an __eq__ "
                                  "method")

    def __ne__(self, other):
        return not self.__eq__(other)

    def __getstate__(self):
        # pickle support; we don't want to pickle the cache
        return {k: getattr(self, k, None) for k in self._metadata}

    @classmethod
    def reset_cache(cls):
        """ clear the cache """
        cls._cache = {}

    @classmethod
    def is_dtype(cls, dtype):
        """ Return a boolean if the passed type is an actual dtype that
        we can match (via string or type)
        """
        if hasattr(dtype, 'dtype'):
            dtype = dtype.dtype
        if isinstance(dtype, np.dtype):
            return False
        elif dtype is None:
            return False
        elif isinstance(dtype, cls):
            return True
        try:
            return cls.construct_from_string(dtype) is not None
        except:
            return False


class CategoricalDtypeType(type):
    """
    the type of CategoricalDtype, this metaclass determines subclass ability
    """
    pass


class CategoricalDtype(ExtensionDtype):

    """
    A np.dtype duck-typed class, suitable for holding a custom categorical
    dtype.

    THIS IS NOT A REAL NUMPY DTYPE, but essentially a sub-class of np.object
    """
    name = 'category'
    type = CategoricalDtypeType
    kind = 'O'
    str = '|O08'
    base = np.dtype('O')
    _metadata = []
    _cache = {}

    def __new__(cls):

        try:
            return cls._cache[cls.name]
        except KeyError:
            c = object.__new__(cls)
            cls._cache[cls.name] = c
            return c

    def __hash__(self):
        # make myself hashable
        return hash(str(self))

    def __eq__(self, other):
        if isinstance(other, compat.string_types):
            return other == self.name

        return isinstance(other, CategoricalDtype)

    @classmethod
    def construct_from_string(cls, string):
        """ attempt to construct this type from a string, raise a TypeError if
        it's not possible """
        try:
            if string == 'category':
                return cls()
        except:
            pass

        raise TypeError("cannot construct a CategoricalDtype")


class DatetimeTZDtypeType(type):
    """
    the type of DatetimeTZDtype, this metaclass determines subclass ability
    """
    pass


class DatetimeTZDtype(ExtensionDtype):

    """
    A np.dtype duck-typed class, suitable for holding a custom datetime with tz
    dtype.

    THIS IS NOT A REAL NUMPY DTYPE, but essentially a sub-class of
    np.datetime64[ns]
    """
    type = DatetimeTZDtypeType
    kind = 'M'
    str = '|M8[ns]'
    num = 101
    base = np.dtype('M8[ns]')
    _metadata = ['unit', 'tz']
    _match = re.compile("(datetime64|M8)\[(?P<unit>.+), (?P<tz>.+)\]")
    _cache = {}

    def __new__(cls, unit=None, tz=None):
        """ Create a new unit if needed, otherwise return from the cache

        Parameters
        ----------
        unit : string unit that this represents, currently must be 'ns'
        tz : string tz that this represents
        """

        if isinstance(unit, DatetimeTZDtype):
            unit, tz = unit.unit, unit.tz

        elif unit is None:
            # we are called as an empty constructor
            # generally for pickle compat
            return object.__new__(cls)

        elif tz is None:

            # we were passed a string that we can construct
            try:
                m = cls._match.search(unit)
                if m is not None:
                    unit = m.groupdict()['unit']
                    tz = m.groupdict()['tz']
            except:
                raise ValueError("could not construct DatetimeTZDtype")

        elif isinstance(unit, compat.string_types):

            if unit != 'ns':
                raise ValueError("DatetimeTZDtype only supports ns units")

            unit = unit
            tz = tz

        if tz is None:
            raise ValueError("DatetimeTZDtype constructor must have a tz "
                             "supplied")

        # hash with the actual tz if we can
        # some cannot be hashed, so stringfy
        try:
            key = (unit, tz)
            hash(key)
        except TypeError:
            key = (unit, str(tz))

        # set/retrieve from cache
        try:
            return cls._cache[key]
        except KeyError:
            u = object.__new__(cls)
            u.unit = unit
            u.tz = tz
            cls._cache[key] = u
            return u

    @classmethod
    def construct_from_string(cls, string):
        """ attempt to construct this type from a string, raise a TypeError if
        it's not possible
        """
        try:
            return cls(unit=string)
        except ValueError:
            raise TypeError("could not construct DatetimeTZDtype")

    def __unicode__(self):
        # format the tz
        return "datetime64[{unit}, {tz}]".format(unit=self.unit, tz=self.tz)

    @property
    def name(self):
        return str(self)

    def __hash__(self):
        # make myself hashable
        return hash(str(self))

    def __eq__(self, other):
        if isinstance(other, compat.string_types):
            return other == self.name

        return (isinstance(other, DatetimeTZDtype) and
                self.unit == other.unit and
                str(self.tz) == str(other.tz))


class PeriodDtypeType(type):
    """
    the type of PeriodDtype, this metaclass determines subclass ability
    """
    pass


class PeriodDtype(ExtensionDtype):
    __metaclass__ = PeriodDtypeType
    """
    A Period duck-typed class, suitable for holding a period with freq dtype.

    THIS IS NOT A REAL NUMPY DTYPE, but essentially a sub-class of np.int64.
    """
    type = PeriodDtypeType
    kind = 'O'
    str = '|O08'
    base = np.dtype('O')
    num = 102
    _metadata = ['freq']
    _match = re.compile("(P|p)eriod\[(?P<freq>.+)\]")
    _cache = {}

    def __new__(cls, freq=None):
        """
        Parameters
        ----------
        freq : frequency
        """

        if isinstance(freq, PeriodDtype):
            return freq

        elif freq is None:
            # empty constructor for pickle compat
            return object.__new__(cls)

        from pandas.tseries.offsets import DateOffset
        if not isinstance(freq, DateOffset):
            freq = cls._parse_dtype_strict(freq)

        try:
            return cls._cache[freq.freqstr]
        except KeyError:
            u = object.__new__(cls)
            u.freq = freq
            cls._cache[freq.freqstr] = u
            return u

    @classmethod
    def _parse_dtype_strict(cls, freq):
        if isinstance(freq, compat.string_types):
            if freq.startswith('period[') or freq.startswith('Period['):
                m = cls._match.search(freq)
                if m is not None:
                    freq = m.group('freq')
            from pandas.tseries.frequencies import to_offset
            freq = to_offset(freq)
            if freq is not None:
                return freq

        raise ValueError("could not construct PeriodDtype")

    @classmethod
    def construct_from_string(cls, string):
        """
        attempt to construct this type from a string, raise a TypeError
        if its not possible
        """
        from pandas.tseries.offsets import DateOffset
        if isinstance(string, (compat.string_types, DateOffset)):
            # avoid tuple to be regarded as freq
            try:
                return cls(freq=string)
            except ValueError:
                pass
        raise TypeError("could not construct PeriodDtype")

    def __unicode__(self):
        return "period[{freq}]".format(freq=self.freq.freqstr)

    @property
    def name(self):
        return str(self)

    def __hash__(self):
        # make myself hashable
        return hash(str(self))

    def __eq__(self, other):
        if isinstance(other, compat.string_types):
            return other == self.name or other == self.name.title()

        return isinstance(other, PeriodDtype) and self.freq == other.freq

    @classmethod
    def is_dtype(cls, dtype):
        """
        Return a boolean if we if the passed type is an actual dtype that we
        can match (via string or type)
        """

        if isinstance(dtype, compat.string_types):
            # PeriodDtype can be instanciated from freq string like "U",
            # but dosn't regard freq str like "U" as dtype.
            if dtype.startswith('period[') or dtype.startswith('Period['):
                try:
                    if cls._parse_dtype_strict(dtype) is not None:
                        return True
                    else:
                        return False
                except ValueError:
                    return False
            else:
                return False
        return super(PeriodDtype, cls).is_dtype(dtype)


class IntervalDtypeType(type):
    """
    the type of IntervalDtype, this metaclass determines subclass ability
    """
    pass


class IntervalDtype(ExtensionDtype):
    __metaclass__ = IntervalDtypeType
    """
    A Interval duck-typed class, suitable for holding an interval

    THIS IS NOT A REAL NUMPY DTYPE
    """
    type = IntervalDtypeType
    kind = None
    str = '|O08'
    base = np.dtype('O')
    num = 103
    _metadata = ['subtype']
    _match = re.compile("(I|i)nterval\[(?P<subtype>.+)\]")
    _cache = {}

    def __new__(cls, subtype=None):
        """
        Parameters
        ----------
        subtype : the dtype of the Interval
        """

        if isinstance(subtype, IntervalDtype):
            return subtype
        elif subtype is None:
            # we are called as an empty constructor
            # generally for pickle compat
            u = object.__new__(cls)
            u.subtype = None
            return u
        elif (isinstance(subtype, compat.string_types) and
              subtype == 'interval'):
            subtype = ''
        else:
            if isinstance(subtype, compat.string_types):
                m = cls._match.search(subtype)
                if m is not None:
                    subtype = m.group('subtype')

            from pandas.core.dtypes.common import pandas_dtype
            try:
                subtype = pandas_dtype(subtype)
            except TypeError:
                raise ValueError("could not construct IntervalDtype")

        if subtype is None:
            u = object.__new__(cls)
            u.subtype = None
            return u

        try:
            return cls._cache[str(subtype)]
        except KeyError:
            u = object.__new__(cls)
            u.subtype = subtype
            cls._cache[str(subtype)] = u
            return u

    @classmethod
    def construct_from_string(cls, string):
        """
        attempt to construct this type from a string, raise a TypeError
        if its not possible
        """
        if isinstance(string, compat.string_types):
            try:
                return cls(string)
            except ValueError:
                pass
        raise TypeError("could not construct IntervalDtype")

    def __unicode__(self):
        if self.subtype is None:
            return "interval"
        return "interval[{subtype}]".format(subtype=self.subtype)

    @property
    def name(self):
        return str(self)

    def __hash__(self):
        # make myself hashable
        return hash(str(self))

    def __eq__(self, other):
        if isinstance(other, compat.string_types):
            return other == self.name or other == self.name.title()

        return (isinstance(other, IntervalDtype) and
                self.subtype == other.subtype)

    @classmethod
    def is_dtype(cls, dtype):
        """
        Return a boolean if we if the passed type is an actual dtype that we
        can match (via string or type)
        """

        if isinstance(dtype, compat.string_types):
            if dtype.lower().startswith('interval'):
                try:
                    if cls.construct_from_string(dtype) is not None:
                        return True
                    else:
                        return False
                except ValueError:
                    return False
            else:
                return False
        return super(IntervalDtype, cls).is_dtype(dtype)
