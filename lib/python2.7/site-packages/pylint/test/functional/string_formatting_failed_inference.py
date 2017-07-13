""" Testing string format with a failed inference. This should not crash. """

import collections
"{dict[0]}".format(dict=collections.defaultdict(int))
