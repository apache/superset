"""
printing tools
"""

import sys
from pandas.core.dtypes.inference import is_sequence
from pandas import compat
from pandas.compat import u
from pandas.core.config import get_option


def adjoin(space, *lists, **kwargs):
    """
    Glues together two sets of strings using the amount of space requested.
    The idea is to prettify.

    ----------
    space : int
        number of spaces for padding
    lists : str
        list of str which being joined
    strlen : callable
        function used to calculate the length of each str. Needed for unicode
        handling.
    justfunc : callable
        function used to justify str. Needed for unicode handling.
    """
    strlen = kwargs.pop('strlen', len)
    justfunc = kwargs.pop('justfunc', justify)

    out_lines = []
    newLists = []
    lengths = [max(map(strlen, x)) + space for x in lists[:-1]]
    # not the last one
    lengths.append(max(map(len, lists[-1])))
    maxLen = max(map(len, lists))
    for i, lst in enumerate(lists):
        nl = justfunc(lst, lengths[i], mode='left')
        nl.extend([' ' * lengths[i]] * (maxLen - len(lst)))
        newLists.append(nl)
    toJoin = zip(*newLists)
    for lines in toJoin:
        out_lines.append(_join_unicode(lines))
    return _join_unicode(out_lines, sep='\n')


def justify(texts, max_len, mode='right'):
    """
    Perform ljust, center, rjust against string or list-like
    """
    if mode == 'left':
        return [x.ljust(max_len) for x in texts]
    elif mode == 'center':
        return [x.center(max_len) for x in texts]
    else:
        return [x.rjust(max_len) for x in texts]


def _join_unicode(lines, sep=''):
    try:
        return sep.join(lines)
    except UnicodeDecodeError:
        sep = compat.text_type(sep)
        return sep.join([x.decode('utf-8') if isinstance(x, str) else x
                         for x in lines])


# Unicode consolidation
# ---------------------
#
# pprinting utility functions for generating Unicode text or
# bytes(3.x)/str(2.x) representations of objects.
# Try to use these as much as possible rather then rolling your own.
#
# When to use
# -----------
#
# 1) If you're writing code internal to pandas (no I/O directly involved),
#    use pprint_thing().
#
#    It will always return unicode text which can handled by other
#    parts of the package without breakage.
#
# 2) If you need to send something to the console, use console_encode().
#
#    console_encode() should (hopefully) choose the right encoding for you
#    based on the encoding set in option "display.encoding"
#
# 3) if you need to write something out to file, use
#    pprint_thing_encoded(encoding).
#
#    If no encoding is specified, it defaults to utf-8. Since encoding pure
#    ascii with utf-8 is a no-op you can safely use the default utf-8 if you're
#    working with straight ascii.


def _pprint_seq(seq, _nest_lvl=0, max_seq_items=None, **kwds):
    """
    internal. pprinter for iterables. you should probably use pprint_thing()
    rather then calling this directly.

    bounds length of printed sequence, depending on options
    """
    if isinstance(seq, set):
        fmt = u("{%s}")
    else:
        fmt = u("[%s]") if hasattr(seq, '__setitem__') else u("(%s)")

    if max_seq_items is False:
        nitems = len(seq)
    else:
        nitems = max_seq_items or get_option("max_seq_items") or len(seq)

    s = iter(seq)
    r = []
    for i in range(min(nitems, len(seq))):  # handle sets, no slicing
        r.append(pprint_thing(
            next(s), _nest_lvl + 1, max_seq_items=max_seq_items, **kwds))
    body = ", ".join(r)

    if nitems < len(seq):
        body += ", ..."
    elif isinstance(seq, tuple) and len(seq) == 1:
        body += ','

    return fmt % body


def _pprint_dict(seq, _nest_lvl=0, max_seq_items=None, **kwds):
    """
    internal. pprinter for iterables. you should probably use pprint_thing()
    rather then calling this directly.
    """
    fmt = u("{%s}")
    pairs = []

    pfmt = u("%s: %s")

    if max_seq_items is False:
        nitems = len(seq)
    else:
        nitems = max_seq_items or get_option("max_seq_items") or len(seq)

    for k, v in list(seq.items())[:nitems]:
        pairs.append(pfmt %
                     (pprint_thing(k, _nest_lvl + 1,
                                   max_seq_items=max_seq_items, **kwds),
                      pprint_thing(v, _nest_lvl + 1,
                                   max_seq_items=max_seq_items, **kwds)))

    if nitems < len(seq):
        return fmt % (", ".join(pairs) + ", ...")
    else:
        return fmt % ", ".join(pairs)


def pprint_thing(thing, _nest_lvl=0, escape_chars=None, default_escapes=False,
                 quote_strings=False, max_seq_items=None):
    """
    This function is the sanctioned way of converting objects
    to a unicode representation.

    properly handles nested sequences containing unicode strings
    (unicode(object) does not)

    Parameters
    ----------
    thing : anything to be formatted
    _nest_lvl : internal use only. pprint_thing() is mutually-recursive
        with pprint_sequence, this argument is used to keep track of the
        current nesting level, and limit it.
    escape_chars : list or dict, optional
        Characters to escape. If a dict is passed the values are the
        replacements
    default_escapes : bool, default False
        Whether the input escape characters replaces or adds to the defaults
    max_seq_items : False, int, default None
        Pass thru to other pretty printers to limit sequence printing

    Returns
    -------
    result - unicode object on py2, str on py3. Always Unicode.

    """

    def as_escaped_unicode(thing, escape_chars=escape_chars):
        # Unicode is fine, else we try to decode using utf-8 and 'replace'
        # if that's not it either, we have no way of knowing and the user
        # should deal with it himself.

        try:
            result = compat.text_type(thing)  # we should try this first
        except UnicodeDecodeError:
            # either utf-8 or we replace errors
            result = str(thing).decode('utf-8', "replace")

        translate = {'\t': r'\t', '\n': r'\n', '\r': r'\r', }
        if isinstance(escape_chars, dict):
            if default_escapes:
                translate.update(escape_chars)
            else:
                translate = escape_chars
            escape_chars = list(escape_chars.keys())
        else:
            escape_chars = escape_chars or tuple()
        for c in escape_chars:
            result = result.replace(c, translate[c])

        return compat.text_type(result)

    if (compat.PY3 and hasattr(thing, '__next__')) or hasattr(thing, 'next'):
        return compat.text_type(thing)
    elif (isinstance(thing, dict) and
          _nest_lvl < get_option("display.pprint_nest_depth")):
        result = _pprint_dict(thing, _nest_lvl, quote_strings=True,
                              max_seq_items=max_seq_items)
    elif (is_sequence(thing) and
          _nest_lvl < get_option("display.pprint_nest_depth")):
        result = _pprint_seq(thing, _nest_lvl, escape_chars=escape_chars,
                             quote_strings=quote_strings,
                             max_seq_items=max_seq_items)
    elif isinstance(thing, compat.string_types) and quote_strings:
        if compat.PY3:
            fmt = "'%s'"
        else:
            fmt = "u'%s'"
        result = fmt % as_escaped_unicode(thing)
    else:
        result = as_escaped_unicode(thing)

    return compat.text_type(result)  # always unicode


def pprint_thing_encoded(object, encoding='utf-8', errors='replace', **kwds):
    value = pprint_thing(object)  # get unicode representation of object
    return value.encode(encoding, errors, **kwds)


def _enable_data_resource_formatter(enable):
    if 'IPython' not in sys.modules:
        # definitely not in IPython
        return
    from IPython import get_ipython
    ip = get_ipython()
    if ip is None:
        # still not in IPython
        return

    formatters = ip.display_formatter.formatters
    mimetype = "application/vnd.dataresource+json"

    if enable:
        if mimetype not in formatters:
            # define tableschema formatter
            from IPython.core.formatters import BaseFormatter

            class TableSchemaFormatter(BaseFormatter):
                print_method = '_repr_data_resource_'
                _return_type = (dict,)
            # register it:
            formatters[mimetype] = TableSchemaFormatter()
        # enable it if it's been disabled:
        formatters[mimetype].enabled = True
    else:
        # unregister tableschema mime-type
        if mimetype in formatters:
            formatters[mimetype].enabled = False
