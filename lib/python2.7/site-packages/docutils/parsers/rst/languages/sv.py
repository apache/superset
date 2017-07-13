# $Id: sv.py 7119 2011-09-02 13:00:23Z milde $
# Author: Adam Chodorowski <chodorowski@users.sourceforge.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Swedish language mappings for language-dependent features of reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      u'observera': 'attention',
      u'caution (translation required)': 'caution',
      u'code (translation required)': 'code',
      u'fara': 'danger',
      u'fel': 'error',
      u'v\u00e4gledning': 'hint',
      u'viktigt': 'important',
      u'notera': 'note',
      u'tips': 'tip',
      u'varning': 'warning',
      u'admonition (translation required)': 'admonition',
      u'sidebar (translation required)': 'sidebar',
      u'\u00e4mne': 'topic',
      u'line-block (translation required)': 'line-block',
      u'parsed-literal (translation required)': 'parsed-literal',
      u'mellanrubrik': 'rubric',
      u'epigraph (translation required)': 'epigraph',
      u'highlights (translation required)': 'highlights',
      u'pull-quote (translation required)': 'pull-quote',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      # u'fr\u00e5gor': 'questions',
      # NOTE: A bit long, but recommended by http://www.nada.kth.se/dataterm/:
      # u'fr\u00e5gor-och-svar': 'questions',
      # u'vanliga-fr\u00e5gor': 'questions',  
      u'table (translation required)': 'table',
      u'csv-table (translation required)': 'csv-table',
      u'list-table (translation required)': 'list-table',
      u'meta': 'meta',
      'math (translation required)': 'math',
      # u'bildkarta': 'imagemap',   # FIXME: Translation might be too literal.
      u'bild': 'image',
      u'figur': 'figure',
      u'inkludera': 'include',   
      u'r\u00e5': 'raw',            # FIXME: Translation might be too literal.
      u'ers\u00e4tt': 'replace', 
      u'unicode': 'unicode',
      u'datum': 'date',
      u'class (translation required)': 'class',
      u'role (translation required)': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'inneh\u00e5ll': 'contents',
      u'sektionsnumrering': 'sectnum',
      u'target-notes (translation required)': 'target-notes',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      # u'fotnoter': 'footnotes',
      # u'citeringar': 'citations',
      }
"""Swedish name to registered (in directives/__init__.py) directive name
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
      u'r\u00e5': 'raw',}
"""Mapping of Swedish role names to canonical role names for interpreted text.
"""
