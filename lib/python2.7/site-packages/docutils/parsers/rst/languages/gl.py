# -*- coding: utf-8 -*-
# Author: David Goodger
# Contact: goodger@users.sourceforge.net
# Revision: $Revision: 4229 $
# Date: $Date: 2005-12-23 00:46:16 +0100 (Fri, 23 Dec 2005) $
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Galician-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'atenci\u00f3n': 'attention',
      u'advertencia': 'caution',
      u'code (translation required)': 'code',
      u'perigo': 'danger',
      u'erro': 'error',
      u'pista': 'hint',
      u'importante': 'important',
      u'nota': 'note',
      u'consello': 'tip',
      u'aviso': 'warning',
      u'admonici\u00f3n': 'admonition',
      u'barra lateral': 'sidebar',
      u't\u00f3pico': 'topic',
      u'bloque-li\u00f1a': 'line-block',
      u'literal-analizado': 'parsed-literal',
      u'r\u00fabrica': 'rubric',
      u'ep\u00edgrafe': 'epigraph',
      u'realzados': 'highlights',
      u'coller-citaci\u00f3n': 'pull-quote',
      u'compor': 'compound',
      u'recipiente': 'container',
      #'questions': 'questions',
      u't\u00e1boa': 'table',
      u't\u00e1boa-csv': 'csv-table',
      u't\u00e1boa-listaxe': 'list-table',
      #'qa': 'questions',
      #'faq': 'questions',
      u'meta': 'meta',
      'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      u'imaxe': 'image',
      u'figura': 'figure',
      u'inclu\u00edr': 'include',
      u'cru': 'raw',
      u'substitu\u00edr': 'replace',
      u'unicode': 'unicode',
      u'data': 'date',
      u'clase': 'class',
      u'regra': 'role',
      u'regra-predeterminada': 'default-role',
      u't\u00edtulo': 'title',
      u'contido': 'contents',
      u'seccnum': 'sectnum',
      u'secci\u00f3n-numerar': 'sectnum',
      u'cabeceira': 'header',
      u'p\u00e9 de p\u00e1xina': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'notas-destino': 'target-notes',
      u'texto restruturado-proba-directiva': 'restructuredtext-test-directive'}
"""Galician name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'abreviatura': 'abbreviation',
    u'ab': 'abbreviation',
    u'acr\u00f3nimo': 'acronym',
    u'ac': 'acronym',
    u'code (translation required)': 'code',
    u'\u00edndice': 'index',
    u'i': 'index',
    u'sub\u00edndice': 'subscript',
    u'sub': 'subscript',
    u'super\u00edndice': 'superscript',
    u'sup': 'superscript',
    u'referencia t\u00edtulo': 'title-reference',
    u't\u00edtulo': 'title-reference',
    u't': 'title-reference',
    u'referencia-pep': 'pep-reference',
    u'pep': 'pep-reference',
    u'referencia-rfc': 'rfc-reference',
    u'rfc': 'rfc-reference',
    u'\u00e9nfase': 'emphasis',
    u'forte': 'strong',
    u'literal': 'literal',
    'math (translation required)': 'math',
    u'referencia-nome': 'named-reference',
    u'referencia-an\u00f3nimo': 'anonymous-reference',
    u'referencia-nota ao p\u00e9': 'footnote-reference',
    u'referencia-citaci\u00f3n': 'citation-reference',
    u'referencia-substituci\u00f3n': 'substitution-reference',
    u'destino': 'target',
    u'referencia-uri': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'cru': 'raw',}
"""Mapping of Galician role names to canonical role names for interpreted text.
"""
