# -*- coding: utf-8 -*-
# $Id: da.py 7678 2013-07-03 09:57:36Z milde $
# Author: E D
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Danish-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'giv agt': 'attention',
      u'pas på': 'caution',
      u'kode': 'code',
      u'kode-blok': 'code',
      u'kildekode': 'code',
      u'fare': 'danger',
      u'fejl': 'error',
      u'vink': 'hint',
      u'vigtigt': 'important',
      u'bemærk': 'note',
      u'tips': 'tip',
      u'advarsel': 'warning',
      u'formaning': 'admonition',
      u'sidebjælke': 'sidebar',
      u'emne': 'topic',
      u'linje-blok': 'line-block',
      u'linie-blok': 'line-block',
      u'parset-literal': 'parsed-literal',
      u'rubrik': 'rubric',
      u'epigraf': 'epigraph',
      u'fremhævninger': 'highlights',
      u'pull-quote (translation required)': 'pull-quote',
      u'compound (translation required)': 'compound',
      u'container (translation required)': 'container',
      #'questions': 'questions',
      u'tabel': 'table',
      u'csv-tabel': 'csv-table',
      u'liste-tabel': 'list-table',
      #'qa': 'questions',
      #'faq': 'questions',
      u'meta': 'meta',
      u'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      u'billede': 'image',
      u'figur': 'figure',
      u'inkludér': 'include',
      u'inkluder': 'include',
      u'rå': 'raw',
      u'erstat': 'replace',
      u'unicode': 'unicode',
      u'dato': 'date',
      u'klasse': 'class',
      u'rolle': 'role',
      u'forvalgt-rolle': 'default-role',
      u'titel': 'title',
      u'indhold': 'contents',
      u'sektnum': 'sectnum',
      u'sektions-nummerering': 'sectnum',
      u'sidehovede': 'header',
      u'sidefod': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'target-notes (translation required)': 'target-notes',
      u'restructuredtext-test-direktiv': 'restructuredtext-test-directive'}
"""Danish name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'forkortelse': 'abbreviation',
    u'fork': 'abbreviation',
    u'akronym': 'acronym',
    u'ac (translation required)': 'acronym',
    u'kode': 'code',
    u'indeks': 'index',
    u'i': 'index',
    u'subscript (translation required)': 'subscript',
    u'sub (translation required)': 'subscript',
    u'superscript (translation required)': 'superscript',
    u'sup (translation required)': 'superscript',
    u'titel-reference': 'title-reference',
    u'titel': 'title-reference',
    u't': 'title-reference',
    u'pep-reference': 'pep-reference',
    u'pep': 'pep-reference',
    u'rfc-reference': 'rfc-reference',
    u'rfc': 'rfc-reference',
    u'emfase': 'emphasis',
    u'kraftig': 'strong',
    u'literal': 'literal',
    u'math (translation required)': 'math',
    u'navngivet-reference': 'named-reference',
    u'anonym-reference': 'anonymous-reference',
    u'fodnote-reference': 'footnote-reference',
    u'citation-reference (translation required)': 'citation-reference',
    u'substitutions-reference': 'substitution-reference',
    u'target (translation required)': 'target',
    u'uri-reference': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'rå': 'raw',}
"""Mapping of Danish role names to canonical role names for interpreted text.
"""
