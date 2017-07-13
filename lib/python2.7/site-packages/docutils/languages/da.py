# -*- coding: utf-8 -*-
# $Id: da.py 7678 2013-07-03 09:57:36Z milde $
# Author: E D
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Danish-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Forfatter',
      'authors': u'Forfattere',
      'organization': u'Organisation',
      'address': u'Adresse',
      'contact': u'Kontakt',
      'version': u'Version',
      'revision': u'Revision',
      'status': u'Status',
      'date': u'Dato',
      'copyright': u'Copyright',
      'dedication': u'Dedikation',
      'abstract': u'Resumé',
      'attention': u'Giv agt!',
      'caution': u'Pas på!',
      'danger': u'!FARE!',
      'error': u'Fejl',
      'hint': u'Vink',
      'important': u'Vigtigt',
      'note': u'Bemærk',
      'tip': u'Tips',
      'warning': u'Advarsel',
      'contents': u'Indhold'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'forfatter': 'author',
      u'forfattere': 'authors',
      u'organisation': 'organization',
      u'adresse': 'address',
      u'kontakt': 'contact',
      u'version': 'version',
      u'revision': 'revision',
      u'status': 'status',
      u'dato': 'date',
      u'copyright': 'copyright',
      u'dedikation': 'dedication',
      u'resume': 'abstract',
      u'resumé': 'abstract'}
"""Danish (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
