# -*- coding: utf-8 -*-
# $Id: zh_cn.py 4564 2006-05-21 20:44:42Z wiemann $
# Author: Pan Junyong <panjy@zopechina.com>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Simplified Chinese language mappings for language-dependent features
of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      'author': u'作者',
      'authors': u'作者群',
      'organization': u'组织',
      'address': u'地址',
      'contact': u'联系',
      'version': u'版本',
      'revision': u'修订',
      'status': u'状态',
      'date': u'日期',
      'copyright': u'版权',
      'dedication': u'献辞',
      'abstract': u'摘要',
      'attention': u'注意',
      'caution': u'小心',
      'danger': u'危险',
      'error': u'错误',
      'hint': u'提示',
      'important': u'重要',
      'note': u'注解',
      'tip': u'技巧',
      'warning': u'警告',
      'contents': u'目录',
} 
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'作者': 'author',
      u'作者群': 'authors',
      u'组织': 'organization',
      u'地址': 'address',
      u'联系': 'contact',
      u'版本': 'version',
      u'修订': 'revision',
      u'状态': 'status',
      u'时间': 'date',
      u'版权': 'copyright',
      u'献辞': 'dedication',
      u'摘要': 'abstract'}
"""Simplified Chinese to canonical name mapping for bibliographic fields."""

author_separators = [';', ',',
                     u'\uff1b', # '；'
                     u'\uff0c', # '，'
                     u'\u3001', # '、'
                    ]
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
