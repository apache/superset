# $Id: sv.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Adam Chodorowski <chodorowski@users.sourceforge.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Swedish language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
    'author':       u'F\u00f6rfattare',
    'authors':      u'F\u00f6rfattare',
    'organization': u'Organisation',
    'address':      u'Adress',
    'contact':      u'Kontakt',
    'version':      u'Version',
    'revision':     u'Revision',
    'status':       u'Status',
    'date':         u'Datum',
    'copyright':    u'Copyright',
    'dedication':   u'Dedikation',
    'abstract':     u'Sammanfattning',
    'attention':    u'Observera!',
    'caution':      u'Varning!',
    'danger':       u'FARA!',
    'error':        u'Fel',
    'hint':         u'V\u00e4gledning',
    'important':    u'Viktigt',
    'note':         u'Notera',
    'tip':          u'Tips',
    'warning':      u'Varning',
    'contents':     u'Inneh\u00e5ll' }
"""Mapping of node class name to label text."""

bibliographic_fields = {
    # 'Author' and 'Authors' identical in Swedish; assume the plural:
    u'f\u00f6rfattare': 'authors',
    u' n/a':            'author',
    u'organisation':    'organization',
    u'adress':          'address',
    u'kontakt':         'contact',
    u'version':         'version',
    u'revision':        'revision',
    u'status':          'status',
    u'datum':           'date',
    u'copyright':       'copyright',
    u'dedikation':      'dedication', 
    u'sammanfattning':  'abstract' }
"""Swedish (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
