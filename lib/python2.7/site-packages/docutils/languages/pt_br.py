# $Id: pt_br.py 5567 2008-06-03 01:11:03Z goodger $
# Author: David Goodger <goodger@python.org>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Brazilian Portuguese-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Autor',
      'authors': u'Autores',
      'organization': u'Organiza\u00E7\u00E3o',
      'address': u'Endere\u00E7o',
      'contact': u'Contato',
      'version': u'Vers\u00E3o',
      'revision': u'Revis\u00E3o',
      'status': u'Estado',
      'date': u'Data',
      'copyright': u'Copyright',
      'dedication': u'Dedicat\u00F3ria',
      'abstract': u'Resumo',
      'attention': u'Aten\u00E7\u00E3o!',
      'caution': u'Cuidado!',
      'danger': u'PERIGO!',
      'error': u'Erro',
      'hint': u'Sugest\u00E3o',
      'important': u'Importante',
      'note': u'Nota',
      'tip': u'Dica',
      'warning': u'Aviso',
      'contents': u'Sum\u00E1rio'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'autor': 'author',
      u'autores': 'authors',
      u'organiza\u00E7\u00E3o': 'organization',
      u'endere\u00E7o': 'address',
      u'contato': 'contact',
      u'vers\u00E3o': 'version',
      u'revis\u00E3o': 'revision',
      u'estado': 'status',
      u'data': 'date',
      u'copyright': 'copyright',
      u'dedicat\u00F3ria': 'dedication',
      u'resumo': 'abstract'}
"""Brazilian Portuguese (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
