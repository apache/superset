# $Id$
# Author: Robert Wojciechowicz <rw@smsnet.pl>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Polish-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Autor',
      'authors': u'Autorzy',
      'organization': u'Organizacja',
      'address': u'Adres',
      'contact': u'Kontakt',
      'version': u'Wersja',
      'revision': u'Korekta',
      'status': u'Status',
      'date': u'Data',
      'copyright': u'Copyright',
      'dedication': u'Dedykacja',
      'abstract': u'Streszczenie',
      'attention': u'Uwaga!',
      'caution': u'Ostro\u017cnie!',
      'danger': u'!Niebezpiecze\u0144stwo!',
      'error': u'B\u0142\u0105d',
      'hint': u'Wskaz\u00f3wka',
      'important': u'Wa\u017cne',
      'note': u'Przypis',
      'tip': u'Rada',
      'warning': u'Ostrze\u017cenie',
      'contents': u'Tre\u015b\u0107'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'autor': 'author',
      u'autorzy': 'authors',
      u'organizacja': 'organization',
      u'adres': 'address',
      u'kontakt': 'contact',
      u'wersja': 'version',
      u'korekta': 'revision',
      u'status': 'status',
      u'data': 'date',
      u'copyright': 'copyright',
      u'dedykacja': 'dedication',
      u'streszczenie': 'abstract'}
"""Polish (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""

 	  	 
