# $Id: ca.py 7119 2011-09-02 13:00:23Z milde $
# Author: Ivan Vilata i Balaguer <ivan@selidor.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Catalan-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'atenci\u00F3': 'attention',
      u'compte': 'caution',
      u'code (translation required)': 'code',
      u'perill': 'danger',
      u'error': 'error',
      u'suggeriment': 'hint',
      u'important': 'important',
      u'nota': 'note',
      u'consell': 'tip',
      u'av\u00EDs': 'warning',
      u'advertiment': 'admonition',
      u'nota-al-marge': 'sidebar',
      u'nota-marge': 'sidebar',
      u'tema': 'topic',
      u'bloc-de-l\u00EDnies': 'line-block',
      u'bloc-l\u00EDnies': 'line-block',
      u'literal-analitzat': 'parsed-literal',
      u'r\u00FAbrica': 'rubric',
      u'ep\u00EDgraf': 'epigraph',
      u'sumari': 'highlights',
      u'cita-destacada': 'pull-quote',
      u'compost': 'compound',
      u'container (translation required)': 'container',
      #'questions': 'questions',
      u'taula': 'table',
      u'taula-csv': 'csv-table',
      u'taula-llista': 'list-table',
      #'qa': 'questions',
      #'faq': 'questions',
      u'math (translation required)': 'math',
      u'meta': 'meta',
      #'imagemap': 'imagemap',
      u'imatge': 'image',
      u'figura': 'figure',
      u'inclou': 'include',
      u'incloure': 'include',
      u'cru': 'raw',
      u'reempla\u00E7a': 'replace',
      u'reempla\u00E7ar': 'replace',
      u'unicode': 'unicode',
      u'data': 'date',
      u'classe': 'class',
      u'rol': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'contingut': 'contents',
      u'numsec': 'sectnum',
      u'numeraci\u00F3-de-seccions': 'sectnum',
      u'numeraci\u00F3-seccions': 'sectnum',
      u'cap\u00E7alera': 'header',
      u'peu-de-p\u00E0gina': 'footer',
      u'peu-p\u00E0gina': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'notes-amb-destinacions': 'target-notes',
      u'notes-destinacions': 'target-notes',
      u'directiva-de-prova-de-restructuredtext': 'restructuredtext-test-directive'}
"""Catalan name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'abreviatura': 'abbreviation',
    u'abreviaci\u00F3': 'abbreviation',
    u'abrev': 'abbreviation',
    u'ab': 'abbreviation',
    u'acr\u00F2nim': 'acronym',
    u'ac': 'acronym',
    u'code (translation required)': 'code',
    u'\u00EDndex': 'index',
    u'i': 'index',
    u'sub\u00EDndex': 'subscript',
    u'sub': 'subscript',
    u'super\u00EDndex': 'superscript',
    u'sup': 'superscript',
    u'refer\u00E8ncia-a-t\u00EDtol': 'title-reference',
    u'refer\u00E8ncia-t\u00EDtol': 'title-reference',
    u't\u00EDtol': 'title-reference',
    u't': 'title-reference',
    u'refer\u00E8ncia-a-pep': 'pep-reference',
    u'refer\u00E8ncia-pep': 'pep-reference',
    u'pep': 'pep-reference',
    u'refer\u00E8ncia-a-rfc': 'rfc-reference',
    u'refer\u00E8ncia-rfc': 'rfc-reference',
    u'rfc': 'rfc-reference',
    u'\u00E8mfasi': 'emphasis',
    u'destacat': 'strong',
    u'literal': 'literal',
    u'math (translation required)': 'math',
    u'refer\u00E8ncia-amb-nom': 'named-reference',
    u'refer\u00E8ncia-nom': 'named-reference',
    u'refer\u00E8ncia-an\u00F2nima': 'anonymous-reference',
    u'refer\u00E8ncia-a-nota-al-peu': 'footnote-reference',
    u'refer\u00E8ncia-nota-al-peu': 'footnote-reference',
    u'refer\u00E8ncia-a-cita': 'citation-reference',
    u'refer\u00E8ncia-cita': 'citation-reference',
    u'refer\u00E8ncia-a-substituci\u00F3': 'substitution-reference',
    u'refer\u00E8ncia-substituci\u00F3': 'substitution-reference',
    u'destinaci\u00F3': 'target',
    u'refer\u00E8ncia-a-uri': 'uri-reference',
    u'refer\u00E8ncia-uri': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'cru': 'raw',}
"""Mapping of Catalan role names to canonical role names for interpreted text.
"""
