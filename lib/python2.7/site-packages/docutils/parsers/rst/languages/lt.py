# -*- coding: utf-8 -*-
# $Id: lt.py 7668 2013-06-04 12:46:30Z milde $
# Author: Dalius Dobravolskas <dalius.do...@gmail.com>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Lithuanian-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'dėmesio': 'attention',
      u'atsargiai': 'caution',
      u'code (translation required)': 'code',
      u'pavojinga': 'danger',
      u'klaida': 'error',
      u'užuomina': 'hint',
      u'svarbu': 'important',
      u'pastaba': 'note',
      u'patarimas': 'tip',
      u'įspėjimas': 'warning',
      u'perspėjimas': 'admonition',
      u'šoninė-juosta': 'sidebar',
      u'tema': 'topic',
      u'linijinis-blokas': 'line-block',
      u'išanalizuotas-literalas': 'parsed-literal',
      u'rubrika': 'rubric',
      u'epigrafas': 'epigraph',
      u'pagridiniai-momentai': 'highlights',
      u'atitraukta-citata': 'pull-quote',
      u'sudėtinis-darinys': 'compound',
      u'konteineris': 'container',
      #'questions': 'questions',
      u'lentelė': 'table',
      u'csv-lentelė': 'csv-table',
      u'sąrašo-lentelė': 'list-table',
      #'qa': 'questions',
      #'faq': 'questions',
      u'meta': 'meta',
      u'matematika': 'math',
      #'imagemap': 'imagemap',
      u'paveiksliukas': 'image',
      u'iliustracija': 'figure',
      u'pridėti': 'include',
      u'žalia': 'raw',
      u'pakeisti': 'replace',
      u'unikodas': 'unicode',
      u'data': 'date',
      u'klasė': 'class',
      u'rolė': 'role',
      u'numatytoji-rolė': 'default-role',
      u'titulas': 'title',
      u'turinys': 'contents',
      u'seknum': 'sectnum',
      u'sekcijos-numeravimas': 'sectnum',
      u'antraštė': 'header',
      u'poraštė': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'nutaikytos-pastaba': 'target-notes',
      u'restructuredtext-testinė-direktyva': 'restructuredtext-test-directive'}
"""Lithuanian name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    'santrumpa': 'abbreviation',
    'sa': 'abbreviation',
    'akronimas': 'acronym',
    'ak': 'acronym',
    u'code (translation required)': 'code',
    'indeksas': 'index',
    'i': 'index',
    u'apatinis-indeksas': 'subscript',
    'sub': 'subscript',
    u'viršutinis-indeksas': 'superscript',
    'sup': 'superscript',
    u'antrašės-nuoroda': 'title-reference',
    u'antraštė': 'title-reference',
    'a': 'title-reference',
    'pep-nuoroda': 'pep-reference',
    'pep': 'pep-reference',
    'rfc-nuoroda': 'rfc-reference',
    'rfc': 'rfc-reference',
    u'paryškinimas': 'emphasis',
    u'sustiprintas': 'strong',
    u'literalas': 'literal',
    u'matematika': 'math',
    u'vardinė-nuoroda': 'named-reference',
    u'anoniminė-nuoroda': 'anonymous-reference',
    u'išnašos-nuoroda': 'footnote-reference',
    u'citatos-nuoroda': 'citation-reference',
    u'pakeitimo-nuoroda': 'substitution-reference',
    u'taikinys': 'target',
    u'uri-nuoroda': 'uri-reference',
    'uri': 'uri-reference',
    'url': 'uri-reference',
    'žalia': 'raw',}
"""Mapping of English role names to canonical role names for interpreted text.
"""
