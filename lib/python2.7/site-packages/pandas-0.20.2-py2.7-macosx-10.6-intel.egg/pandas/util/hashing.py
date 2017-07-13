import warnings
import sys

m = sys.modules['pandas.util.hashing']
for t in ['hash_pandas_object', 'hash_array']:

    def outer(t=t):

        def wrapper(*args, **kwargs):
            from pandas import util
            warnings.warn("pandas.util.hashing is deprecated and will be "
                          "removed in a future version, import "
                          "from pandas.util",
                          DeprecationWarning, stacklevel=3)
            return getattr(util, t)(*args, **kwargs)
        return wrapper

    setattr(m, t, outer(t))
