# -*- coding: utf-8 -*-
# $Id: ja.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Hisashi Morita <hisashim@kt.rim.or.jp>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Japanese-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'著者',
      'authors': u'著者',
      'organization': u'組織',
      'address': u'住所',
      'contact': u'連絡先',
      'version': u'バージョン',
      'revision': u'リビジョン',
      'status': u'ステータス',
      'date': u'日付',
      'copyright': u'著作権',
      'dedication': u'献辞',
      'abstract': u'概要',
      'attention': u'注目!',
      'caution': u'注意!',
      'danger': u'!危険!',
      'error': u'エラー',
      'hint': u'ヒント',
      'important': u'重要',
      'note': u'備考',
      'tip': u'通報',
      'warning': u'警告',
      'contents': u'目次'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'著者': 'author',
      u' n/a': 'authors',
      u'組織': 'organization',
      u'住所': 'address',
      u'連絡先': 'contact',
      u'バージョン': 'version',
      u'リビジョン': 'revision',
      u'ステータス': 'status',
      u'日付': 'date',
      u'著作権': 'copyright',
      u'献辞': 'dedication',
      u'概要': 'abstract'}
"""Japanese (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
