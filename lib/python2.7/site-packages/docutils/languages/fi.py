# $Id: fi.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Asko Soukka <asko.soukka@iki.fi>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Finnish-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      u'author': u'Tekij\u00e4',
      u'authors': u'Tekij\u00e4t',
      u'organization': u'Yhteis\u00f6',
      u'address': u'Osoite',
      u'contact': u'Yhteystiedot',
      u'version': u'Versio',
      u'revision': u'Vedos',
      u'status': u'Tila',
      u'date': u'P\u00e4iv\u00e4ys',
      u'copyright': u'Tekij\u00e4noikeudet',
      u'dedication': u'Omistuskirjoitus',
      u'abstract': u'Tiivistelm\u00e4',
      u'attention': u'Huomio!',
      u'caution': u'Varo!',
      u'danger': u'!VAARA!',
      u'error': u'Virhe',
      u'hint': u'Vihje',
      u'important': u'T\u00e4rke\u00e4\u00e4',
      u'note': u'Huomautus',
      u'tip': u'Neuvo',
      u'warning': u'Varoitus',
      u'contents': u'Sis\u00e4llys'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'tekij\u00e4': u'author',
      u'tekij\u00e4t': u'authors',
      u'yhteis\u00f6': u'organization',
      u'osoite': u'address',
      u'yhteystiedot': u'contact',
      u'versio': u'version',
      u'vedos': u'revision',
      u'tila': u'status',
      u'p\u00e4iv\u00e4ys': u'date',
      u'tekij\u00e4noikeudet': u'copyright',
      u'omistuskirjoitus': u'dedication',
      u'tiivistelm\u00e4': u'abstract'}
"""Finnish (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
