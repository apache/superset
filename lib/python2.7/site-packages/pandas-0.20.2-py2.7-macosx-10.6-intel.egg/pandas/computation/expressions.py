import warnings


def set_use_numexpr(v=True):
    warnings.warn("pandas.computation.expressions.set_use_numexpr is "
                  "deprecated and will be removed in a future version.\n"
                  "you can toggle usage of numexpr via "
                  "pandas.get_option('compute.use_numexpr')",
                  FutureWarning, stacklevel=2)
    from pandas import set_option
    set_option('compute.use_numexpr', v)
