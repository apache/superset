/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { ExplorePageState } from 'src/explore/types';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/it';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/ja';
import 'dayjs/locale/de';
import 'dayjs/locale/pt';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ru';
import 'dayjs/locale/ko';
import 'dayjs/locale/cs';
import 'dayjs/locale/sk';
import 'dayjs/locale/sl';
import 'dayjs/locale/nl';

/* eslint-disable no-restricted-imports */
import { Locale } from 'antd/es/locale';

export const LOCALE_MAPPING = {
  en: () => import('antd/locale/en_US'),
  fr: () => import('antd/locale/fr_FR'),
  es: () => import('antd/locale/es_ES'),
  it: () => import('antd/locale/it_IT'),
  zh: () => import('antd/locale/zh_CN'),
  zh_TW: () => import('antd/locale/zh_TW'),
  ja: () => import('antd/locale/ja_JP'),
  de: () => import('antd/locale/de_DE'),
  pt: () => import('antd/locale/pt_PT'),
  pt_BR: () => import('antd/locale/pt_BR'),
  ru: () => import('antd/locale/ru_RU'),
  ko: () => import('antd/locale/ko_KR'),
  cs: () => import('antd/locale/cs_CZ'),
  sk: () => import('antd/locale/sk_SK'),
  sl: () => import('antd/locale/sl_SI'),
  nl: () => import('antd/locale/nl_NL'),
};
/* eslint-enable no-restricted-imports */

// Babel's generic 'zh' code is treated as Simplified Chinese for date
// formatting: dayjs also ships a bare 'zh' locale, but this project
// imports 'zh-cn' specifically, so 'zh' needs an explicit override here.
const DAYJS_LOCALE_OVERRIDES: Record<string, string> = {
  zh: 'zh-cn',
};

// Flask-Babel locale codes use underscores and mixed case (zh_TW, pt_BR);
// dayjs locale names are lowercase and hyphenated (zh-tw, pt-br). Most
// codes convert with a straight case/separator normalization; only codes
// where dayjs's name isn't just a reformatting of Babel's need an entry
// in DAYJS_LOCALE_OVERRIDES above.
export const toDayjsLocale = (localeCode: string): string =>
  DAYJS_LOCALE_OVERRIDES[localeCode] ??
  localeCode.toLowerCase().replace(/_/g, '-');

export const useLocale = (): Locale | undefined | null => {
  const [datePickerLocale, setDatePickerLocale] = useState<
    Locale | undefined | null
  >(null);

  // Retrieve the locale from Redux store
  const localFromFlaskBabel = useSelector(
    (state: ExplorePageState) => state?.common?.locale,
  );

  useEffect(() => {
    if (datePickerLocale === null) {
      if (
        localFromFlaskBabel &&
        LOCALE_MAPPING[localFromFlaskBabel as keyof typeof LOCALE_MAPPING]
      ) {
        LOCALE_MAPPING[localFromFlaskBabel as keyof typeof LOCALE_MAPPING]()
          .then((locale: { default: Locale }) => {
            setDatePickerLocale(locale.default);
            dayjs.locale(toDayjsLocale(localFromFlaskBabel));
          })
          .catch(() => setDatePickerLocale(undefined));
      } else {
        setDatePickerLocale(undefined);
      }
    }
  }, [datePickerLocale, localFromFlaskBabel]);

  return datePickerLocale;
};
