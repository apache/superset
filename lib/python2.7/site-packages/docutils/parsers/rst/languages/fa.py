# -*- coding: utf-8 -*-
# $Id: fa.py 4564 2016-08-10 11:48:42Z
# Author: Shahin <me@5hah.in>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Persian-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'توجه': u'attention',
      u'احتیاط': u'caution',
      u'کد': u'code',
      u'بلوک-کد': u'code',
      u'کد-منبع': u'code',
      u'خطر': u'danger',
      u'خطا': u'error',
      u'راهنما': u'hint',
      u'مهم': u'important',
      u'یادداشت': u'note',
      u'نکته': u'tip',
      u'اخطار': u'warning',
      u'تذکر': u'admonition',
      u'نوار-کناری': u'sidebar',
      u'موضوع': u'topic',
      u'بلوک-خط': u'line-block',
      u'تلفظ-پردازش-شده': u'parsed-literal',
      u'سر-فصل': u'rubric',
      u'کتیبه': u'epigraph',
      u'نکات-برجسته': u'highlights',
      u'نقل-قول': u'pull-quote',
      u'ترکیب': u'compound',
      u'ظرف': u'container',
      #'questions': u'questions',
      u'جدول': u'table',
      u'جدول-csv': u'csv-table',
      u'جدول-لیست': u'list-table',
      #'qa': u'questions',
      #'faq': u'questions',
      u'متا': u'meta',
      u'ریاضی': u'math',
      #'imagemap': u'imagemap',
      u'تصویر': u'image',
      u'شکل': u'figure',
      u'شامل': u'include',
      u'خام': u'raw',
      u'جایگزین': u'replace',
      u'یونیکد': u'unicode',
      u'تاریخ': u'date',
      u'کلاس': u'class',
      u'قانون': u'role',
      u'قانون-پیش‌فرض': u'default-role',
      u'عنوان': u'title',
      u'محتوا': u'contents',
      u'شماره-فصل': u'sectnum',
      u'شماره‌گذاری-فصل': u'sectnum',
      u'سرآیند': u'header',
      u'پاصفحه': u'footer',
      #'footnotes': u'footnotes',
      #'citations': u'citations',
      u'یادداشت-هدف': u'target-notes',
    }
"""Persian name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'مخفف': u'abbreviation',
    u'سرنام': u'acronym',
    u'کد': u'code',
    u'شاخص': u'index',
    u'زیرنویس': u'subscript',
    u'بالانویس': u'superscript',
    u'عنوان': u'title-reference',
    u'نیرو': u'pep-reference',
    u'rfc-reference (translation required)': u'rfc-reference',
    u'تاکید': u'emphasis',
    u'قوی': u'strong',
    u'لفظی': u'literal',
    u'ریاضی': u'math',
    u'منبع-نام‌گذاری': u'named-reference',
    u'منبع-ناشناس': u'anonymous-reference',
    u'منبع-پانویس': u'footnote-reference',
    u'منبع-نقل‌فول': u'citation-reference',
    u'منبع-جایگزینی': u'substitution-reference',
    u'هدف': u'target',
    u'منبع-uri': u'uri-reference',
    u'uri': u'uri-reference',
    u'url': u'uri-reference',
    u'خام': u'raw',}
"""Mapping of Persian role names to canonical role names for interpreted text.
"""
