# -*- coding: utf-8 -*-
# $Id: fa.py 4564 2016-08-10 11:48:42Z
# Author: Shahin <me@5hah.in>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Persian-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      # fixed: language-dependent
      u'author': u'نویسنده',
      u'authors': u'نویسندگان',
      u'organization': u'سازمان',
      u'address': u'آدرس',
      u'contact': u'تماس',
      u'version': u'نسخه',
      u'revision': u'بازبینی',
      u'status': u'وضعیت',
      u'date': u'تاریخ',
      u'copyright': u'کپی‌رایت',
      u'dedication': u'تخصیص',
      u'abstract': u'چکیده',
      u'attention': u'توجه!',
      u'caution': u'احتیاط!',
      u'danger': u'خطر!',
      u'error': u'خطا',
      u'hint': u'راهنما',
      u'important': u'مهم',
      u'note': u'یادداشت',
      u'tip': u'نکته',
      u'warning': u'اخطار',
      u'contents': u'محتوا'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      # language-dependent: fixed
      u'نویسنده': u'author',
      u'نویسندگان': u'authors',
      u'سازمان': u'organization',
      u'آدرس': u'address',
      u'تماس': u'contact',
      u'نسخه': u'version',
      u'بازبینی': u'revision',
      u'وضعیت': u'status',
      u'تاریخ': u'date',
      u'کپی‌رایت': u'copyright',
      u'تخصیص': u'dedication',
      u'چکیده': u'abstract'}
"""Persian (lowcased) to canonical name mapping for bibliographic fields."""

author_separators = [u'؛', u'،']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
