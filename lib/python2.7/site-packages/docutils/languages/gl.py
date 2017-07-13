# -*- coding: utf-8 -*-
# Author: David Goodger
# Contact: goodger@users.sourceforge.net
# Revision: $Revision: 2224 $
# Date: $Date: 2004-06-05 21:40:46 +0200 (Sat, 05 Jun 2004) $
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Galician-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Autor',
      'authors': u'Autores',
      'organization': u'Organizaci\u00f3n',
      'address': u'Enderezo',
      'contact': u'Contacto',
      'version': u'Versi\u00f3n',
      'revision': u'Revisi\u00f3n',
      'status': u'Estado',
      'date': u'Data',
      'copyright': u'Dereitos de copia',
      'dedication': u'Dedicatoria',
      'abstract': u'Abstract',
      'attention': u'Atenci\u00f3n!',
      'caution': u'Advertencia!',
      'danger': u'PERIGO!',
      'error': u'Erro',
      'hint': u'Consello',
      'important': u'Importante',
      'note': u'Nota',
      'tip': u'Suxesti\u00f3n',
      'warning': u'Aviso',
      'contents': u'Contido'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'autor': 'author',
      u'autores': 'authors',
      u'organizaci\u00f3n': 'organization',
      u'enderezo': 'address',
      u'contacto': 'contact',
      u'versi\u00f3n': 'version',
      u'revisi\u00f3n': 'revision',
      u'estado': 'status',
      u'data': 'date',
      u'dereitos de copia': 'copyright',
      u'dedicatoria': 'dedication',
      u'abstract': 'abstract'}
"""Galician (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
