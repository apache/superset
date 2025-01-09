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

import { Locale } from 'antd-v5/es/locale';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { ExplorePageState } from 'src/explore/types';

export const LOCALE_MAPPING = {
  en: () => import('antd-v5/locale/en_US'),
  fr: () => import('antd-v5/locale/fr_FR'),
  es: () => import('antd-v5/locale/es_ES'),
  it: () => import('antd-v5/locale/it_IT'),
  zh: () => import('antd-v5/locale/zh_CN'),
  ja: () => import('antd-v5/locale/ja_JP'),
  de: () => import('antd-v5/locale/de_DE'),
  pt: () => import('antd-v5/locale/pt_PT'),
  pt_BR: () => import('antd-v5/locale/pt_BR'),
  ru: () => import('antd-v5/locale/ru_RU'),
  ko: () => import('antd-v5/locale/ko_KR'),
  sk: () => import('antd-v5/locale/sk_SK'),
  sl: () => import('antd-v5/locale/sl_SI'),
  nl: () => import('antd-v5/locale/nl_NL'),
};

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
      if (localFromFlaskBabel && LOCALE_MAPPING[localFromFlaskBabel]) {
        LOCALE_MAPPING[localFromFlaskBabel]()
          .then((locale: { default: Locale }) => {
            setDatePickerLocale(locale.default);
            import(`dayjs/locale/${localFromFlaskBabel}.js`).then(() => {
              dayjs.locale(localFromFlaskBabel);
            });
          })
          .catch(() => setDatePickerLocale(undefined));
      } else {
        setDatePickerLocale(undefined);
      }
    }
  }, [datePickerLocale, localFromFlaskBabel]);

  return datePickerLocale;
};
