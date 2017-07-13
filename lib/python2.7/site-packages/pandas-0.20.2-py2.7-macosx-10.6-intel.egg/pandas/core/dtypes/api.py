# flake8: noqa

import sys

from .common import (pandas_dtype,
                     is_dtype_equal,
                     is_extension_type,

                     # categorical
                     is_categorical,
                     is_categorical_dtype,

                     # interval
                     is_interval,
                     is_interval_dtype,

                     # datetimelike
                     is_datetimetz,
                     is_datetime64_dtype,
                     is_datetime64tz_dtype,
                     is_datetime64_any_dtype,
                     is_datetime64_ns_dtype,
                     is_timedelta64_dtype,
                     is_timedelta64_ns_dtype,
                     is_period,
                     is_period_dtype,

                     # string-like
                     is_string_dtype,
                     is_object_dtype,

                     # sparse
                     is_sparse,

                     # numeric types
                     is_scalar,
                     is_sparse,
                     is_bool,
                     is_integer,
                     is_float,
                     is_complex,
                     is_number,
                     is_integer_dtype,
                     is_int64_dtype,
                     is_numeric_dtype,
                     is_float_dtype,
                     is_bool_dtype,
                     is_complex_dtype,
                     is_signed_integer_dtype,
                     is_unsigned_integer_dtype,

                     # like
                     is_re,
                     is_re_compilable,
                     is_dict_like,
                     is_iterator,
                     is_file_like,
                     is_list_like,
                     is_hashable,
                     is_named_tuple)


# deprecated
m = sys.modules['pandas.core.dtypes.api']

for t in ['is_any_int_dtype', 'is_floating_dtype', 'is_sequence']:

    def outer(t=t):

        def wrapper(arr_or_dtype):
            import warnings
            import pandas
            warnings.warn("{t} is deprecated and will be "
                          "removed in a future version".format(t=t),
                          FutureWarning, stacklevel=3)
            return getattr(pandas.core.dtypes.common, t)(arr_or_dtype)
        return wrapper

    setattr(m, t, outer(t))

del sys, m, t, outer
