# -*- coding: utf-8 -*-
"""
    sphinx.util.smartypants
    ~~~~~~~~~~~~~~~~~~~~~~~

    This code is copied from docutils’ docutils/utils/smartquotes.py
    version 1.7.1 (from 2017-03-19). It should be removed in the future.

    :copyright: © 2010 Günter Milde,
                original `SmartyPants`_: © 2003 John Gruber
                smartypants.py:          © 2004, 2007 Chad Miller
    :license: Released under the terms of the `2-Clause BSD license`_, in short:

       Copying and distribution of this file, with or without modification,
       are permitted in any medium without royalty provided the copyright
       notices and this notice are preserved.
       This file is offered as-is, without any warranty.

    .. _SmartyPants: http://daringfireball.net/projects/smartypants/
    .. _2-Clause BSD license: http://www.spdx.org/licenses/BSD-2-Clause

    See the LICENSE file and the original docutils code for details.
"""
from __future__ import absolute_import, unicode_literals

import re
from docutils.utils import smartquotes
from sphinx.util.docutils import __version_info__ as docutils_version

if False:  # For type annotation
    from typing import Iterable, Iterator, Tuple  # NOQA


def educateQuotes(text, language='en'):
    # type: (unicode, unicode) -> unicode
    """
    Parameter:  - text string (unicode or bytes).
                - language (`BCP 47` language tag.)
    Returns:    The `text`, with "educated" curly quote characters.

    Example input:  "Isn't this fun?"
    Example output: “Isn’t this fun?“;
    """

    smart = smartquotes.smartchars(language)
    smart.apostrophe = u'’'

    # oldtext = text
    punct_class = r"""[!"#\$\%'()*+,-.\/:;<=>?\@\[\\\]\^_`{|}~]"""

    # Special case if the very first character is a quote
    # followed by punctuation at a non-word-break.
    # Close the quotes by brute force:
    text = re.sub(r"""^'(?=%s\\B)""" % (punct_class,), smart.csquote, text)
    text = re.sub(r"""^"(?=%s\\B)""" % (punct_class,), smart.cpquote, text)

    # Special case for double sets of quotes, e.g.:
    #   <p>He said, "'Quoted' words in a larger quote."</p>
    text = re.sub(r""""'(?=\w)""", smart.opquote + smart.osquote, text)
    text = re.sub(r"""'"(?=\w)""", smart.osquote + smart.opquote, text)

    # Special case for decade abbreviations (the '80s):
    text = re.sub(r"""\b'(?=\d{2}s)""", smart.csquote, text)

    close_class = r"""[^\ \t\r\n\[\{\(\-]"""
    dec_dashes = r"""&#8211;|&#8212;"""

    # Get most opening single quotes:
    opening_single_quotes_regex = re.compile(r"""
                    (
                            \s          |   # a whitespace char, or
                            &nbsp;      |   # a non-breaking space entity, or
                            --          |   # dashes, or
                            &[mn]dash;  |   # named dash entities
                            %s          |   # or decimal entities
                            &\#x201[34];    # or hex
                    )
                    '                 # the quote
                    (?=\w)            # followed by a word character
                    """ % (dec_dashes,), re.VERBOSE | re.UNICODE)
    text = opening_single_quotes_regex.sub(r'\1' + smart.osquote, text)

    # In many locales, single closing quotes are different from apostrophe:
    if smart.csquote != smart.apostrophe:
        apostrophe_regex = re.compile(r"(?<=(\w|\d))'(?=\w)", re.UNICODE)
        text = apostrophe_regex.sub(smart.apostrophe, text)

    closing_single_quotes_regex = re.compile(r"""
                    (%s)
                    '
                    (?!\s  |       # whitespace
                       s\b |
                        \d         # digits   ('80s)
                    )
                    """ % (close_class,), re.VERBOSE | re.UNICODE)
    text = closing_single_quotes_regex.sub(r'\1' + smart.csquote, text)

    closing_single_quotes_regex = re.compile(r"""
                    (%s)
                    '
                    (\s | s\b)
                    """ % (close_class,), re.VERBOSE | re.UNICODE)
    text = closing_single_quotes_regex.sub(r'\1%s\2' % smart.csquote, text)

    # Any remaining single quotes should be opening ones:
    text = re.sub(r"""'""", smart.osquote, text)

    # Get most opening double quotes:
    opening_double_quotes_regex = re.compile(r"""
                    (
                            \s          |   # a whitespace char, or
                            &nbsp;      |   # a non-breaking space entity, or
                            --          |   # dashes, or
                            &[mn]dash;  |   # named dash entities
                            %s          |   # or decimal entities
                            &\#x201[34];    # or hex
                    )
                    "                 # the quote
                    (?=\w)            # followed by a word character
                    """ % (dec_dashes,), re.VERBOSE)
    text = opening_double_quotes_regex.sub(r'\1' + smart.opquote, text)

    # Double closing quotes:
    closing_double_quotes_regex = re.compile(r"""
                    #(%s)?   # character that indicates the quote should be closing
                    "
                    (?=\s)
                    """ % (close_class,), re.VERBOSE)
    text = closing_double_quotes_regex.sub(smart.cpquote, text)

    closing_double_quotes_regex = re.compile(r"""
                    (%s)   # character that indicates the quote should be closing
                    "
                    """ % (close_class,), re.VERBOSE)
    text = closing_double_quotes_regex.sub(r'\1' + smart.cpquote, text)

    # Any remaining quotes should be opening ones.
    text = re.sub(r'"', smart.opquote, text)

    return text


def educate_tokens(text_tokens, attr='1', language='en'):
    # type: (Iterable[Tuple[str, unicode]], unicode, unicode) -> Iterator
    """Return iterator that "educates" the items of `text_tokens`.
    """

    # Parse attributes:
    # 0 : do nothing
    # 1 : set all
    # 2 : set all, using old school en- and em- dash shortcuts
    # 3 : set all, using inverted old school en and em- dash shortcuts
    #
    # q : quotes
    # b : backtick quotes (``double'' only)
    # B : backtick quotes (``double'' and `single')
    # d : dashes
    # D : old school dashes
    # i : inverted old school dashes
    # e : ellipses
    # w : convert &quot; entities to " for Dreamweaver users

    convert_quot = False  # translate &quot; entities into normal quotes?
    do_dashes = 0
    do_backticks = 0
    do_quotes = False
    do_ellipses = False
    do_stupefy = False

    if attr == "0":  # Do nothing.
        pass
    elif attr == "1":  # Do everything, turn all options on.
        do_quotes = True
        do_backticks = 1
        do_dashes = 1
        do_ellipses = True
    elif attr == "2":
        # Do everything, turn all options on, use old school dash shorthand.
        do_quotes = True
        do_backticks = 1
        do_dashes = 2
        do_ellipses = True
    elif attr == "3":
        # Do everything, use inverted old school dash shorthand.
        do_quotes = True
        do_backticks = 1
        do_dashes = 3
        do_ellipses = True
    elif attr == "-1":  # Special "stupefy" mode.
        do_stupefy = True
    else:
        if "q" in attr:
            do_quotes = True
        if "b" in attr:
            do_backticks = 1
        if "B" in attr:
            do_backticks = 2
        if "d" in attr:
            do_dashes = 1
        if "D" in attr:
            do_dashes = 2
        if "i" in attr:
            do_dashes = 3
        if "e" in attr:
            do_ellipses = True
        if "w" in attr:
            convert_quot = True

    prev_token_last_char = " "
    # Last character of the previous text token. Used as
    # context to curl leading quote characters correctly.

    for (ttype, text) in text_tokens:

        # skip HTML and/or XML tags as well as emtpy text tokens
        # without updating the last character
        if ttype == 'tag' or not text:
            yield text
            continue

        # skip literal text (math, literal, raw, ...)
        if ttype == 'literal':
            prev_token_last_char = text[-1:]
            yield text
            continue

        last_char = text[-1:]  # Remember last char before processing.

        text = smartquotes.processEscapes(text)

        if convert_quot:
            text = re.sub('&quot;', '"', text)

        if do_dashes == 1:
            text = smartquotes.educateDashes(text)
        elif do_dashes == 2:
            text = smartquotes.educateDashesOldSchool(text)
        elif do_dashes == 3:
            text = smartquotes.educateDashesOldSchoolInverted(text)

        if do_ellipses:
            text = smartquotes.educateEllipses(text)

        # Note: backticks need to be processed before quotes.
        if do_backticks:
            text = smartquotes.educateBackticks(text, language)

        if do_backticks == 2:
            text = smartquotes.educateSingleBackticks(text, language)

        if do_quotes:
            # Replace plain quotes to prevent converstion to
            # 2-character sequence in French.
            context = prev_token_last_char.replace('"', ';').replace("'", ';')
            text = educateQuotes(context + text, language)[1:]

        if do_stupefy:
            text = smartquotes.stupefyEntities(text, language)

        # Remember last char as context for the next token
        prev_token_last_char = last_char

        text = smartquotes.processEscapes(text, restore=True)

        yield text


if docutils_version < (0, 13, 2):
    # Monkey patch the old docutils versions to fix the issue mentioned
    # at https://sourceforge.net/p/docutils/bugs/313/
    smartquotes.educateQuotes = educateQuotes

    # And the one mentioned at https://sourceforge.net/p/docutils/bugs/317/
    smartquotes.educate_tokens = educate_tokens

    # Fix the issue with French quotes mentioned at
    # https://sourceforge.net/p/docutils/mailman/message/35760696/
    quotes = smartquotes.smartchars.quotes
    quotes['fr'] = (u'«\u00a0', u'\u00a0»', u'“', u'”')
    quotes['fr-ch'] = u'«»‹›'
