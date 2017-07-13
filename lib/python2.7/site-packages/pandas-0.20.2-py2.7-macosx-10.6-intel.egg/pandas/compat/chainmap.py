try:
    from collections import ChainMap
except ImportError:
    from pandas.compat.chainmap_impl import ChainMap


class DeepChainMap(ChainMap):

    def __setitem__(self, key, value):
        for mapping in self.maps:
            if key in mapping:
                mapping[key] = value
                return
        self.maps[0][key] = value

    def __delitem__(self, key):
        for mapping in self.maps:
            if key in mapping:
                del mapping[key]
                return
        raise KeyError(key)

    # override because the m parameter is introduced in Python 3.4
    def new_child(self, m=None):
        if m is None:
            m = {}
        return self.__class__(m, *self.maps)
