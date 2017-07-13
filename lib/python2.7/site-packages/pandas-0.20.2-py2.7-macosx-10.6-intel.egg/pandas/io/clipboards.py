""" io on the clipboard """
from pandas import compat, get_option, option_context, DataFrame
from pandas.compat import StringIO, PY2


def read_clipboard(sep='\s+', **kwargs):  # pragma: no cover
    r"""
    Read text from clipboard and pass to read_table. See read_table for the
    full argument list

    Parameters
    ----------
    sep : str, default '\s+'.
        A string or regex delimiter. The default of '\s+' denotes
        one or more whitespace characters.

    Returns
    -------
    parsed : DataFrame
    """
    encoding = kwargs.pop('encoding', 'utf-8')

    # only utf-8 is valid for passed value because that's what clipboard
    # supports
    if encoding is not None and encoding.lower().replace('-', '') != 'utf8':
        raise NotImplementedError(
            'reading from clipboard only supports utf-8 encoding')

    from pandas.io.clipboard import clipboard_get
    from pandas.io.parsers import read_table
    text = clipboard_get()

    # try to decode (if needed on PY3)
    # Strange. linux py33 doesn't complain, win py33 does
    if compat.PY3:
        try:
            text = compat.bytes_to_str(
                text, encoding=(kwargs.get('encoding') or
                                get_option('display.encoding'))
            )
        except:
            pass

    # Excel copies into clipboard with \t separation
    # inspect no more then the 10 first lines, if they
    # all contain an equal number (>0) of tabs, infer
    # that this came from excel and set 'sep' accordingly
    lines = text[:10000].split('\n')[:-1][:10]

    # Need to remove leading white space, since read_table
    # accepts:
    #    a  b
    # 0  1  2
    # 1  3  4

    counts = set([x.lstrip().count('\t') for x in lines])
    if len(lines) > 1 and len(counts) == 1 and counts.pop() != 0:
        sep = '\t'

    if sep is None and kwargs.get('delim_whitespace') is None:
        sep = '\s+'

    return read_table(StringIO(text), sep=sep, **kwargs)


def to_clipboard(obj, excel=None, sep=None, **kwargs):  # pragma: no cover
    """
    Attempt to write text representation of object to the system clipboard
    The clipboard can be then pasted into Excel for example.

    Parameters
    ----------
    obj : the object to write to the clipboard
    excel : boolean, defaults to True
            if True, use the provided separator, writing in a csv
            format for allowing easy pasting into excel.
            if False, write a string representation of the object
            to the clipboard
    sep : optional, defaults to tab
    other keywords are passed to to_csv

    Notes
    -----
    Requirements for your platform
      - Linux: xclip, or xsel (with gtk or PyQt4 modules)
      - Windows:
      - OS X:
    """
    encoding = kwargs.pop('encoding', 'utf-8')

    # testing if an invalid encoding is passed to clipboard
    if encoding is not None and encoding.lower().replace('-', '') != 'utf8':
        raise ValueError('clipboard only supports utf-8 encoding')

    from pandas.io.clipboard import clipboard_set
    if excel is None:
        excel = True

    if excel:
        try:
            if sep is None:
                sep = '\t'
            buf = StringIO()
            # clipboard_set (pyperclip) expects unicode
            obj.to_csv(buf, sep=sep, encoding='utf-8', **kwargs)
            text = buf.getvalue()
            if PY2:
                text = text.decode('utf-8')
            clipboard_set(text)
            return
        except:
            pass

    if isinstance(obj, DataFrame):
        # str(df) has various unhelpful defaults, like truncation
        with option_context('display.max_colwidth', 999999):
            objstr = obj.to_string(**kwargs)
    else:
        objstr = str(obj)
    clipboard_set(objstr)
