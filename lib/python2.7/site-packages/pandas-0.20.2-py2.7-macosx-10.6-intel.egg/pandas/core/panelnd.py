""" Factory methods to create N-D panels """

import warnings
from pandas.compat import zip
import pandas.compat as compat


def create_nd_panel_factory(klass_name, orders, slices, slicer, aliases=None,
                            stat_axis=2, info_axis=0, ns=None):
    """ manufacture a n-d class:

    DEPRECATED. Panelnd is deprecated and will be removed in a future version.
    The recommended way to represent these types of n-dimensional data are with
    the `xarray package <http://xarray.pydata.org/en/stable/>`__.
    Pandas provides a `.to_xarray()` method to automate this conversion.

    Parameters
    ----------
    klass_name : the klass name
    orders : the names of the axes in order (highest to lowest)
    slices : a dictionary that defines how the axes map to the slice axis
    slicer : the class representing a slice of this panel
    aliases : a dictionary defining aliases for various axes
        default = { major : major_axis, minor : minor_axis }
    stat_axis : the default statistic axis default = 2
    info_axis : the info axis

    Returns
    -------
    a class object representing this panel
    """

    # if slicer is a name, get the object
    if isinstance(slicer, compat.string_types):
        import pandas
        try:
            slicer = getattr(pandas, slicer)
        except:
            raise Exception("cannot create this slicer [%s]" % slicer)

    # build the klass
    ns = {} if not ns else ns
    klass = type(klass_name, (slicer, ), ns)

    # setup the axes
    klass._setup_axes(axes=orders, info_axis=info_axis, stat_axis=stat_axis,
                      aliases=aliases, slicers=slices)

    klass._constructor_sliced = slicer

    # define the methods ####
    def __init__(self, *args, **kwargs):

        # deprecation GH13564
        warnings.warn("\n{klass} is deprecated and will be removed in a "
                      "future version.\nThe recommended way to represent "
                      "these types of n-dimensional data are with the\n"
                      "`xarray package "
                      "<http://xarray.pydata.org/en/stable/>`__.\n"
                      "Pandas provides a `.to_xarray()` method to help "
                      "automate this conversion.\n".format(
                          klass=self.__class__.__name__),
                      FutureWarning, stacklevel=2)

        if not (kwargs.get('data') or len(args)):
            raise Exception("must supply at least a data argument to [%s]" %
                            klass_name)
        if 'copy' not in kwargs:
            kwargs['copy'] = False
        if 'dtype' not in kwargs:
            kwargs['dtype'] = None
        self._init_data(*args, **kwargs)

    klass.__init__ = __init__

    def _get_plane_axes_index(self, axis):
        """ return the sliced index for this object """

        # TODO: axis_name is not used, remove?
        axis_name = self._get_axis_name(axis)  # noqa
        index = self._AXIS_ORDERS.index(axis)

        planes = []
        if index:
            planes.extend(self._AXIS_ORDERS[0:index])
        if index != self._AXIS_LEN:
            planes.extend(self._AXIS_ORDERS[index + 1:])

        return planes

    klass._get_plane_axes_index = _get_plane_axes_index

    def _combine(self, other, func, axis=0):
        if isinstance(other, klass):
            return self._combine_with_constructor(other, func)
        return super(klass, self)._combine(other, func, axis=axis)

    klass._combine = _combine

    def _combine_with_constructor(self, other, func):

        # combine labels to form new axes
        new_axes = []
        for a in self._AXIS_ORDERS:
            new_axes.append(getattr(self, a).union(getattr(other, a)))

        # reindex: could check that everything's the same size, but forget it
        d = dict([(a, ax) for a, ax in zip(self._AXIS_ORDERS, new_axes)])
        d['copy'] = False
        this = self.reindex(**d)
        other = other.reindex(**d)

        result_values = func(this.values, other.values)

        return self._constructor(result_values, **d)

    klass._combine_with_constructor = _combine_with_constructor

    # set as NonImplemented operations which we don't support
    for f in ['to_frame', 'to_excel', 'to_sparse', 'groupby', 'join', 'filter',
              'dropna', 'shift']:

        def func(self, *args, **kwargs):
            raise NotImplementedError("this operation is not supported")

        setattr(klass, f, func)

    # add the aggregate operations
    klass._add_aggregate_operations()
    klass._add_numeric_operations()

    return klass
