# $Id: pt_br.py 7119 2011-09-02 13:00:23Z milde $
# Author: David Goodger <goodger@python.org>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Brazilian Portuguese-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'aten\u00E7\u00E3o': 'attention',
      'cuidado': 'caution',
      u'code (translation required)': 'code',
      'perigo': 'danger',
      'erro': 'error',
      u'sugest\u00E3o': 'hint',
      'importante': 'important',
      'nota': 'note',
      'dica': 'tip',
      'aviso': 'warning',
      u'exorta\u00E7\u00E3o': 'admonition',
      'barra-lateral': 'sidebar',
      u't\u00F3pico': 'topic',
      'bloco-de-linhas': 'line-block',
      'literal-interpretado': 'parsed-literal',
      'rubrica': 'rubric',
      u'ep\u00EDgrafo': 'epigraph',
      'destaques': 'highlights',
      u'cita\u00E7\u00E3o-destacada': 'pull-quote',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      #'perguntas': 'questions',
      #'qa': 'questions',
      #'faq': 'questions',
      u'table (translation required)': 'table',
      u'csv-table (translation required)': 'csv-table',
      u'list-table (translation required)': 'list-table',
      'meta': 'meta',
      'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      'imagem': 'image',
      'figura': 'figure',
      u'inclus\u00E3o': 'include',
      'cru': 'raw',
      u'substitui\u00E7\u00E3o': 'replace',
      'unicode': 'unicode',
      'data': 'date',
      'classe': 'class',
      'role (translation required)': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'\u00EDndice': 'contents',
      'numsec': 'sectnum',
      u'numera\u00E7\u00E3o-de-se\u00E7\u00F5es': 'sectnum',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      #u'notas-de-rorap\u00E9': 'footnotes',
      #u'cita\u00E7\u00F5es': 'citations',
      u'links-no-rodap\u00E9': 'target-notes',
      'restructuredtext-test-directive': 'restructuredtext-test-directive'}
"""Brazilian Portuguese name to registered (in directives/__init__.py)
directive name mapping."""

roles = {
    # language-dependent: fixed
    u'abbrevia\u00E7\u00E3o': 'abbreviation',
    'ab': 'abbreviation',
    u'acr\u00F4nimo': 'acronym',
    'ac': 'acronym',
    u'code (translation required)': 'code',
    u'\u00EDndice-remissivo': 'index',
    'i': 'index',
    'subscrito': 'subscript',
    'sub': 'subscript',
    'sobrescrito': 'superscript',
    'sob': 'superscript',
    u'refer\u00EAncia-a-t\u00EDtulo': 'title-reference',
    u't\u00EDtulo': 'title-reference',
    't': 'title-reference',
    u'refer\u00EAncia-a-pep': 'pep-reference',
    'pep': 'pep-reference',
    u'refer\u00EAncia-a-rfc': 'rfc-reference',
    'rfc': 'rfc-reference',
    u'\u00EAnfase': 'emphasis',
    'forte': 'strong',
    'literal': 'literal',
    'math (translation required)': 'math',               # translation required?
    u'refer\u00EAncia-por-nome': 'named-reference',
    u'refer\u00EAncia-an\u00F4nima': 'anonymous-reference',
    u'refer\u00EAncia-a-nota-de-rodap\u00E9': 'footnote-reference',
    u'refer\u00EAncia-a-cita\u00E7\u00E3o': 'citation-reference',
    u'refer\u00EAncia-a-substitui\u00E7\u00E3o': 'substitution-reference',
    'alvo': 'target',
    u'refer\u00EAncia-a-uri': 'uri-reference',
    'uri': 'uri-reference',
    'url': 'uri-reference',
    'cru': 'raw',}
"""Mapping of Brazilian Portuguese role names to canonical role names
for interpreted text."""
