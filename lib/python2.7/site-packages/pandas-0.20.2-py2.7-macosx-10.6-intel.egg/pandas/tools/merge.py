import warnings


# back-compat of pseudo-public API
def concat_wrap():

    def wrapper(*args, **kwargs):
        warnings.warn("pandas.tools.merge.concat is deprecated. "
                      "import from the public API: "
                      "pandas.concat instead",
                      FutureWarning, stacklevel=3)
        import pandas as pd
        return pd.concat(*args, **kwargs)
    return wrapper


concat = concat_wrap()
