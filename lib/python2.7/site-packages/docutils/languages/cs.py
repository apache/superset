# $Id: cs.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Marek Blaha <mb@dat.cz>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Czech-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'Autor',
      'authors': u'Auto\u0159i',
      'organization': u'Organizace',
      'address': u'Adresa',
      'contact': u'Kontakt',
      'version': u'Verze',
      'revision': u'Revize',
      'status': u'Stav',
      'date': u'Datum',
      'copyright': u'Copyright',
      'dedication': u'V\u011Bnov\u00E1n\u00ED',
      'abstract': u'Abstrakt',
      'attention': u'Pozor!',
      'caution': u'Opatrn\u011B!',
      'danger': u'!NEBEZPE\u010C\u00CD!',
      'error': u'Chyba',
      'hint': u'Rada',
      'important': u'D\u016Fle\u017Eit\u00E9',
      'note': u'Pozn\u00E1mka',
      'tip': u'Tip',
      'warning': u'Varov\u00E1n\u00ED',
      'contents': u'Obsah'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'autor': 'author',
      u'auto\u0159i': 'authors',
      u'organizace': 'organization',
      u'adresa': 'address',
      u'kontakt': 'contact',
      u'verze': 'version',
      u'revize': 'revision',
      u'stav': 'status',
      u'datum': 'date',
      u'copyright': 'copyright',
      u'v\u011Bnov\u00E1n\u00ED': 'dedication',
      u'abstrakt': 'abstract'}
"""Czech (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
