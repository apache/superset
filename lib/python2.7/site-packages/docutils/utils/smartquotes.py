#!/usr/bin/python
# -*- coding: utf-8 -*-

# :Id: $Id: smartquotes.py 7933 2016-01-13 21:09:13Z milde $
# :Copyright: © 2010 Günter Milde,
#             original `SmartyPants`_: © 2003 John Gruber
#             smartypants.py:          © 2004, 2007 Chad Miller
# :Maintainer: docutils-develop@lists.sourceforge.net
# :License: Released under the terms of the `2-Clause BSD license`_, in short:
#
#    Copying and distribution of this file, with or without modification,
#    are permitted in any medium without royalty provided the copyright
#    notices and this notice are preserved.
#    This file is offered as-is, without any warranty.
#
# .. _2-Clause BSD license: http://www.spdx.org/licenses/BSD-2-Clause


r"""
========================
SmartyPants for Docutils
========================

Synopsis
========

Smart-quotes for Docutils.

The original "SmartyPants" is a free web publishing plug-in for Movable Type,
Blosxom, and BBEdit that easily translates plain ASCII punctuation characters
into "smart" typographic punctuation characters.

`smartypants.py`, endeavours to be a functional port of
SmartyPants to Python, for use with Pyblosxom_.

`smartquotes.py` is an adaption of Smartypants to Docutils_. By using Unicode
characters instead of HTML entities for typographic quotes, it works for any
output format that supports Unicode.

Authors
=======

`John Gruber`_ did all of the hard work of writing this software in Perl for
`Movable Type`_ and almost all of this useful documentation.  `Chad Miller`_
ported it to Python to use with Pyblosxom_.
Adapted to Docutils_ by Günter Milde.

Additional Credits
==================

Portions of the SmartyPants original work are based on Brad Choate's nifty
MTRegex plug-in.  `Brad Choate`_ also contributed a few bits of source code to
this plug-in.  Brad Choate is a fine hacker indeed.

`Jeremy Hedley`_ and `Charles Wiltgen`_ deserve mention for exemplary beta
testing of the original SmartyPants.

`Rael Dornfest`_ ported SmartyPants to Blosxom.

.. _Brad Choate: http://bradchoate.com/
.. _Jeremy Hedley: http://antipixel.com/
.. _Charles Wiltgen: http://playbacktime.com/
.. _Rael Dornfest: http://raelity.org/


Copyright and License
=====================

SmartyPants_ license (3-Clause BSD license):

  Copyright (c) 2003 John Gruber (http://daringfireball.net/)
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are
  met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.

  * Neither the name "SmartyPants" nor the names of its contributors
    may be used to endorse or promote products derived from this
    software without specific prior written permission.

  This software is provided by the copyright holders and contributors
  "as is" and any express or implied warranties, including, but not
  limited to, the implied warranties of merchantability and fitness for
  a particular purpose are disclaimed. In no event shall the copyright
  owner or contributors be liable for any direct, indirect, incidental,
  special, exemplary, or consequential damages (including, but not
  limited to, procurement of substitute goods or services; loss of use,
  data, or profits; or business interruption) however caused and on any
  theory of liability, whether in contract, strict liability, or tort
  (including negligence or otherwise) arising in any way out of the use
  of this software, even if advised of the possibility of such damage.

smartypants.py license (2-Clause BSD license):

  smartypants.py is a derivative work of SmartyPants.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are
  met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.

  This software is provided by the copyright holders and contributors
  "as is" and any express or implied warranties, including, but not
  limited to, the implied warranties of merchantability and fitness for
  a particular purpose are disclaimed. In no event shall the copyright
  owner or contributors be liable for any direct, indirect, incidental,
  special, exemplary, or consequential damages (including, but not
  limited to, procurement of substitute goods or services; loss of use,
  data, or profits; or business interruption) however caused and on any
  theory of liability, whether in contract, strict liability, or tort
  (including negligence or otherwise) arising in any way out of the use
  of this software, even if advised of the possibility of such damage.

.. _John Gruber: http://daringfireball.net/
.. _Chad Miller: http://web.chad.org/

.. _Pyblosxom: http://pyblosxom.bluesock.org/
.. _SmartyPants: http://daringfireball.net/projects/smartypants/
.. _Movable Type: http://www.movabletype.org/
.. _2-Clause BSD license: http://www.spdx.org/licenses/BSD-2-Clause
.. _Docutils: http://docutils.sf.net/

Description
===========

SmartyPants can perform the following transformations:

- Straight quotes ( " and ' ) into "curly" quote characters
- Backticks-style quotes (\`\`like this'') into "curly" quote characters
- Dashes (``--`` and ``---``) into en- and em-dash entities
- Three consecutive dots (``...`` or ``. . .``) into an ellipsis entity

This means you can write, edit, and save your posts using plain old
ASCII straight quotes, plain dashes, and plain dots, but your published
posts (and final HTML output) will appear with smart quotes, em-dashes,
and proper ellipses.

SmartyPants does not modify characters within ``<pre>``, ``<code>``, ``<kbd>``,
``<math>`` or ``<script>`` tag blocks. Typically, these tags are used to
display text where smart quotes and other "smart punctuation" would not be
appropriate, such as source code or example markup.


Backslash Escapes
=================

If you need to use literal straight quotes (or plain hyphens and
periods), SmartyPants accepts the following backslash escape sequences
to force non-smart punctuation. It does so by transforming the escape
sequence into a character:

========  =====  =========
Escape    Value  Character
========  =====  =========
``\\\\``  &#92;  \\
\\"       &#34;  "
\\'       &#39;  '
\\.       &#46;  .
\\-       &#45;  \-
\\`       &#96;  \`
========  =====  =========

This is useful, for example, when you want to use straight quotes as
foot and inch marks: 6\\'2\\" tall; a 17\\" iMac.

Options
=======

For Pyblosxom users, the ``smartypants_attributes`` attribute is where you
specify configuration options.

Numeric values are the easiest way to configure SmartyPants' behavior:

"0"
        Suppress all transformations. (Do nothing.)
"1"
        Performs default SmartyPants transformations: quotes (including
        \`\`backticks'' -style), em-dashes, and ellipses. "``--``" (dash dash)
        is used to signify an em-dash; there is no support for en-dashes.

"2"
        Same as smarty_pants="1", except that it uses the old-school typewriter
        shorthand for dashes:  "``--``" (dash dash) for en-dashes, "``---``"
        (dash dash dash)
        for em-dashes.

"3"
        Same as smarty_pants="2", but inverts the shorthand for dashes:
        "``--``" (dash dash) for em-dashes, and "``---``" (dash dash dash) for
        en-dashes.

"-1"
        Stupefy mode. Reverses the SmartyPants transformation process, turning
        the characters produced by SmartyPants into their ASCII equivalents.
        E.g.  "“" is turned into a simple double-quote (\"), "—" is
        turned into two dashes, etc.


The following single-character attribute values can be combined to toggle
individual transformations from within the smarty_pants attribute. For
example, to educate normal quotes and em-dashes, but not ellipses or
\`\`backticks'' -style quotes:

``py['smartypants_attributes'] = "1"``

"q"
        Educates normal quote characters: (") and (').

"b"
        Educates \`\`backticks'' -style double quotes.

"B"
        Educates \`\`backticks'' -style double quotes and \`single' quotes.

"d"
        Educates em-dashes.

"D"
        Educates em-dashes and en-dashes, using old-school typewriter shorthand:
        (dash dash) for en-dashes, (dash dash dash) for em-dashes.

"i"
        Educates em-dashes and en-dashes, using inverted old-school typewriter
        shorthand: (dash dash) for em-dashes, (dash dash dash) for en-dashes.

"e"
        Educates ellipses.

"w"
        Translates any instance of ``&quot;`` into a normal double-quote character.
        This should be of no interest to most people, but of particular interest
        to anyone who writes their posts using Dreamweaver, as Dreamweaver
        inexplicably uses this entity to represent a literal double-quote
        character. SmartyPants only educates normal quotes, not entities (because
        ordinarily, entities are used for the explicit purpose of representing the
        specific character they represent). The "w" option must be used in
        conjunction with one (or both) of the other quote options ("q" or "b").
        Thus, if you wish to apply all SmartyPants transformations (quotes, en-
        and em-dashes, and ellipses) and also translate ``&quot;`` entities into
        regular quotes so SmartyPants can educate them, you should pass the
        following to the smarty_pants attribute:


Caveats
=======

Why You Might Not Want to Use Smart Quotes in Your Weblog
---------------------------------------------------------

For one thing, you might not care.

Most normal, mentally stable individuals do not take notice of proper
typographic punctuation. Many design and typography nerds, however, break
out in a nasty rash when they encounter, say, a restaurant sign that uses
a straight apostrophe to spell "Joe's".

If you're the sort of person who just doesn't care, you might well want to
continue not caring. Using straight quotes -- and sticking to the 7-bit
ASCII character set in general -- is certainly a simpler way to live.

Even if you I *do* care about accurate typography, you still might want to
think twice before educating the quote characters in your weblog. One side
effect of publishing curly quote characters is that it makes your
weblog a bit harder for others to quote from using copy-and-paste. What
happens is that when someone copies text from your blog, the copied text
contains the 8-bit curly quote characters (as well as the 8-bit characters
for em-dashes and ellipses, if you use these options). These characters
are not standard across different text encoding methods, which is why they
need to be encoded as characters.

People copying text from your weblog, however, may not notice that you're
using curly quotes, and they'll go ahead and paste the unencoded 8-bit
characters copied from their browser into an email message or their own
weblog. When pasted as raw "smart quotes", these characters are likely to
get mangled beyond recognition.

That said, my own opinion is that any decent text editor or email client
makes it easy to stupefy smart quote characters into their 7-bit
equivalents, and I don't consider it my problem if you're using an
indecent text editor or email client.


Algorithmic Shortcomings
------------------------

One situation in which quotes will get curled the wrong way is when
apostrophes are used at the start of leading contractions. For example:

``'Twas the night before Christmas.``

In the case above, SmartyPants will turn the apostrophe into an opening
single-quote, when in fact it should be a closing one. I don't think
this problem can be solved in the general case -- every word processor
I've tried gets this wrong as well. In such cases, it's best to use the
proper character for closing single-quotes (``’``) by hand.


Version History
===============

1.7     2012-11-19
        - Internationalization: language-dependent quotes.

1.6.1:  2012-11-06
        - Refactor code, code cleanup,
        - `educate_tokens()` generator as interface for Docutils.

1.6:    2010-08-26
        - Adaption to Docutils:
          - Use Unicode instead of HTML entities,
          - Remove code special to pyblosxom.

1.5_1.6: Fri, 27 Jul 2007 07:06:40 -0400
        - Fixed bug where blocks of precious unalterable text was instead
          interpreted.  Thanks to Le Roux and Dirk van Oosterbosch.

1.5_1.5: Sat, 13 Aug 2005 15:50:24 -0400
        - Fix bogus magical quotation when there is no hint that the
          user wants it, e.g., in "21st century".  Thanks to Nathan Hamblen.
        - Be smarter about quotes before terminating numbers in an en-dash'ed
          range.

1.5_1.4: Thu, 10 Feb 2005 20:24:36 -0500
        - Fix a date-processing bug, as reported by jacob childress.
        - Begin a test-suite for ensuring correct output.
        - Removed import of "string", since I didn't really need it.
          (This was my first every Python program.  Sue me!)

1.5_1.3: Wed, 15 Sep 2004 18:25:58 -0400
        - Abort processing if the flavour is in forbidden-list.  Default of
          [ "rss" ]   (Idea of Wolfgang SCHNERRING.)
        - Remove stray virgules from en-dashes.  Patch by Wolfgang SCHNERRING.

1.5_1.2: Mon, 24 May 2004 08:14:54 -0400
        - Some single quotes weren't replaced properly.  Diff-tesuji played
          by Benjamin GEIGER.

1.5_1.1: Sun, 14 Mar 2004 14:38:28 -0500
        - Support upcoming pyblosxom 0.9 plugin verification feature.

1.5_1.0: Tue, 09 Mar 2004 08:08:35 -0500
        - Initial release
"""

default_smartypants_attr = "1"


import re

class smartchars(object):
    """Smart quotes and dashes
    """

    endash   = u'–' # "&#8211;" EN DASH
    emdash   = u'—' # "&#8212;" EM DASH
    ellipsis = u'…' # "&#8230;" HORIZONTAL ELLIPSIS

    # quote characters (language-specific, set in __init__())
    #
    # English smart quotes (open primary, close primary, open secondary, close
    # secondary) are:
    #   opquote  = u'“' # "&#8220;" LEFT DOUBLE QUOTATION MARK
    #   cpquote  = u'”' # "&#8221;" RIGHT DOUBLE QUOTATION MARK
    #   osquote  = u'‘' # "&#8216;" LEFT SINGLE QUOTATION MARK
    #   csquote  = u'’' # "&#8217;" RIGHT SINGLE QUOTATION MARK
    # For other languages see:
    # http://en.wikipedia.org/wiki/Non-English_usage_of_quotation_marks
    # http://de.wikipedia.org/wiki/Anf%C3%BChrungszeichen#Andere_Sprachen
    quotes = {'af':           u'“”‘’',
              'af-x-altquot': u'„”‚’',
              'ca':           u'«»“”',
              'ca-x-altquot': u'“”‘’',
              'cs':           u'„“‚‘',
              'cs-x-altquot': u'»«›‹',
              'da':           u'»«‘’',
              'da-x-altquot': u'„“‚‘',
              'de':           u'„“‚‘',
              'de-x-altquot': u'»«›‹',
              'de-CH':        u'«»‹›',
              'el':           u'«»“”',
              'en':           u'“”‘’',
              'en-UK':        u'‘’“”',
              'eo':           u'“”‘’',
              'es':           u'«»“”',
              'et':           u'„“‚‘', # no secondary quote listed in
              'et-x-altquot': u'»«›‹', # the sources above (wikipedia.org)
              'eu':           u'«»‹›',
              'es-x-altquot': u'“”‘’',
              'fi':           u'””’’',
              'fi-x-altquot': u'»»’’',
              'fr':           (u'« ',  u' »', u'‹ ', u' ›'), # with narrow no-break space
              'fr-x-altquot': u'«»‹›', # for use with manually set spaces
              # 'fr-x-altquot': (u'“ ',  u' ”', u'‘ ', u' ’'), # rarely used
              'fr-CH':        u'«»‹›',
              'gl':           u'«»“”',
              'he':           u'”“»«',
              'he-x-altquot': u'„”‚’',
              'it':           u'«»“”',
              'it-CH':        u'«»‹›',
              'it-x-altquot': u'“”‘’',
              'ja':           u'「」『』',
              'lt':           u'„“‚‘',
              'nl':           u'“”‘’',
              'nl-x-altquot': u'„”‚’',
              'pl':           u'„”«»',
              'pl-x-altquot': u'«»“”',
              'pt':           u'«»“”',
              'pt-BR':        u'“”‘’',
              'ro':           u'„”«»',
              'ro-x-altquot': u'«»„”',
              'ru':           u'«»„“',
              'sk':           u'„“‚‘',
              'sk-x-altquot': u'»«›‹',
              'sv':           u'„“‚‘',
              'sv-x-altquot': u'»«›‹',
              'zh-CN':        u'“”‘’',
              'it':           u'«»“”',
              'zh-TW':        u'「」『』',
             }

    def __init__(self, language='en'):
        self.language = language
        try:
            (self.opquote, self.cpquote,
             self.osquote, self.csquote) = self.quotes[language]
        except KeyError:
            self.opquote, self.cpquote, self.osquote, self.csquote = u'""\'\''


def smartyPants(text, attr=default_smartypants_attr, language='en'):
    """Main function for "traditional" use."""

    return "".join([t for t in educate_tokens(tokenize(text),
                                              attr, language)])


def educate_tokens(text_tokens, attr=default_smartypants_attr, language='en'):
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
    do_dashes = False
    do_backticks = False
    do_quotes = False
    do_ellipses = False
    do_stupefy = False

    if attr == "0": # Do nothing.
        yield text
    elif attr == "1": # Do everything, turn all options on.
        do_quotes    = True
        do_backticks = True
        do_dashes    = 1
        do_ellipses  = True
    elif attr == "2":
        # Do everything, turn all options on, use old school dash shorthand.
        do_quotes    = True
        do_backticks = True
        do_dashes    = 2
        do_ellipses  = True
    elif attr == "3":
        # Do everything, use inverted old school dash shorthand.
        do_quotes    = True
        do_backticks = True
        do_dashes    = 3
        do_ellipses  = True
    elif attr == "-1": # Special "stupefy" mode.
        do_stupefy   = True
    else:
        if "q" in attr: do_quotes = True
        if "b" in attr: do_backticks = True
        if "B" in attr: do_backticks = 2
        if "d" in attr: do_dashes = 1
        if "D" in attr: do_dashes = 2
        if "i" in attr: do_dashes = 3
        if "e" in attr: do_ellipses = True
        if "w" in attr: convert_quot = True

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

        last_char = text[-1:] # Remember last char before processing.

        text = processEscapes(text)

        if convert_quot:
            text = re.sub('&quot;', '"', text)

        if do_dashes == 1:
            text = educateDashes(text)
        elif do_dashes == 2:
            text = educateDashesOldSchool(text)
        elif do_dashes == 3:
            text = educateDashesOldSchoolInverted(text)

        if do_ellipses:
            text = educateEllipses(text)

        # Note: backticks need to be processed before quotes.
        if do_backticks:
            text = educateBackticks(text, language)

        if do_backticks == 2:
            text = educateSingleBackticks(text, language)

        if do_quotes:
            text = educateQuotes(prev_token_last_char+text, language)[1:]

        if do_stupefy:
            text = stupefyEntities(text, language)

        # Remember last char as context for the next token
        prev_token_last_char = last_char

        text = processEscapes(text, restore=True)

        yield text



def educateQuotes(text, language='en'):
    """
    Parameter:  - text string (unicode or bytes).
                - language (`BCP 47` language tag.)
    Returns:    The `text`, with "educated" curly quote characters.

    Example input:  "Isn't this fun?"
    Example output: “Isn’t this fun?“;
    """

    smart = smartchars(language)

    # oldtext = text
    punct_class = r"""[!"#\$\%'()*+,-.\/:;<=>?\@\[\\\]\^_`{|}~]"""

    # Special case if the very first character is a quote
    # followed by punctuation at a non-word-break.
    # Close the quotes by brute force:
    text = re.sub(r"""^'(?=%s\\B)""" % (punct_class,), smart.csquote, text)
    text = re.sub(r"""^"(?=%s\\B)""" % (punct_class,), smart.cpquote, text)

    # Special case for double sets of quotes, e.g.:
    #   <p>He said, "'Quoted' words in a larger quote."</p>
    text = re.sub(r""""'(?=\w)""", smart.opquote+smart.osquote, text)
    text = re.sub(r"""'"(?=\w)""", smart.osquote+smart.opquote, text)

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
                    """ % (dec_dashes,), re.VERBOSE)
    text = opening_single_quotes_regex.sub(r'\1'+smart.osquote, text)

    closing_single_quotes_regex = re.compile(r"""
                    (%s)
                    '
                    (?!\s | s\b | \d)
                    """ % (close_class,), re.VERBOSE)
    text = closing_single_quotes_regex.sub(r'\1'+smart.csquote, text)

    closing_single_quotes_regex = re.compile(r"""
                    (%s)
                    '
                    (\s | s\b)
                    """ % (close_class,), re.VERBOSE)
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
    text = opening_double_quotes_regex.sub(r'\1'+smart.opquote, text)

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
    text = closing_double_quotes_regex.sub(r'\1'+smart.cpquote, text)

    # Any remaining quotes should be opening ones.
    text = re.sub(r'"', smart.opquote, text)

    return text


def educateBackticks(text, language='en'):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with ``backticks'' -style double quotes
                translated into HTML curly quote entities.
    Example input:  ``Isn't this fun?''
    Example output: “Isn't this fun?“;
    """
    smart = smartchars(language)

    text = re.sub(r"""``""", smart.opquote, text)
    text = re.sub(r"""''""", smart.cpquote, text)
    return text


def educateSingleBackticks(text, language='en'):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with `backticks' -style single quotes
                translated into HTML curly quote entities.

    Example input:  `Isn't this fun?'
    Example output: ‘Isn’t this fun?’
    """
    smart = smartchars(language)

    text = re.sub(r"""`""", smart.osquote, text)
    text = re.sub(r"""'""", smart.csquote, text)
    return text


def educateDashes(text):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with each instance of "--" translated to
                an em-dash character.
    """

    text = re.sub(r"""---""", smartchars.endash, text) # en  (yes, backwards)
    text = re.sub(r"""--""", smartchars.emdash, text) # em (yes, backwards)
    return text


def educateDashesOldSchool(text):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with each instance of "--" translated to
                an en-dash character, and each "---" translated to
                an em-dash character.
    """

    text = re.sub(r"""---""", smartchars.emdash, text)
    text = re.sub(r"""--""", smartchars.endash, text)
    return text


def educateDashesOldSchoolInverted(text):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with each instance of "--" translated to
                an em-dash character, and each "---" translated to
                an en-dash character. Two reasons why: First, unlike the
                en- and em-dash syntax supported by
                EducateDashesOldSchool(), it's compatible with existing
                entries written before SmartyPants 1.1, back when "--" was
                only used for em-dashes.  Second, em-dashes are more
                common than en-dashes, and so it sort of makes sense that
                the shortcut should be shorter to type. (Thanks to Aaron
                Swartz for the idea.)
    """
    text = re.sub(r"""---""", smartchars.endash, text)    # em
    text = re.sub(r"""--""", smartchars.emdash, text)    # en
    return text



def educateEllipses(text):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with each instance of "..." translated to
                an ellipsis character.

    Example input:  Huh...?
    Example output: Huh&#8230;?
    """

    text = re.sub(r"""\.\.\.""", smartchars.ellipsis, text)
    text = re.sub(r"""\. \. \.""", smartchars.ellipsis, text)
    return text


def stupefyEntities(text, language='en'):
    """
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with each SmartyPants character translated to
                its ASCII counterpart.

    Example input:  “Hello — world.”
    Example output: "Hello -- world."
    """
    smart = smartchars(language)

    text = re.sub(smart.endash, "-", text)  # en-dash
    text = re.sub(smart.emdash, "--", text) # em-dash

    text = re.sub(smart.osquote, "'", text)  # open single quote
    text = re.sub(smart.csquote, "'", text)  # close single quote

    text = re.sub(smart.opquote, '"', text)  # open double quote
    text = re.sub(smart.cpquote, '"', text)  # close double quote

    text = re.sub(smart.ellipsis, '...', text)# ellipsis

    return text


def processEscapes(text, restore=False):
    r"""
    Parameter:  String (unicode or bytes).
    Returns:    The `text`, with after processing the following backslash
                escape sequences. This is useful if you want to force a "dumb"
                quote or other character to appear.

                Escape  Value
                ------  -----
                \\      &#92;
                \"      &#34;
                \'      &#39;
                \.      &#46;
                \-      &#45;
                \`      &#96;
    """
    replacements = ((r'\\', r'&#92;'),
                    (r'\"', r'&#34;'),
                    (r"\'", r'&#39;'),
                    (r'\.', r'&#46;'),
                    (r'\-', r'&#45;'),
                    (r'\`', r'&#96;'))
    if restore:
        for (ch, rep) in replacements:
            text = text.replace(rep, ch[1])
    else:
        for (ch, rep) in replacements:
            text = text.replace(ch, rep)

    return text


def tokenize(text):
    """
    Parameter:  String containing HTML markup.
    Returns:    An iterator that yields the tokens comprising the input
                string. Each token is either a tag (possibly with nested,
                tags contained therein, such as <a href="<MTFoo>">, or a
                run of text between tags. Each yielded element is a
                two-element tuple; the first is either 'tag' or 'text';
                the second is the actual value.

    Based on the _tokenize() subroutine from Brad Choate's MTRegex plugin.
        <http://www.bradchoate.com/past/mtregex.php>
    """

    pos = 0
    length = len(text)
    # tokens = []

    depth = 6
    nested_tags = "|".join(['(?:<(?:[^<>]',] * depth) + (')*>)' * depth)
    #match = r"""(?: <! ( -- .*? -- \s* )+ > ) |  # comments
    #               (?: <\? .*? \?> ) |  # directives
    #               %s  # nested tags       """ % (nested_tags,)
    tag_soup = re.compile(r"""([^<]*)(<[^>]*>)""")

    token_match = tag_soup.search(text)

    previous_end = 0
    while token_match is not None:
        if token_match.group(1):
            yield ('text', token_match.group(1))

        yield ('tag', token_match.group(2))

        previous_end = token_match.end()
        token_match = tag_soup.search(text, token_match.end())

    if previous_end < len(text):
        yield ('text', text[previous_end:])



if __name__ == "__main__":

    import locale

    try:
        locale.setlocale(locale.LC_ALL, '')
    except:
        pass

    from docutils.core import publish_string
    docstring_html = publish_string(__doc__, writer_name='html')

    print docstring_html


    # Unit test output goes out stderr.
    import unittest
    sp = smartyPants

    class TestSmartypantsAllAttributes(unittest.TestCase):
        # the default attribute is "1", which means "all".

        def test_dates(self):
            self.assertEqual(sp("1440-80's"), u"1440-80’s")
            self.assertEqual(sp("1440-'80s"), u"1440-‘80s")
            self.assertEqual(sp("1440---'80s"), u"1440–‘80s")
            self.assertEqual(sp("1960s"), "1960s")  # no effect.
            self.assertEqual(sp("1960's"), u"1960’s")
            self.assertEqual(sp("one two '60s"), u"one two ‘60s")
            self.assertEqual(sp("'60s"), u"‘60s")

        def test_ordinal_numbers(self):
            self.assertEqual(sp("21st century"), "21st century")  # no effect.
            self.assertEqual(sp("3rd"), "3rd")  # no effect.

        def test_educated_quotes(self):
            self.assertEqual(sp('''"Isn't this fun?"'''), u'“Isn’t this fun?”')

        def test_html_tags(self):
            text = '<a src="foo">more</a>'
            self.assertEqual(sp(text), text)

    unittest.main()




__author__ = "Chad Miller <smartypantspy@chad.org>"
__version__ = "1.5_1.6: Fri, 27 Jul 2007 07:06:40 -0400"
__url__ = "http://wiki.chad.org/SmartyPantsPy"
__description__ = "Smart-quotes, smart-ellipses, and smart-dashes for weblog entries in pyblosxom"
