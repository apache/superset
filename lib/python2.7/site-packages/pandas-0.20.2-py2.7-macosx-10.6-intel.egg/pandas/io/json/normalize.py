# ---------------------------------------------------------------------
# JSON normalization routines

import copy
from collections import defaultdict
import numpy as np

from pandas._libs.lib import convert_json_to_lines
from pandas import compat, DataFrame


def _convert_to_line_delimits(s):
    """Helper function that converts json lists to line delimited json."""

    # Determine we have a JSON list to turn to lines otherwise just return the
    # json object, only lists can
    if not s[0] == '[' and s[-1] == ']':
        return s
    s = s[1:-1]

    return convert_json_to_lines(s)


def nested_to_record(ds, prefix="", sep=".", level=0):
    """a simplified json_normalize

    converts a nested dict into a flat dict ("record"), unlike json_normalize,
    it does not attempt to extract a subset of the data.

    Parameters
    ----------
    ds : dict or list of dicts
    prefix: the prefix, optional, default: ""
    sep : string, default '.'
        Nested records will generate names separated by sep,
        e.g., for sep='.', { 'foo' : { 'bar' : 0 } } -> foo.bar

        .. versionadded:: 0.20.0

    level: the number of levels in the jason string, optional, default: 0

    Returns
    -------
    d - dict or list of dicts, matching `ds`

    Examples
    --------

    IN[52]: nested_to_record(dict(flat1=1,dict1=dict(c=1,d=2),
                                  nested=dict(e=dict(c=1,d=2),d=2)))
    Out[52]:
    {'dict1.c': 1,
     'dict1.d': 2,
     'flat1': 1,
     'nested.d': 2,
     'nested.e.c': 1,
     'nested.e.d': 2}
    """
    singleton = False
    if isinstance(ds, dict):
        ds = [ds]
        singleton = True

    new_ds = []
    for d in ds:

        new_d = copy.deepcopy(d)
        for k, v in d.items():
            # each key gets renamed with prefix
            if not isinstance(k, compat.string_types):
                k = str(k)
            if level == 0:
                newkey = k
            else:
                newkey = prefix + sep + k

            # only dicts gets recurse-flattend
            # only at level>1 do we rename the rest of the keys
            if not isinstance(v, dict):
                if level != 0:  # so we skip copying for top level, common case
                    v = new_d.pop(k)
                    new_d[newkey] = v
                continue
            else:
                v = new_d.pop(k)
                new_d.update(nested_to_record(v, newkey, sep, level + 1))
        new_ds.append(new_d)

    if singleton:
        return new_ds[0]
    return new_ds


def json_normalize(data, record_path=None, meta=None,
                   meta_prefix=None,
                   record_prefix=None,
                   errors='raise',
                   sep='.'):
    """
    "Normalize" semi-structured JSON data into a flat table

    Parameters
    ----------
    data : dict or list of dicts
        Unserialized JSON objects
    record_path : string or list of strings, default None
        Path in each object to list of records. If not passed, data will be
        assumed to be an array of records
    meta : list of paths (string or list of strings), default None
        Fields to use as metadata for each record in resulting table
    record_prefix : string, default None
        If True, prefix records with dotted (?) path, e.g. foo.bar.field if
        path to records is ['foo', 'bar']
    meta_prefix : string, default None
    errors : {'raise', 'ignore'}, default 'raise'

        * 'ignore' : will ignore KeyError if keys listed in meta are not
          always present
        * 'raise' : will raise KeyError if keys listed in meta are not
          always present

        .. versionadded:: 0.20.0

    sep : string, default '.'
        Nested records will generate names separated by sep,
        e.g., for sep='.', { 'foo' : { 'bar' : 0 } } -> foo.bar

        .. versionadded:: 0.20.0


    Returns
    -------
    frame : DataFrame

    Examples
    --------

    >>> data = [{'state': 'Florida',
    ...          'shortname': 'FL',
    ...          'info': {
    ...               'governor': 'Rick Scott'
    ...          },
    ...          'counties': [{'name': 'Dade', 'population': 12345},
    ...                      {'name': 'Broward', 'population': 40000},
    ...                      {'name': 'Palm Beach', 'population': 60000}]},
    ...         {'state': 'Ohio',
    ...          'shortname': 'OH',
    ...          'info': {
    ...               'governor': 'John Kasich'
    ...          },
    ...          'counties': [{'name': 'Summit', 'population': 1234},
    ...                       {'name': 'Cuyahoga', 'population': 1337}]}]
    >>> from pandas.io.json import json_normalize
    >>> result = json_normalize(data, 'counties', ['state', 'shortname',
    ...                                           ['info', 'governor']])
    >>> result
             name  population info.governor    state shortname
    0        Dade       12345    Rick Scott  Florida        FL
    1     Broward       40000    Rick Scott  Florida        FL
    2  Palm Beach       60000    Rick Scott  Florida        FL
    3      Summit        1234   John Kasich     Ohio        OH
    4    Cuyahoga        1337   John Kasich     Ohio        OH

    """
    def _pull_field(js, spec):
        result = js
        if isinstance(spec, list):
            for field in spec:
                result = result[field]
        else:
            result = result[spec]

        return result

    if isinstance(data, list) and len(data) is 0:
        return DataFrame()

    # A bit of a hackjob
    if isinstance(data, dict):
        data = [data]

    if record_path is None:
        if any([isinstance(x, dict) for x in compat.itervalues(data[0])]):
            # naive normalization, this is idempotent for flat records
            # and potentially will inflate the data considerably for
            # deeply nested structures:
            #  {VeryLong: { b: 1,c:2}} -> {VeryLong.b:1 ,VeryLong.c:@}
            #
            # TODO: handle record value which are lists, at least error
            #       reasonably
            data = nested_to_record(data, sep=sep)
        return DataFrame(data)
    elif not isinstance(record_path, list):
        record_path = [record_path]

    if meta is None:
        meta = []
    elif not isinstance(meta, list):
        meta = [meta]

    for i, x in enumerate(meta):
        if not isinstance(x, list):
            meta[i] = [x]

    # Disastrously inefficient for now
    records = []
    lengths = []

    meta_vals = defaultdict(list)
    if not isinstance(sep, compat.string_types):
        sep = str(sep)
    meta_keys = [sep.join(val) for val in meta]

    def _recursive_extract(data, path, seen_meta, level=0):
        if len(path) > 1:
            for obj in data:
                for val, key in zip(meta, meta_keys):
                    if level + 1 == len(val):
                        seen_meta[key] = _pull_field(obj, val[-1])

                _recursive_extract(obj[path[0]], path[1:],
                                   seen_meta, level=level + 1)
        else:
            for obj in data:
                recs = _pull_field(obj, path[0])

                # For repeating the metadata later
                lengths.append(len(recs))

                for val, key in zip(meta, meta_keys):
                    if level + 1 > len(val):
                        meta_val = seen_meta[key]
                    else:
                        try:
                            meta_val = _pull_field(obj, val[level:])
                        except KeyError as e:
                            if errors == 'ignore':
                                meta_val = np.nan
                            else:
                                raise \
                                    KeyError("Try running with "
                                             "errors='ignore' as key "
                                             "%s is not always present", e)
                    meta_vals[key].append(meta_val)

                records.extend(recs)

    _recursive_extract(data, record_path, {}, level=0)

    result = DataFrame(records)

    if record_prefix is not None:
        result.rename(columns=lambda x: record_prefix + x, inplace=True)

    # Data types, a problem
    for k, v in compat.iteritems(meta_vals):
        if meta_prefix is not None:
            k = meta_prefix + k

        if k in result:
            raise ValueError('Conflicting metadata name %s, '
                             'need distinguishing prefix ' % k)

        result[k] = np.array(v).repeat(lengths)

    return result
