# -*- coding: utf-8 -*-
# $Id: fi.py 7119 2011-09-02 13:00:23Z milde $
# Author: Asko Soukka <asko.soukka@iki.fi>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Finnish-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'huomio': u'attention',
      u'varo': u'caution',
      u'code (translation required)': 'code',
      u'vaara': u'danger',
      u'virhe': u'error',
      u'vihje': u'hint',
      u't\u00e4rke\u00e4\u00e4': u'important',
      u'huomautus': u'note',
      u'neuvo': u'tip',
      u'varoitus': u'warning',
      u'kehotus': u'admonition',
      u'sivupalkki': u'sidebar',
      u'aihe': u'topic',
      u'rivi': u'line-block',
      u'tasalevyinen': u'parsed-literal',
      u'ohje': u'rubric',
      u'epigraafi': u'epigraph',
      u'kohokohdat': u'highlights',
      u'lainaus': u'pull-quote',
      u'taulukko': u'table',
      u'csv-taulukko': u'csv-table',
      u'list-table (translation required)': 'list-table',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      #u'kysymykset': u'questions',
      u'meta': u'meta',
      'math (translation required)': 'math',
      #u'kuvakartta': u'imagemap',
      u'kuva': u'image',
      u'kaavio': u'figure',
      u'sis\u00e4llyt\u00e4': u'include',
      u'raaka': u'raw',
      u'korvaa': u'replace',
      u'unicode': u'unicode',
      u'p\u00e4iv\u00e4ys': u'date',
      u'luokka': u'class',
      u'rooli': u'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      u'sis\u00e4llys': u'contents',
      u'kappale': u'sectnum',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      #u'alaviitteet': u'footnotes',
      #u'viitaukset': u'citations',
      u'target-notes (translation required)': u'target-notes'}
"""Finnish name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'lyhennys': u'abbreviation',
    u'akronyymi': u'acronym',
    u'kirjainsana': u'acronym',
    u'code (translation required)': 'code',
    u'hakemisto': u'index',
    u'luettelo': u'index',
    u'alaindeksi': u'subscript',
    u'indeksi': u'subscript',
    u'yl\u00e4indeksi': u'superscript',
    u'title-reference (translation required)': u'title-reference',
    u'title (translation required)': u'title-reference',
    u'pep-reference (translation required)': u'pep-reference',
    u'rfc-reference (translation required)': u'rfc-reference',
    u'korostus': u'emphasis',
    u'vahvistus': u'strong',
    u'tasalevyinen': u'literal',
    'math (translation required)': 'math',
    u'named-reference (translation required)': u'named-reference',
    u'anonymous-reference (translation required)': u'anonymous-reference',
    u'footnote-reference (translation required)': u'footnote-reference',
    u'citation-reference (translation required)': u'citation-reference',
    u'substitution-reference (translation required)': u'substitution-reference',
    u'kohde': u'target',
    u'uri-reference (translation required)': u'uri-reference',
    u'raw (translation required)': 'raw',}
"""Mapping of Finnish role names to canonical role names for interpreted text.
"""
