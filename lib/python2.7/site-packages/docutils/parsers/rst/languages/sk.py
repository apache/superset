# $Id: sk.py 7119 2011-09-02 13:00:23Z milde $
# Author: Miroslav Vasko <zemiak@zoznam.sk>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Slovak-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      u'pozor': 'attention',
      u'opatrne': 'caution',
      u'code (translation required)': 'code',
      u'nebezpe\xe8enstvo': 'danger',
      u'chyba': 'error',
      u'rada': 'hint',
      u'd\xf4le\x9eit\xe9': 'important',
      u'pozn\xe1mka': 'note',
      u'tip (translation required)': 'tip',
      u'varovanie': 'warning',
      u'admonition (translation required)': 'admonition',
      u'sidebar (translation required)': 'sidebar',
      u't\xe9ma': 'topic',
      u'blok-riadkov': 'line-block',
      u'parsed-literal': 'parsed-literal',
      u'rubric (translation required)': 'rubric',
      u'epigraph (translation required)': 'epigraph',
      u'highlights (translation required)': 'highlights',
      u'pull-quote (translation required)': 'pull-quote',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      #u'questions': 'questions',
      #u'qa': 'questions',
      #u'faq': 'questions',
      u'table (translation required)': 'table',
      u'csv-table (translation required)': 'csv-table',
      u'list-table (translation required)': 'list-table',
      u'meta': 'meta',
      'math (translation required)': 'math',
      #u'imagemap': 'imagemap',
      u'obr\xe1zok': 'image',
      u'tvar': 'figure',
      u'vlo\x9ei\x9d': 'include',
      u'raw (translation required)': 'raw',
      u'nahradi\x9d': 'replace',
      u'unicode': 'unicode',
      u'd\u00E1tum': 'date',
      u'class (translation required)': 'class',
      u'role (translation required)': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'obsah': 'contents',
      u'\xe8as\x9d': 'sectnum',
      u'\xe8as\x9d-\xe8\xedslovanie': 'sectnum',
      u'cie\xbeov\xe9-pozn\xe1mky': 'target-notes',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      #u'footnotes': 'footnotes',
      #u'citations': 'citations',
      }
"""Slovak name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
      u'abbreviation (translation required)': 'abbreviation',
      u'acronym (translation required)': 'acronym',
      u'code (translation required)': 'code',
      u'index (translation required)': 'index',
      u'subscript (translation required)': 'subscript',
      u'superscript (translation required)': 'superscript',
      u'title-reference (translation required)': 'title-reference',
      u'pep-reference (translation required)': 'pep-reference',
      u'rfc-reference (translation required)': 'rfc-reference',
      u'emphasis (translation required)': 'emphasis',
      u'strong (translation required)': 'strong',
      u'literal (translation required)': 'literal',
    'math (translation required)': 'math',
      u'named-reference (translation required)': 'named-reference',
      u'anonymous-reference (translation required)': 'anonymous-reference',
      u'footnote-reference (translation required)': 'footnote-reference',
      u'citation-reference (translation required)': 'citation-reference',
      u'substitution-reference (translation required)': 'substitution-reference',
      u'target (translation required)': 'target',
      u'uri-reference (translation required)': 'uri-reference',
      u'raw (translation required)': 'raw',}
"""Mapping of Slovak role names to canonical role names for interpreted text.
"""
