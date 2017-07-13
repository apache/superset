import sys
import warnings

import pandas.plotting as _plotting

# back-compat of public API
# deprecate these functions
m = sys.modules['pandas.tools.plotting']
for t in [t for t in dir(_plotting) if not t.startswith('_')]:

    def outer(t=t):

        def wrapper(*args, **kwargs):
            warnings.warn("'pandas.tools.plotting.{t}' is deprecated, "
                          "import 'pandas.plotting.{t}' instead.".format(t=t),
                          FutureWarning, stacklevel=2)
            return getattr(_plotting, t)(*args, **kwargs)
        return wrapper

    setattr(m, t, outer(t))
