# $Id: ca.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Ivan Vilata i Balaguer <ivan@selidor.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Catalan-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Autor',
      'authors': u'Autors',
      'organization': u'Organitzaci\u00F3',
      'address': u'Adre\u00E7a',
      'contact': u'Contacte',
      'version': u'Versi\u00F3',
      'revision': u'Revisi\u00F3',
      'status': u'Estat',
      'date': u'Data',
      'copyright': u'Copyright',
      'dedication': u'Dedicat\u00F2ria',
      'abstract': u'Resum',
      'attention': u'Atenci\u00F3!',
      'caution': u'Compte!',
      'danger': u'PERILL!',
      'error': u'Error',
      'hint': u'Suggeriment',
      'important': u'Important',
      'note': u'Nota',
      'tip': u'Consell',
      'warning': u'Av\u00EDs',
      'contents': u'Contingut'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'autor': 'author',
      u'autors': 'authors',
      u'organitzaci\u00F3': 'organization',
      u'adre\u00E7a': 'address',
      u'contacte': 'contact',
      u'versi\u00F3': 'version',
      u'revisi\u00F3': 'revision',
      u'estat': 'status',
      u'data': 'date',
      u'copyright': 'copyright',
      u'dedicat\u00F2ria': 'dedication',
      u'resum': 'abstract'}
"""Catalan (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
