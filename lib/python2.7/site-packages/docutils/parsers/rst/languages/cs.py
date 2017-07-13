# $Id: cs.py 7119 2011-09-02 13:00:23Z milde $
# Author: Marek Blaha <mb@dat.cz>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Czech-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'pozor': 'attention',
      u'caution (translation required)': 'caution', # jak rozlisit caution a warning?
      u'code (translation required)': 'code',
      u'nebezpe\u010D\u00ED': 'danger',
      u'chyba': 'error',
      u'rada': 'hint',
      u'd\u016Fle\u017Eit\u00E9': 'important',
      u'pozn\u00E1mka': 'note',
      u'tip (translation required)': 'tip',
      u'varov\u00E1n\u00ED': 'warning',
      u'admonition (translation required)': 'admonition',
      u'sidebar (translation required)': 'sidebar',
      u't\u00E9ma': 'topic',
      u'line-block (translation required)': 'line-block',
      u'parsed-literal (translation required)': 'parsed-literal',
      u'odd\u00EDl': 'rubric',
      u'moto': 'epigraph',
      u'highlights (translation required)': 'highlights',
      u'pull-quote (translation required)': 'pull-quote',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      #'questions': 'questions',
      #'qa': 'questions',
      #'faq': 'questions',
      u'table (translation required)': 'table',
      u'csv-table (translation required)': 'csv-table',
      u'list-table (translation required)': 'list-table',
      u'math (translation required)': 'math',
      u'meta (translation required)': 'meta',
      #'imagemap': 'imagemap',
      u'image (translation required)': 'image',   # obrazek
      u'figure (translation required)': 'figure', # a tady?
      u'include (translation required)': 'include',
      u'raw (translation required)': 'raw',
      u'replace (translation required)': 'replace',
      u'unicode (translation required)': 'unicode',
      u'datum': 'date',
      u't\u0159\u00EDda': 'class',
      u'role (translation required)': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'obsah': 'contents',
      u'sectnum (translation required)': 'sectnum',
      u'section-numbering (translation required)': 'sectnum',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'target-notes (translation required)': 'target-notes',
      u'restructuredtext-test-directive': 'restructuredtext-test-directive'}
"""Czech name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'abbreviation (translation required)': 'abbreviation',
    u'ab (translation required)': 'abbreviation',
    u'acronym (translation required)': 'acronym',
    u'ac (translation required)': 'acronym',
    u'code (translation required)': 'code',
    u'index (translation required)': 'index',
    u'i (translation required)': 'index',
    u'subscript (translation required)': 'subscript',
    u'sub (translation required)': 'subscript',
    u'superscript (translation required)': 'superscript',
    u'sup (translation required)': 'superscript',
    u'title-reference (translation required)': 'title-reference',
    u'title (translation required)': 'title-reference',
    u't (translation required)': 'title-reference',
    u'pep-reference (translation required)': 'pep-reference',
    u'pep (translation required)': 'pep-reference',
    u'rfc-reference (translation required)': 'rfc-reference',
    u'rfc (translation required)': 'rfc-reference',
    u'emphasis (translation required)': 'emphasis',
    u'strong (translation required)': 'strong',
    u'literal (translation required)': 'literal',
    u'math (translation required)': 'math',
    u'named-reference (translation required)': 'named-reference',
    u'anonymous-reference (translation required)': 'anonymous-reference',
    u'footnote-reference (translation required)': 'footnote-reference',
    u'citation-reference (translation required)': 'citation-reference',
    u'substitution-reference (translation required)': 'substitution-reference',
    u'target (translation required)': 'target',
    u'uri-reference (translation required)': 'uri-reference',
    u'uri (translation required)': 'uri-reference',
    u'url (translation required)': 'uri-reference',
    u'raw (translation required)': 'raw',}
"""Mapping of Czech role names to canonical role names for interpreted text.
"""
