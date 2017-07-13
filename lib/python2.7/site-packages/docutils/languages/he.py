# Author: Meir Kriheli
# Id: $Id: he.py 4837 2006-12-26 09:59:41Z sfcben $
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Hebrew-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'\u05de\u05d7\u05d1\u05e8',
      'authors': u'\u05de\u05d7\u05d1\u05e8\u05d9',
      'organization': u'\u05d0\u05e8\u05d2\u05d5\u05df',
      'address': u'\u05db\u05ea\u05d5\u05d1\u05ea',
      'contact':  u'\u05d0\u05d9\u05e9 \u05e7\u05e9\u05e8',
      'version': u'\u05d2\u05e8\u05e1\u05d4',
      'revision': u'\u05de\u05d4\u05d3\u05d5\u05e8\u05d4',
      'status': u'\u05e1\u05d8\u05d8\u05d5\u05e1',
      'date': u'\u05ea\u05d0\u05e8\u05d9\u05da',
      'copyright': u'\u05d6\u05db\u05d5\u05d9\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea',
      'dedication': u'\u05d4\u05e7\u05d3\u05e9\u05d4',
      'abstract': u'\u05ea\u05e7\u05e6\u05d9\u05e8',
      'attention': u'\u05ea\u05e9\u05d5\u05de\u05ea \u05dc\u05d1',
      'caution': u'\u05d6\u05d4\u05d9\u05e8\u05d5\u05ea',
      'danger': u'\u05e1\u05db\u05e0\u05d4',
      'error': u'\u05e9\u05d2\u05d9\u05d0\u05d4' ,
      'hint': u'\u05e8\u05de\u05d6',
      'important': u'\u05d7\u05e9\u05d5\u05d1',
      'note': u'\u05d4\u05e2\u05e8\u05d4',
      'tip': u'\u05d8\u05d9\u05e4',
      'warning': u'\u05d0\u05d6\u05d4\u05e8\u05d4',
      'contents': u'\u05ea\u05d5\u05db\u05df'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'\u05de\u05d7\u05d1\u05e8': 'author',
      u'\u05de\u05d7\u05d1\u05e8\u05d9': 'authors',
      u'\u05d0\u05e8\u05d2\u05d5\u05df': 'organization',
      u'\u05db\u05ea\u05d5\u05d1\u05ea': 'address',
      u'\u05d0\u05d9\u05e9 \u05e7\u05e9\u05e8': 'contact',
      u'\u05d2\u05e8\u05e1\u05d4': 'version',
      u'\u05de\u05d4\u05d3\u05d5\u05e8\u05d4': 'revision',
      u'\u05e1\u05d8\u05d8\u05d5\u05e1': 'status',
      u'\u05ea\u05d0\u05e8\u05d9\u05da': 'date',
      u'\u05d6\u05db\u05d5\u05d9\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea': 'copyright',
      u'\u05d4\u05e7\u05d3\u05e9\u05d4': 'dedication',
      u'\u05ea\u05e7\u05e6\u05d9\u05e8': 'abstract'}
"""Hebrew to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
