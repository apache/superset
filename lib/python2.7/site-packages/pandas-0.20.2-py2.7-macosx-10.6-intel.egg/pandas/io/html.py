""":mod:`pandas.io.html` is a module containing functionality for dealing with
HTML IO.

"""

import os
import re
import numbers
import collections

from distutils.version import LooseVersion

import numpy as np

from pandas.core.dtypes.common import is_list_like
from pandas.errors import EmptyDataError
from pandas.io.common import (_is_url, urlopen,
                              parse_url, _validate_header_arg)
from pandas.io.parsers import TextParser
from pandas.compat import (lrange, lmap, u, string_types, iteritems,
                           raise_with_traceback, binary_type)
from pandas import Series
from pandas.core.common import AbstractMethodError
from pandas.io.formats.printing import pprint_thing

_IMPORTS = False
_HAS_BS4 = False
_HAS_LXML = False
_HAS_HTML5LIB = False


def _importers():
    # import things we need
    # but make this done on a first use basis

    global _IMPORTS
    if _IMPORTS:
        return

    _IMPORTS = True

    global _HAS_BS4, _HAS_LXML, _HAS_HTML5LIB

    try:
        import bs4  # noqa
        _HAS_BS4 = True
    except ImportError:
        pass

    try:
        import lxml  # noqa
        _HAS_LXML = True
    except ImportError:
        pass

    try:
        import html5lib  # noqa
        _HAS_HTML5LIB = True
    except ImportError:
        pass


#############
# READ HTML #
#############
_RE_WHITESPACE = re.compile(r'[\r\n]+|\s{2,}')


char_types = string_types + (binary_type,)


def _remove_whitespace(s, regex=_RE_WHITESPACE):
    """Replace extra whitespace inside of a string with a single space.

    Parameters
    ----------
    s : str or unicode
        The string from which to remove extra whitespace.

    regex : regex
        The regular expression to use to remove extra whitespace.

    Returns
    -------
    subd : str or unicode
        `s` with all extra whitespace replaced with a single space.
    """
    return regex.sub(' ', s.strip())


def _get_skiprows(skiprows):
    """Get an iterator given an integer, slice or container.

    Parameters
    ----------
    skiprows : int, slice, container
        The iterator to use to skip rows; can also be a slice.

    Raises
    ------
    TypeError
        * If `skiprows` is not a slice, integer, or Container

    Returns
    -------
    it : iterable
        A proper iterator to use to skip rows of a DataFrame.
    """
    if isinstance(skiprows, slice):
        return lrange(skiprows.start or 0, skiprows.stop, skiprows.step or 1)
    elif isinstance(skiprows, numbers.Integral) or is_list_like(skiprows):
        return skiprows
    elif skiprows is None:
        return 0
    raise TypeError('%r is not a valid type for skipping rows' %
                    type(skiprows).__name__)


def _read(obj):
    """Try to read from a url, file or string.

    Parameters
    ----------
    obj : str, unicode, or file-like

    Returns
    -------
    raw_text : str
    """
    if _is_url(obj):
        with urlopen(obj) as url:
            text = url.read()
    elif hasattr(obj, 'read'):
        text = obj.read()
    elif isinstance(obj, char_types):
        text = obj
        try:
            if os.path.isfile(text):
                with open(text, 'rb') as f:
                    return f.read()
        except (TypeError, ValueError):
            pass
    else:
        raise TypeError("Cannot read object of type %r" % type(obj).__name__)
    return text


class _HtmlFrameParser(object):
    """Base class for parsers that parse HTML into DataFrames.

    Parameters
    ----------
    io : str or file-like
        This can be either a string of raw HTML, a valid URL using the HTTP,
        FTP, or FILE protocols or a file-like object.

    match : str or regex
        The text to match in the document.

    attrs : dict
        List of HTML <table> element attributes to match.

    Attributes
    ----------
    io : str or file-like
        raw HTML, URL, or file-like object

    match : regex
        The text to match in the raw HTML

    attrs : dict-like
        A dictionary of valid table attributes to use to search for table
        elements.

    Notes
    -----
    To subclass this class effectively you must override the following methods:
        * :func:`_build_doc`
        * :func:`_text_getter`
        * :func:`_parse_td`
        * :func:`_parse_tables`
        * :func:`_parse_tr`
        * :func:`_parse_thead`
        * :func:`_parse_tbody`
        * :func:`_parse_tfoot`
    See each method's respective documentation for details on their
    functionality.
    """

    def __init__(self, io, match, attrs, encoding):
        self.io = io
        self.match = match
        self.attrs = attrs
        self.encoding = encoding

    def parse_tables(self):
        tables = self._parse_tables(self._build_doc(), self.match, self.attrs)
        return (self._build_table(table) for table in tables)

    def _parse_raw_data(self, rows):
        """Parse the raw data into a list of lists.

        Parameters
        ----------
        rows : iterable of node-like
            A list of row elements.

        text_getter : callable
            A callable that gets the text from an individual node. This must be
            defined by subclasses.

        column_finder : callable
            A callable that takes a row node as input and returns a list of the
            column node in that row. This must be defined by subclasses.

        Returns
        -------
        data : list of list of strings
        """
        data = [[_remove_whitespace(self._text_getter(col)) for col in
                 self._parse_td(row)] for row in rows]
        return data

    def _text_getter(self, obj):
        """Return the text of an individual DOM node.

        Parameters
        ----------
        obj : node-like
            A DOM node.

        Returns
        -------
        text : str or unicode
            The text from an individual DOM node.
        """
        raise AbstractMethodError(self)

    def _parse_td(self, obj):
        """Return the td elements from a row element.

        Parameters
        ----------
        obj : node-like

        Returns
        -------
        columns : list of node-like
            These are the elements of each row, i.e., the columns.
        """
        raise AbstractMethodError(self)

    def _parse_tables(self, doc, match, attrs):
        """Return all tables from the parsed DOM.

        Parameters
        ----------
        doc : tree-like
            The DOM from which to parse the table element.

        match : str or regular expression
            The text to search for in the DOM tree.

        attrs : dict
            A dictionary of table attributes that can be used to disambiguate
            mutliple tables on a page.

        Raises
        ------
        ValueError
            * If `match` does not match any text in the document.

        Returns
        -------
        tables : list of node-like
            A list of <table> elements to be parsed into raw data.
        """
        raise AbstractMethodError(self)

    def _parse_tr(self, table):
        """Return the list of row elements from the parsed table element.

        Parameters
        ----------
        table : node-like
            A table element that contains row elements.

        Returns
        -------
        rows : list of node-like
            A list row elements of a table, usually <tr> or <th> elements.
        """
        raise AbstractMethodError(self)

    def _parse_thead(self, table):
        """Return the header of a table.

        Parameters
        ----------
        table : node-like
            A table element that contains row elements.

        Returns
        -------
        thead : node-like
            A <thead>...</thead> element.
        """
        raise AbstractMethodError(self)

    def _parse_tbody(self, table):
        """Return the body of the table.

        Parameters
        ----------
        table : node-like
            A table element that contains row elements.

        Returns
        -------
        tbody : node-like
            A <tbody>...</tbody> element.
        """
        raise AbstractMethodError(self)

    def _parse_tfoot(self, table):
        """Return the footer of the table if any.

        Parameters
        ----------
        table : node-like
            A table element that contains row elements.

        Returns
        -------
        tfoot : node-like
            A <tfoot>...</tfoot> element.
        """
        raise AbstractMethodError(self)

    def _build_doc(self):
        """Return a tree-like object that can be used to iterate over the DOM.

        Returns
        -------
        obj : tree-like
        """
        raise AbstractMethodError(self)

    def _build_table(self, table):
        header = self._parse_raw_thead(table)
        body = self._parse_raw_tbody(table)
        footer = self._parse_raw_tfoot(table)
        return header, body, footer

    def _parse_raw_thead(self, table):
        thead = self._parse_thead(table)
        res = []
        if thead:
            trs = self._parse_tr(thead[0])
            for tr in trs:
                cols = lmap(self._text_getter, self._parse_td(tr))
                if any([col != '' for col in cols]):
                    res.append(cols)
        return res

    def _parse_raw_tfoot(self, table):
        tfoot = self._parse_tfoot(table)
        res = []
        if tfoot:
            res = lmap(self._text_getter, self._parse_td(tfoot[0]))
        return np.atleast_1d(
            np.array(res).squeeze()) if res and len(res) == 1 else res

    def _parse_raw_tbody(self, table):
        tbody = self._parse_tbody(table)

        try:
            res = self._parse_tr(tbody[0])
        except IndexError:
            res = self._parse_tr(table)
        return self._parse_raw_data(res)


class _BeautifulSoupHtml5LibFrameParser(_HtmlFrameParser):
    """HTML to DataFrame parser that uses BeautifulSoup under the hood.

    See Also
    --------
    pandas.io.html._HtmlFrameParser
    pandas.io.html._LxmlFrameParser

    Notes
    -----
    Documentation strings for this class are in the base class
    :class:`pandas.io.html._HtmlFrameParser`.
    """

    def __init__(self, *args, **kwargs):
        super(_BeautifulSoupHtml5LibFrameParser, self).__init__(*args,
                                                                **kwargs)
        from bs4 import SoupStrainer
        self._strainer = SoupStrainer('table')

    def _text_getter(self, obj):
        return obj.text

    def _parse_td(self, row):
        return row.find_all(('td', 'th'))

    def _parse_tr(self, element):
        return element.find_all('tr')

    def _parse_th(self, element):
        return element.find_all('th')

    def _parse_thead(self, table):
        return table.find_all('thead')

    def _parse_tbody(self, table):
        return table.find_all('tbody')

    def _parse_tfoot(self, table):
        return table.find_all('tfoot')

    def _parse_tables(self, doc, match, attrs):
        element_name = self._strainer.name
        tables = doc.find_all(element_name, attrs=attrs)

        if not tables:
            raise ValueError('No tables found')

        result = []
        unique_tables = set()

        for table in tables:
            if (table not in unique_tables and
                    table.find(text=match) is not None):
                result.append(table)
            unique_tables.add(table)

        if not result:
            raise ValueError("No tables found matching pattern %r" %
                             match.pattern)
        return result

    def _setup_build_doc(self):
        raw_text = _read(self.io)
        if not raw_text:
            raise ValueError('No text parsed from document: %s' % self.io)
        return raw_text

    def _build_doc(self):
        from bs4 import BeautifulSoup
        return BeautifulSoup(self._setup_build_doc(), features='html5lib',
                             from_encoding=self.encoding)


def _build_xpath_expr(attrs):
    """Build an xpath expression to simulate bs4's ability to pass in kwargs to
    search for attributes when using the lxml parser.

    Parameters
    ----------
    attrs : dict
        A dict of HTML attributes. These are NOT checked for validity.

    Returns
    -------
    expr : unicode
        An XPath expression that checks for the given HTML attributes.
    """
    # give class attribute as class_ because class is a python keyword
    if 'class_' in attrs:
        attrs['class'] = attrs.pop('class_')

    s = [u("@%s=%r") % (k, v) for k, v in iteritems(attrs)]
    return u('[%s]') % ' and '.join(s)


_re_namespace = {'re': 'http://exslt.org/regular-expressions'}
_valid_schemes = 'http', 'file', 'ftp'


class _LxmlFrameParser(_HtmlFrameParser):
    """HTML to DataFrame parser that uses lxml under the hood.

    Warning
    -------
    This parser can only handle HTTP, FTP, and FILE urls.

    See Also
    --------
    _HtmlFrameParser
    _BeautifulSoupLxmlFrameParser

    Notes
    -----
    Documentation strings for this class are in the base class
    :class:`_HtmlFrameParser`.
    """

    def __init__(self, *args, **kwargs):
        super(_LxmlFrameParser, self).__init__(*args, **kwargs)

    def _text_getter(self, obj):
        return obj.text_content()

    def _parse_td(self, row):
        return row.xpath('.//td|.//th')

    def _parse_tr(self, table):
        expr = './/tr[normalize-space()]'
        return table.xpath(expr)

    def _parse_tables(self, doc, match, kwargs):
        pattern = match.pattern

        # 1. check all descendants for the given pattern and only search tables
        # 2. go up the tree until we find a table
        query = '//table//*[re:test(text(), %r)]/ancestor::table'
        xpath_expr = u(query) % pattern

        # if any table attributes were given build an xpath expression to
        # search for them
        if kwargs:
            xpath_expr += _build_xpath_expr(kwargs)

        tables = doc.xpath(xpath_expr, namespaces=_re_namespace)

        if not tables:
            raise ValueError("No tables found matching regex %r" % pattern)
        return tables

    def _build_doc(self):
        """
        Raises
        ------
        ValueError
            * If a URL that lxml cannot parse is passed.

        Exception
            * Any other ``Exception`` thrown. For example, trying to parse a
              URL that is syntactically correct on a machine with no internet
              connection will fail.

        See Also
        --------
        pandas.io.html._HtmlFrameParser._build_doc
        """
        from lxml.html import parse, fromstring, HTMLParser
        from lxml.etree import XMLSyntaxError

        parser = HTMLParser(recover=False, encoding=self.encoding)

        try:
            # try to parse the input in the simplest way
            r = parse(self.io, parser=parser)

            try:
                r = r.getroot()
            except AttributeError:
                pass
        except (UnicodeDecodeError, IOError):
            # if the input is a blob of html goop
            if not _is_url(self.io):
                r = fromstring(self.io, parser=parser)

                try:
                    r = r.getroot()
                except AttributeError:
                    pass
            else:
                # not a url
                scheme = parse_url(self.io).scheme
                if scheme not in _valid_schemes:
                    # lxml can't parse it
                    msg = ('%r is not a valid url scheme, valid schemes are '
                           '%s') % (scheme, _valid_schemes)
                    raise ValueError(msg)
                else:
                    # something else happened: maybe a faulty connection
                    raise
        else:
            if not hasattr(r, 'text_content'):
                raise XMLSyntaxError("no text parsed from document", 0, 0, 0)
        return r

    def _parse_tbody(self, table):
        return table.xpath('.//tbody')

    def _parse_thead(self, table):
        return table.xpath('.//thead')

    def _parse_tfoot(self, table):
        return table.xpath('.//tfoot')

    def _parse_raw_thead(self, table):
        expr = './/thead'
        thead = table.xpath(expr)
        res = []
        if thead:
            trs = self._parse_tr(thead[0])
            for tr in trs:
                cols = [_remove_whitespace(x.text_content()) for x in
                        self._parse_td(tr)]
                if any([col != '' for col in cols]):
                    res.append(cols)
        return res

    def _parse_raw_tfoot(self, table):
        expr = './/tfoot//th|//tfoot//td'
        return [_remove_whitespace(x.text_content()) for x in
                table.xpath(expr)]


def _expand_elements(body):
    lens = Series(lmap(len, body))
    lens_max = lens.max()
    not_max = lens[lens != lens_max]

    empty = ['']
    for ind, length in iteritems(not_max):
        body[ind] += empty * (lens_max - length)


def _data_to_frame(**kwargs):
    head, body, foot = kwargs.pop('data')
    header = kwargs.pop('header')
    kwargs['skiprows'] = _get_skiprows(kwargs['skiprows'])
    if head:
        rows = lrange(len(head))
        body = head + body
        if header is None:  # special case when a table has <th> elements
            header = 0 if rows == [0] else rows

    if foot:
        body += [foot]

    # fill out elements of body that are "ragged"
    _expand_elements(body)
    tp = TextParser(body, header=header, **kwargs)
    df = tp.read()
    return df


_valid_parsers = {'lxml': _LxmlFrameParser, None: _LxmlFrameParser,
                  'html5lib': _BeautifulSoupHtml5LibFrameParser,
                  'bs4': _BeautifulSoupHtml5LibFrameParser}


def _parser_dispatch(flavor):
    """Choose the parser based on the input flavor.

    Parameters
    ----------
    flavor : str
        The type of parser to use. This must be a valid backend.

    Returns
    -------
    cls : _HtmlFrameParser subclass
        The parser class based on the requested input flavor.

    Raises
    ------
    ValueError
        * If `flavor` is not a valid backend.
    ImportError
        * If you do not have the requested `flavor`
    """
    valid_parsers = list(_valid_parsers.keys())
    if flavor not in valid_parsers:
        raise ValueError('%r is not a valid flavor, valid flavors are %s' %
                         (flavor, valid_parsers))

    if flavor in ('bs4', 'html5lib'):
        if not _HAS_HTML5LIB:
            raise ImportError("html5lib not found, please install it")
        if not _HAS_BS4:
            raise ImportError(
                "BeautifulSoup4 (bs4) not found, please install it")
        import bs4
        if bs4.__version__ == LooseVersion('4.2.0'):
            raise ValueError("You're using a version"
                             " of BeautifulSoup4 (4.2.0) that has been"
                             " known to cause problems on certain"
                             " operating systems such as Debian. "
                             "Please install a version of"
                             " BeautifulSoup4 != 4.2.0, both earlier"
                             " and later releases will work.")
    else:
        if not _HAS_LXML:
            raise ImportError("lxml not found, please install it")
    return _valid_parsers[flavor]


def _print_as_set(s):
    return '{%s}' % ', '.join([pprint_thing(el) for el in s])


def _validate_flavor(flavor):
    if flavor is None:
        flavor = 'lxml', 'bs4'
    elif isinstance(flavor, string_types):
        flavor = flavor,
    elif isinstance(flavor, collections.Iterable):
        if not all(isinstance(flav, string_types) for flav in flavor):
            raise TypeError('Object of type %r is not an iterable of strings' %
                            type(flavor).__name__)
    else:
        fmt = '{0!r}' if isinstance(flavor, string_types) else '{0}'
        fmt += ' is not a valid flavor'
        raise ValueError(fmt.format(flavor))

    flavor = tuple(flavor)
    valid_flavors = set(_valid_parsers)
    flavor_set = set(flavor)

    if not flavor_set & valid_flavors:
        raise ValueError('%s is not a valid set of flavors, valid flavors are '
                         '%s' % (_print_as_set(flavor_set),
                                 _print_as_set(valid_flavors)))
    return flavor


def _parse(flavor, io, match, attrs, encoding, **kwargs):
    flavor = _validate_flavor(flavor)
    compiled_match = re.compile(match)  # you can pass a compiled regex here

    # hack around python 3 deleting the exception variable
    retained = None
    for flav in flavor:
        parser = _parser_dispatch(flav)
        p = parser(io, compiled_match, attrs, encoding)

        try:
            tables = p.parse_tables()
        except Exception as caught:
            retained = caught
        else:
            break
    else:
        raise_with_traceback(retained)

    ret = []
    for table in tables:
        try:
            ret.append(_data_to_frame(data=table, **kwargs))
        except EmptyDataError:  # empty table
            continue
    return ret


def read_html(io, match='.+', flavor=None, header=None, index_col=None,
              skiprows=None, attrs=None, parse_dates=False,
              tupleize_cols=False, thousands=',', encoding=None,
              decimal='.', converters=None, na_values=None,
              keep_default_na=True):
    r"""Read HTML tables into a ``list`` of ``DataFrame`` objects.

    Parameters
    ----------
    io : str or file-like
        A URL, a file-like object, or a raw string containing HTML. Note that
        lxml only accepts the http, ftp and file url protocols. If you have a
        URL that starts with ``'https'`` you might try removing the ``'s'``.

    match : str or compiled regular expression, optional
        The set of tables containing text matching this regex or string will be
        returned. Unless the HTML is extremely simple you will probably need to
        pass a non-empty string here. Defaults to '.+' (match any non-empty
        string). The default value will return all tables contained on a page.
        This value is converted to a regular expression so that there is
        consistent behavior between Beautiful Soup and lxml.

    flavor : str or None, container of strings
        The parsing engine to use. 'bs4' and 'html5lib' are synonymous with
        each other, they are both there for backwards compatibility. The
        default of ``None`` tries to use ``lxml`` to parse and if that fails it
        falls back on ``bs4`` + ``html5lib``.

    header : int or list-like or None, optional
        The row (or list of rows for a :class:`~pandas.MultiIndex`) to use to
        make the columns headers.

    index_col : int or list-like or None, optional
        The column (or list of columns) to use to create the index.

    skiprows : int or list-like or slice or None, optional
        0-based. Number of rows to skip after parsing the column integer. If a
        sequence of integers or a slice is given, will skip the rows indexed by
        that sequence.  Note that a single element sequence means 'skip the nth
        row' whereas an integer means 'skip n rows'.

    attrs : dict or None, optional
        This is a dictionary of attributes that you can pass to use to identify
        the table in the HTML. These are not checked for validity before being
        passed to lxml or Beautiful Soup. However, these attributes must be
        valid HTML table attributes to work correctly. For example, ::

            attrs = {'id': 'table'}

        is a valid attribute dictionary because the 'id' HTML tag attribute is
        a valid HTML attribute for *any* HTML tag as per `this document
        <http://www.w3.org/TR/html-markup/global-attributes.html>`__. ::

            attrs = {'asdf': 'table'}

        is *not* a valid attribute dictionary because 'asdf' is not a valid
        HTML attribute even if it is a valid XML attribute.  Valid HTML 4.01
        table attributes can be found `here
        <http://www.w3.org/TR/REC-html40/struct/tables.html#h-11.2>`__. A
        working draft of the HTML 5 spec can be found `here
        <http://www.w3.org/TR/html-markup/table.html>`__. It contains the
        latest information on table attributes for the modern web.

    parse_dates : bool, optional
        See :func:`~pandas.read_csv` for more details.

    tupleize_cols : bool, optional
        If ``False`` try to parse multiple header rows into a
        :class:`~pandas.MultiIndex`, otherwise return raw tuples. Defaults to
        ``False``.

    thousands : str, optional
        Separator to use to parse thousands. Defaults to ``','``.

    encoding : str or None, optional
        The encoding used to decode the web page. Defaults to ``None``.``None``
        preserves the previous encoding behavior, which depends on the
        underlying parser library (e.g., the parser library will try to use
        the encoding provided by the document).

    decimal : str, default '.'
        Character to recognize as decimal point (e.g. use ',' for European
        data).

        .. versionadded:: 0.19.0

    converters : dict, default None
        Dict of functions for converting values in certain columns. Keys can
        either be integers or column labels, values are functions that take one
        input argument, the cell (not column) content, and return the
        transformed content.

        .. versionadded:: 0.19.0

    na_values : iterable, default None
        Custom NA values

        .. versionadded:: 0.19.0

    keep_default_na : bool, default True
        If na_values are specified and keep_default_na is False the default NaN
        values are overridden, otherwise they're appended to

        .. versionadded:: 0.19.0

    Returns
    -------
    dfs : list of DataFrames

    Notes
    -----
    Before using this function you should read the :ref:`gotchas about the
    HTML parsing libraries <io.html.gotchas>`.

    Expect to do some cleanup after you call this function. For example, you
    might need to manually assign column names if the column names are
    converted to NaN when you pass the `header=0` argument. We try to assume as
    little as possible about the structure of the table and push the
    idiosyncrasies of the HTML contained in the table to the user.

    This function searches for ``<table>`` elements and only for ``<tr>``
    and ``<th>`` rows and ``<td>`` elements within each ``<tr>`` or ``<th>``
    element in the table. ``<td>`` stands for "table data".

    Similar to :func:`~pandas.read_csv` the `header` argument is applied
    **after** `skiprows` is applied.

    This function will *always* return a list of :class:`DataFrame` *or*
    it will fail, e.g., it will *not* return an empty list.

    Examples
    --------
    See the :ref:`read_html documentation in the IO section of the docs
    <io.read_html>` for some examples of reading in HTML tables.

    See Also
    --------
    pandas.read_csv
    """
    _importers()

    # Type check here. We don't want to parse only to fail because of an
    # invalid value of an integer skiprows.
    if isinstance(skiprows, numbers.Integral) and skiprows < 0:
        raise ValueError('cannot skip rows starting from the end of the '
                         'data (you passed a negative value)')
    _validate_header_arg(header)
    return _parse(flavor=flavor, io=io, match=match, header=header,
                  index_col=index_col, skiprows=skiprows,
                  parse_dates=parse_dates, tupleize_cols=tupleize_cols,
                  thousands=thousands, attrs=attrs, encoding=encoding,
                  decimal=decimal, converters=converters, na_values=na_values,
                  keep_default_na=keep_default_na)
