#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright 2009 Facebook
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

"""Translation methods for generating localized strings.

To load a locale and generate a translated string::

    user_locale = tornado.locale.get("es_LA")
    print user_locale.translate("Sign out")

`tornado.locale.get()` returns the closest matching locale, not necessarily the
specific locale you requested. You can support pluralization with
additional arguments to `~Locale.translate()`, e.g.::

    people = [...]
    message = user_locale.translate(
        "%(list)s is online", "%(list)s are online", len(people))
    print message % {"list": user_locale.list(people)}

The first string is chosen if ``len(people) == 1``, otherwise the second
string is chosen.

Applications should call one of `load_translations` (which uses a simple
CSV format) or `load_gettext_translations` (which uses the ``.mo`` format
supported by `gettext` and related tools).  If neither method is called,
the `Locale.translate` method will simply return the original string.
"""

from __future__ import absolute_import, division, print_function, with_statement

import csv
import datetime
import numbers
import os
import re

from tornado import escape
from tornado.log import gen_log
from tornado.util import u

_default_locale = "en_US"
_translations = {}
_supported_locales = frozenset([_default_locale])
_use_gettext = False
CONTEXT_SEPARATOR = "\x04"


def get(*locale_codes):
    """Returns the closest match for the given locale codes.

    We iterate over all given locale codes in order. If we have a tight
    or a loose match for the code (e.g., "en" for "en_US"), we return
    the locale. Otherwise we move to the next code in the list.

    By default we return ``en_US`` if no translations are found for any of
    the specified locales. You can change the default locale with
    `set_default_locale()`.
    """
    return Locale.get_closest(*locale_codes)


def set_default_locale(code):
    """Sets the default locale.

    The default locale is assumed to be the language used for all strings
    in the system. The translations loaded from disk are mappings from
    the default locale to the destination locale. Consequently, you don't
    need to create a translation file for the default locale.
    """
    global _default_locale
    global _supported_locales
    _default_locale = code
    _supported_locales = frozenset(list(_translations.keys()) + [_default_locale])


def load_translations(directory):
    """Loads translations from CSV files in a directory.

    Translations are strings with optional Python-style named placeholders
    (e.g., ``My name is %(name)s``) and their associated translations.

    The directory should have translation files of the form ``LOCALE.csv``,
    e.g. ``es_GT.csv``. The CSV files should have two or three columns: string,
    translation, and an optional plural indicator. Plural indicators should
    be one of "plural" or "singular". A given string can have both singular
    and plural forms. For example ``%(name)s liked this`` may have a
    different verb conjugation depending on whether %(name)s is one
    name or a list of names. There should be two rows in the CSV file for
    that string, one with plural indicator "singular", and one "plural".
    For strings with no verbs that would change on translation, simply
    use "unknown" or the empty string (or don't include the column at all).

    The file is read using the `csv` module in the default "excel" dialect.
    In this format there should not be spaces after the commas.

    Example translation ``es_LA.csv``::

        "I love you","Te amo"
        "%(name)s liked this","A %(name)s les gustó esto","plural"
        "%(name)s liked this","A %(name)s le gustó esto","singular"

    """
    global _translations
    global _supported_locales
    _translations = {}
    for path in os.listdir(directory):
        if not path.endswith(".csv"):
            continue
        locale, extension = path.split(".")
        if not re.match("[a-z]+(_[A-Z]+)?$", locale):
            gen_log.error("Unrecognized locale %r (path: %s)", locale,
                          os.path.join(directory, path))
            continue
        full_path = os.path.join(directory, path)
        try:
            # python 3: csv.reader requires a file open in text mode.
            # Force utf8 to avoid dependence on $LANG environment variable.
            f = open(full_path, "r", encoding="utf-8")
        except TypeError:
            # python 2: files return byte strings, which are decoded below.
            f = open(full_path, "r")
        _translations[locale] = {}
        for i, row in enumerate(csv.reader(f)):
            if not row or len(row) < 2:
                continue
            row = [escape.to_unicode(c).strip() for c in row]
            english, translation = row[:2]
            if len(row) > 2:
                plural = row[2] or "unknown"
            else:
                plural = "unknown"
            if plural not in ("plural", "singular", "unknown"):
                gen_log.error("Unrecognized plural indicator %r in %s line %d",
                              plural, path, i + 1)
                continue
            _translations[locale].setdefault(plural, {})[english] = translation
        f.close()
    _supported_locales = frozenset(list(_translations.keys()) + [_default_locale])
    gen_log.debug("Supported locales: %s", sorted(_supported_locales))


def load_gettext_translations(directory, domain):
    """Loads translations from `gettext`'s locale tree

    Locale tree is similar to system's ``/usr/share/locale``, like::

        {directory}/{lang}/LC_MESSAGES/{domain}.mo

    Three steps are required to have you app translated:

    1. Generate POT translation file::

        xgettext --language=Python --keyword=_:1,2 -d mydomain file1.py file2.html etc

    2. Merge against existing POT file::

        msgmerge old.po mydomain.po > new.po

    3. Compile::

        msgfmt mydomain.po -o {directory}/pt_BR/LC_MESSAGES/mydomain.mo
    """
    import gettext
    global _translations
    global _supported_locales
    global _use_gettext
    _translations = {}
    for lang in os.listdir(directory):
        if lang.startswith('.'):
            continue  # skip .svn, etc
        if os.path.isfile(os.path.join(directory, lang)):
            continue
        try:
            os.stat(os.path.join(directory, lang, "LC_MESSAGES", domain + ".mo"))
            _translations[lang] = gettext.translation(domain, directory,
                                                      languages=[lang])
        except Exception as e:
            gen_log.error("Cannot load translation for '%s': %s", lang, str(e))
            continue
    _supported_locales = frozenset(list(_translations.keys()) + [_default_locale])
    _use_gettext = True
    gen_log.debug("Supported locales: %s", sorted(_supported_locales))


def get_supported_locales():
    """Returns a list of all the supported locale codes."""
    return _supported_locales


class Locale(object):
    """Object representing a locale.

    After calling one of `load_translations` or `load_gettext_translations`,
    call `get` or `get_closest` to get a Locale object.
    """
    @classmethod
    def get_closest(cls, *locale_codes):
        """Returns the closest match for the given locale code."""
        for code in locale_codes:
            if not code:
                continue
            code = code.replace("-", "_")
            parts = code.split("_")
            if len(parts) > 2:
                continue
            elif len(parts) == 2:
                code = parts[0].lower() + "_" + parts[1].upper()
            if code in _supported_locales:
                return cls.get(code)
            if parts[0].lower() in _supported_locales:
                return cls.get(parts[0].lower())
        return cls.get(_default_locale)

    @classmethod
    def get(cls, code):
        """Returns the Locale for the given locale code.

        If it is not supported, we raise an exception.
        """
        if not hasattr(cls, "_cache"):
            cls._cache = {}
        if code not in cls._cache:
            assert code in _supported_locales
            translations = _translations.get(code, None)
            if translations is None:
                locale = CSVLocale(code, {})
            elif _use_gettext:
                locale = GettextLocale(code, translations)
            else:
                locale = CSVLocale(code, translations)
            cls._cache[code] = locale
        return cls._cache[code]

    def __init__(self, code, translations):
        self.code = code
        self.name = LOCALE_NAMES.get(code, {}).get("name", u("Unknown"))
        self.rtl = False
        for prefix in ["fa", "ar", "he"]:
            if self.code.startswith(prefix):
                self.rtl = True
                break
        self.translations = translations

        # Initialize strings for date formatting
        _ = self.translate
        self._months = [
            _("January"), _("February"), _("March"), _("April"),
            _("May"), _("June"), _("July"), _("August"),
            _("September"), _("October"), _("November"), _("December")]
        self._weekdays = [
            _("Monday"), _("Tuesday"), _("Wednesday"), _("Thursday"),
            _("Friday"), _("Saturday"), _("Sunday")]

    def translate(self, message, plural_message=None, count=None):
        """Returns the translation for the given message for this locale.

        If ``plural_message`` is given, you must also provide
        ``count``. We return ``plural_message`` when ``count != 1``,
        and we return the singular form for the given message when
        ``count == 1``.
        """
        raise NotImplementedError()

    def pgettext(self, context, message, plural_message=None, count=None):
        raise NotImplementedError()

    def format_date(self, date, gmt_offset=0, relative=True, shorter=False,
                    full_format=False):
        """Formats the given date (which should be GMT).

        By default, we return a relative time (e.g., "2 minutes ago"). You
        can return an absolute date string with ``relative=False``.

        You can force a full format date ("July 10, 1980") with
        ``full_format=True``.

        This method is primarily intended for dates in the past.
        For dates in the future, we fall back to full format.
        """
        if isinstance(date, numbers.Real):
            date = datetime.datetime.utcfromtimestamp(date)
        now = datetime.datetime.utcnow()
        if date > now:
            if relative and (date - now).seconds < 60:
                # Due to click skew, things are some things slightly
                # in the future. Round timestamps in the immediate
                # future down to now in relative mode.
                date = now
            else:
                # Otherwise, future dates always use the full format.
                full_format = True
        local_date = date - datetime.timedelta(minutes=gmt_offset)
        local_now = now - datetime.timedelta(minutes=gmt_offset)
        local_yesterday = local_now - datetime.timedelta(hours=24)
        difference = now - date
        seconds = difference.seconds
        days = difference.days

        _ = self.translate
        format = None
        if not full_format:
            if relative and days == 0:
                if seconds < 50:
                    return _("1 second ago", "%(seconds)d seconds ago",
                             seconds) % {"seconds": seconds}

                if seconds < 50 * 60:
                    minutes = round(seconds / 60.0)
                    return _("1 minute ago", "%(minutes)d minutes ago",
                             minutes) % {"minutes": minutes}

                hours = round(seconds / (60.0 * 60))
                return _("1 hour ago", "%(hours)d hours ago",
                         hours) % {"hours": hours}

            if days == 0:
                format = _("%(time)s")
            elif days == 1 and local_date.day == local_yesterday.day and \
                    relative:
                format = _("yesterday") if shorter else \
                    _("yesterday at %(time)s")
            elif days < 5:
                format = _("%(weekday)s") if shorter else \
                    _("%(weekday)s at %(time)s")
            elif days < 334:  # 11mo, since confusing for same month last year
                format = _("%(month_name)s %(day)s") if shorter else \
                    _("%(month_name)s %(day)s at %(time)s")

        if format is None:
            format = _("%(month_name)s %(day)s, %(year)s") if shorter else \
                _("%(month_name)s %(day)s, %(year)s at %(time)s")

        tfhour_clock = self.code not in ("en", "en_US", "zh_CN")
        if tfhour_clock:
            str_time = "%d:%02d" % (local_date.hour, local_date.minute)
        elif self.code == "zh_CN":
            str_time = "%s%d:%02d" % (
                (u('\u4e0a\u5348'), u('\u4e0b\u5348'))[local_date.hour >= 12],
                local_date.hour % 12 or 12, local_date.minute)
        else:
            str_time = "%d:%02d %s" % (
                local_date.hour % 12 or 12, local_date.minute,
                ("am", "pm")[local_date.hour >= 12])

        return format % {
            "month_name": self._months[local_date.month - 1],
            "weekday": self._weekdays[local_date.weekday()],
            "day": str(local_date.day),
            "year": str(local_date.year),
            "time": str_time
        }

    def format_day(self, date, gmt_offset=0, dow=True):
        """Formats the given date as a day of week.

        Example: "Monday, January 22". You can remove the day of week with
        ``dow=False``.
        """
        local_date = date - datetime.timedelta(minutes=gmt_offset)
        _ = self.translate
        if dow:
            return _("%(weekday)s, %(month_name)s %(day)s") % {
                "month_name": self._months[local_date.month - 1],
                "weekday": self._weekdays[local_date.weekday()],
                "day": str(local_date.day),
            }
        else:
            return _("%(month_name)s %(day)s") % {
                "month_name": self._months[local_date.month - 1],
                "day": str(local_date.day),
            }

    def list(self, parts):
        """Returns a comma-separated list for the given list of parts.

        The format is, e.g., "A, B and C", "A and B" or just "A" for lists
        of size 1.
        """
        _ = self.translate
        if len(parts) == 0:
            return ""
        if len(parts) == 1:
            return parts[0]
        comma = u(' \u0648 ') if self.code.startswith("fa") else u(", ")
        return _("%(commas)s and %(last)s") % {
            "commas": comma.join(parts[:-1]),
            "last": parts[len(parts) - 1],
        }

    def friendly_number(self, value):
        """Returns a comma-separated number for the given integer."""
        if self.code not in ("en", "en_US"):
            return str(value)
        value = str(value)
        parts = []
        while value:
            parts.append(value[-3:])
            value = value[:-3]
        return ",".join(reversed(parts))


class CSVLocale(Locale):
    """Locale implementation using tornado's CSV translation format."""
    def translate(self, message, plural_message=None, count=None):
        if plural_message is not None:
            assert count is not None
            if count != 1:
                message = plural_message
                message_dict = self.translations.get("plural", {})
            else:
                message_dict = self.translations.get("singular", {})
        else:
            message_dict = self.translations.get("unknown", {})
        return message_dict.get(message, message)

    def pgettext(self, context, message, plural_message=None, count=None):
        if self.translations:
            gen_log.warning('pgettext is not supported by CSVLocale')
        return self.translate(message, plural_message, count)


class GettextLocale(Locale):
    """Locale implementation using the `gettext` module."""
    def __init__(self, code, translations):
        try:
            # python 2
            self.ngettext = translations.ungettext
            self.gettext = translations.ugettext
        except AttributeError:
            # python 3
            self.ngettext = translations.ngettext
            self.gettext = translations.gettext
        # self.gettext must exist before __init__ is called, since it
        # calls into self.translate
        super(GettextLocale, self).__init__(code, translations)

    def translate(self, message, plural_message=None, count=None):
        if plural_message is not None:
            assert count is not None
            return self.ngettext(message, plural_message, count)
        else:
            return self.gettext(message)

    def pgettext(self, context, message, plural_message=None, count=None):
        """Allows to set context for translation, accepts plural forms.

        Usage example::

            pgettext("law", "right")
            pgettext("good", "right")

        Plural message example::

            pgettext("organization", "club", "clubs", len(clubs))
            pgettext("stick", "club", "clubs", len(clubs))

        To generate POT file with context, add following options to step 1
        of `load_gettext_translations` sequence::

            xgettext [basic options] --keyword=pgettext:1c,2 --keyword=pgettext:1c,2,3

        .. versionadded:: 4.2
        """
        if plural_message is not None:
            assert count is not None
            msgs_with_ctxt = ("%s%s%s" % (context, CONTEXT_SEPARATOR, message),
                          "%s%s%s" % (context, CONTEXT_SEPARATOR, plural_message),
                          count)
            result = self.ngettext(*msgs_with_ctxt)
            if CONTEXT_SEPARATOR in result:
                # Translation not found
                result = self.ngettext(message, plural_message, count)
            return result
        else:
            msg_with_ctxt = "%s%s%s" % (context, CONTEXT_SEPARATOR, message)
            result = self.gettext(msg_with_ctxt)
            if CONTEXT_SEPARATOR in result:
                # Translation not found
                result = message
            return result

LOCALE_NAMES = {
    "af_ZA": {"name_en": u("Afrikaans"), "name": u("Afrikaans")},
    "am_ET": {"name_en": u("Amharic"), "name": u('\u12a0\u121b\u122d\u129b')},
    "ar_AR": {"name_en": u("Arabic"), "name": u("\u0627\u0644\u0639\u0631\u0628\u064a\u0629")},
    "bg_BG": {"name_en": u("Bulgarian"), "name": u("\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438")},
    "bn_IN": {"name_en": u("Bengali"), "name": u("\u09ac\u09be\u0982\u09b2\u09be")},
    "bs_BA": {"name_en": u("Bosnian"), "name": u("Bosanski")},
    "ca_ES": {"name_en": u("Catalan"), "name": u("Catal\xe0")},
    "cs_CZ": {"name_en": u("Czech"), "name": u("\u010ce\u0161tina")},
    "cy_GB": {"name_en": u("Welsh"), "name": u("Cymraeg")},
    "da_DK": {"name_en": u("Danish"), "name": u("Dansk")},
    "de_DE": {"name_en": u("German"), "name": u("Deutsch")},
    "el_GR": {"name_en": u("Greek"), "name": u("\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac")},
    "en_GB": {"name_en": u("English (UK)"), "name": u("English (UK)")},
    "en_US": {"name_en": u("English (US)"), "name": u("English (US)")},
    "es_ES": {"name_en": u("Spanish (Spain)"), "name": u("Espa\xf1ol (Espa\xf1a)")},
    "es_LA": {"name_en": u("Spanish"), "name": u("Espa\xf1ol")},
    "et_EE": {"name_en": u("Estonian"), "name": u("Eesti")},
    "eu_ES": {"name_en": u("Basque"), "name": u("Euskara")},
    "fa_IR": {"name_en": u("Persian"), "name": u("\u0641\u0627\u0631\u0633\u06cc")},
    "fi_FI": {"name_en": u("Finnish"), "name": u("Suomi")},
    "fr_CA": {"name_en": u("French (Canada)"), "name": u("Fran\xe7ais (Canada)")},
    "fr_FR": {"name_en": u("French"), "name": u("Fran\xe7ais")},
    "ga_IE": {"name_en": u("Irish"), "name": u("Gaeilge")},
    "gl_ES": {"name_en": u("Galician"), "name": u("Galego")},
    "he_IL": {"name_en": u("Hebrew"), "name": u("\u05e2\u05d1\u05e8\u05d9\u05ea")},
    "hi_IN": {"name_en": u("Hindi"), "name": u("\u0939\u093f\u0928\u094d\u0926\u0940")},
    "hr_HR": {"name_en": u("Croatian"), "name": u("Hrvatski")},
    "hu_HU": {"name_en": u("Hungarian"), "name": u("Magyar")},
    "id_ID": {"name_en": u("Indonesian"), "name": u("Bahasa Indonesia")},
    "is_IS": {"name_en": u("Icelandic"), "name": u("\xcdslenska")},
    "it_IT": {"name_en": u("Italian"), "name": u("Italiano")},
    "ja_JP": {"name_en": u("Japanese"), "name": u("\u65e5\u672c\u8a9e")},
    "ko_KR": {"name_en": u("Korean"), "name": u("\ud55c\uad6d\uc5b4")},
    "lt_LT": {"name_en": u("Lithuanian"), "name": u("Lietuvi\u0173")},
    "lv_LV": {"name_en": u("Latvian"), "name": u("Latvie\u0161u")},
    "mk_MK": {"name_en": u("Macedonian"), "name": u("\u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438")},
    "ml_IN": {"name_en": u("Malayalam"), "name": u("\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02")},
    "ms_MY": {"name_en": u("Malay"), "name": u("Bahasa Melayu")},
    "nb_NO": {"name_en": u("Norwegian (bokmal)"), "name": u("Norsk (bokm\xe5l)")},
    "nl_NL": {"name_en": u("Dutch"), "name": u("Nederlands")},
    "nn_NO": {"name_en": u("Norwegian (nynorsk)"), "name": u("Norsk (nynorsk)")},
    "pa_IN": {"name_en": u("Punjabi"), "name": u("\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40")},
    "pl_PL": {"name_en": u("Polish"), "name": u("Polski")},
    "pt_BR": {"name_en": u("Portuguese (Brazil)"), "name": u("Portugu\xeas (Brasil)")},
    "pt_PT": {"name_en": u("Portuguese (Portugal)"), "name": u("Portugu\xeas (Portugal)")},
    "ro_RO": {"name_en": u("Romanian"), "name": u("Rom\xe2n\u0103")},
    "ru_RU": {"name_en": u("Russian"), "name": u("\u0420\u0443\u0441\u0441\u043a\u0438\u0439")},
    "sk_SK": {"name_en": u("Slovak"), "name": u("Sloven\u010dina")},
    "sl_SI": {"name_en": u("Slovenian"), "name": u("Sloven\u0161\u010dina")},
    "sq_AL": {"name_en": u("Albanian"), "name": u("Shqip")},
    "sr_RS": {"name_en": u("Serbian"), "name": u("\u0421\u0440\u043f\u0441\u043a\u0438")},
    "sv_SE": {"name_en": u("Swedish"), "name": u("Svenska")},
    "sw_KE": {"name_en": u("Swahili"), "name": u("Kiswahili")},
    "ta_IN": {"name_en": u("Tamil"), "name": u("\u0ba4\u0bae\u0bbf\u0bb4\u0bcd")},
    "te_IN": {"name_en": u("Telugu"), "name": u("\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41")},
    "th_TH": {"name_en": u("Thai"), "name": u("\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22")},
    "tl_PH": {"name_en": u("Filipino"), "name": u("Filipino")},
    "tr_TR": {"name_en": u("Turkish"), "name": u("T\xfcrk\xe7e")},
    "uk_UA": {"name_en": u("Ukraini "), "name": u("\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430")},
    "vi_VN": {"name_en": u("Vietnamese"), "name": u("Ti\u1ebfng Vi\u1ec7t")},
    "zh_CN": {"name_en": u("Chinese (Simplified)"), "name": u("\u4e2d\u6587(\u7b80\u4f53)")},
    "zh_TW": {"name_en": u("Chinese (Traditional)"), "name": u("\u4e2d\u6587(\u7e41\u9ad4)")},
}
