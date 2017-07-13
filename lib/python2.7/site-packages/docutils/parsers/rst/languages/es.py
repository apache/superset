# -*- coding: utf-8 -*-
# $Id: es.py 7119 2011-09-02 13:00:23Z milde $
# Author: Marcelo Huerta San Martín <richieadler@users.sourceforge.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Spanish-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      u'atenci\u00f3n': 'attention',
      u'atencion': 'attention',
      u'precauci\u00f3n': 'caution',
      u'code (translation required)': 'code',
      u'precaucion': 'caution',
      u'peligro': 'danger',
      u'error': 'error',
      u'sugerencia': 'hint',
      u'importante': 'important',
      u'nota': 'note',
      u'consejo': 'tip',
      u'advertencia': 'warning',
      u'exhortacion': 'admonition',
      u'exhortaci\u00f3n': 'admonition',
      u'nota-al-margen': 'sidebar',
      u'tema': 'topic',
      u'bloque-de-lineas': 'line-block',
      u'bloque-de-l\u00edneas': 'line-block',
      u'literal-evaluado': 'parsed-literal',
      u'firma': 'rubric',
      u'ep\u00edgrafe': 'epigraph',
      u'epigrafe': 'epigraph',
      u'destacado': 'highlights',
      u'cita-destacada': 'pull-quote',
      u'combinacion': 'compound',
      u'combinaci\u00f3n': 'compound',
      u'contenedor': 'container',
      #'questions': 'questions',
      #'qa': 'questions',
      #'faq': 'questions',
      u'tabla': 'table',
      u'tabla-vsc': 'csv-table',
      u'tabla-csv': 'csv-table',
      u'tabla-lista': 'list-table',
      u'meta': 'meta',
      'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      u'imagen': 'image',
      u'figura': 'figure',
      u'incluir': 'include',
      u'sin-analisis': 'raw',
      u'sin-an\u00e1lisis': 'raw',
      u'reemplazar': 'replace',
      u'unicode': 'unicode',
      u'fecha': 'date',
      u'clase': 'class',
      u'rol': 'role',
      u'rol-por-omision': 'default-role',
      u'rol-por-omisi\u00f3n': 'default-role',
      u'titulo': 'title',
      u't\u00edtulo': 'title',
      u'contenido': 'contents',
      u'numseccion': 'sectnum',
      u'numsecci\u00f3n': 'sectnum',
      u'numeracion-seccion': 'sectnum',
      u'numeraci\u00f3n-secci\u00f3n': 'sectnum',
      u'notas-destino': 'target-notes',
      u'cabecera': 'header',
      u'pie': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'restructuredtext-test-directive': 'restructuredtext-test-directive'}
"""Spanish name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    u'abreviatura': 'abbreviation',
    u'ab': 'abbreviation',
    u'acronimo': 'acronym',
    u'acronimo': 'acronym',
    u'ac': 'acronym',
    u'code (translation required)': 'code',
    u'indice': 'index',
    u'i': 'index',
    u'subindice': 'subscript',
    u'sub\u00edndice': 'subscript',
    u'superindice': 'superscript',
    u'super\u00edndice': 'superscript',
    u'referencia-titulo': 'title-reference',
    u'titulo': 'title-reference',
    u't': 'title-reference',
    u'referencia-pep': 'pep-reference',
    u'pep': 'pep-reference',
    u'referencia-rfc': 'rfc-reference',
    u'rfc': 'rfc-reference',
    u'enfasis': 'emphasis',
    u'\u00e9nfasis': 'emphasis',
    u'destacado': 'strong',
    u'literal': 'literal',              # "literal" is also a word in Spanish :-)
    u'math (translation required)': 'math',
    u'referencia-con-nombre': 'named-reference',
    u'referencia-anonima': 'anonymous-reference',
    u'referencia-an\u00f3nima': 'anonymous-reference',
    u'referencia-nota-al-pie': 'footnote-reference',
    u'referencia-cita': 'citation-reference',
    u'referencia-sustitucion': 'substitution-reference',
    u'referencia-sustituci\u00f3n': 'substitution-reference',
    u'destino': 'target',
    u'referencia-uri': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'sin-analisis': 'raw',
    u'sin-an\u00e1lisis': 'raw',
}
"""Mapping of Spanish role names to canonical role names for interpreted text.
"""
