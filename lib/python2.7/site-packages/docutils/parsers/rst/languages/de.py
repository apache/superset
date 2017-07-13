# -*- coding: utf-8 -*-
# $Id: de.py 7223 2011-11-21 16:43:06Z milde $
# Authors: Engelbert Gruber <grubert@users.sourceforge.net>;
#          Lea Wiemann <LeWiemann@gmail.com>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
German-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      'achtung': 'attention',
      'vorsicht': 'caution',
      'code': 'code',
      'gefahr': 'danger',
      'fehler': 'error',
      'hinweis': 'hint',
      'wichtig': 'important',
      'notiz': 'note',
      'tipp': 'tip',
      'warnung': 'warning',
      'ermahnung': 'admonition',
      'kasten': 'sidebar',
      'seitenkasten': 'sidebar',
      'thema': 'topic',
      'zeilen-block': 'line-block',
      'parsed-literal (translation required)': 'parsed-literal',
      'rubrik': 'rubric',
      'epigraph': 'epigraph',
      'highlights (translation required)': 'highlights',
      u'pull-quote': 'pull-quote', # commonly used in German too
      u'seitenansprache': 'pull-quote', # cf. http://www.typografie.info/2/wiki.php?title=Seitenansprache
      'zusammengesetzt': 'compound',
      'verbund': 'compound',
      u'container': 'container',
      #'fragen': 'questions',
      'tabelle': 'table',
      'csv-tabelle': 'csv-table',
      'list-table (translation required)': 'list-table',
      u'mathe': 'math',
      u'formel': 'math',
      'meta': 'meta',
      #'imagemap': 'imagemap',
      'bild': 'image',
      'abbildung': 'figure',
      u'unverändert': 'raw',
      u'roh': 'raw',
      u'einfügen': 'include',
      'ersetzung': 'replace',
      'ersetzen': 'replace',
      'ersetze': 'replace',
      'unicode': 'unicode',
      'datum': 'date',
      'klasse': 'class',
      'rolle': 'role',
      u'default-role (translation required)': 'default-role',
      u'title (translation required)': 'title',
      'inhalt': 'contents',
      'kapitel-nummerierung': 'sectnum',
      'abschnitts-nummerierung': 'sectnum',
      u'linkziel-fußfnoten': 'target-notes',
      u'header (translation required)': 'header',
      u'footer (translation required)': 'footer',
      #u'fußfnoten': 'footnotes',
      #'zitate': 'citations',
      }
"""German name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
      u'abkürzung': 'abbreviation',
      'akronym': 'acronym',
      u'code': 'code',
      'index': 'index',
      'tiefgestellt': 'subscript',
      'hochgestellt': 'superscript',
      'titel-referenz': 'title-reference',
      'pep-referenz': 'pep-reference',
      'rfc-referenz': 'rfc-reference',
      'betonung': 'emphasis',
      'fett': 'strong',
      u'wörtlich': 'literal',
      u'mathe': 'math',
      'benannte-referenz': 'named-reference',
      'unbenannte-referenz': 'anonymous-reference',
      u'fußfnoten-referenz': 'footnote-reference',
      'zitat-referenz': 'citation-reference',
      'ersetzungs-referenz': 'substitution-reference',
      'ziel': 'target',
      'uri-referenz': 'uri-reference',
      u'unverändert': 'raw',
      u'roh': 'raw',}
"""Mapping of German role names to canonical role names for interpreted text.
"""
