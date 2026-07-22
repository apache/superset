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
import type { registerLocale } from 'echarts/core';

export type EChartsLocaleOption = Parameters<typeof registerLocale>[1];

// Import the `lang*-obj.js` locale bundles, NOT the plain `lang*.js` ones.
// The plain files are side-effect UMD modules: they call
// `registerLocale` against `require('echarts/lib/echarts')` — a second,
// separate echarts instance from the treeshaken `echarts/core` the app
// uses — and export nothing. Under webpack's CommonJS interop that gives
// `.default === {}`, and registering that empty object under a builtin
// locale name ('EN'/'ZH') wipes out the builtin definitions: every
// time-axis chart then crashes in echarts' time formatter reading
// `time.month` from the empty locale. The `-obj` variants export the
// locale object itself, with no side effects and no duplicate echarts.
//
// Explicit per-locale imports rather than a template-literal dynamic
// import: a computed import makes bundlers build a "context module" over
// echarts/i18n, and resolving that directory through the echarts package's
// `exports` map fails intermittently in webpack incremental builds
// ("Package path ./i18n is exported ... but no valid target file was
// found"). A static map is also the only thing that lets bundlers
// code-split exactly the locales listed here. Keys are Superset locales
// uppercased (see LANGUAGES in superset/config.py); values point at the
// echarts bundle, whose naming differs for some locales (Slovenian is
// langSI, Brazilian Portuguese is langPT-br). Superset locales absent
// from this map fall back to English.
export const LOCALE_LOADERS: Record<
  string,
  () => Promise<{ default: EChartsLocaleOption }>
> = {
  AR: () => import('echarts/i18n/langAR-obj.js'),
  CS: () => import('echarts/i18n/langCS-obj.js'),
  DE: () => import('echarts/i18n/langDE-obj.js'),
  EL: () => import('echarts/i18n/langEL-obj.js'),
  EN: () => import('echarts/i18n/langEN-obj.js'),
  ES: () => import('echarts/i18n/langES-obj.js'),
  FA: () => import('echarts/i18n/langFA-obj.js'),
  FI: () => import('echarts/i18n/langFI-obj.js'),
  FR: () => import('echarts/i18n/langFR-obj.js'),
  HU: () => import('echarts/i18n/langHU-obj.js'),
  IT: () => import('echarts/i18n/langIT-obj.js'),
  JA: () => import('echarts/i18n/langJA-obj.js'),
  KO: () => import('echarts/i18n/langKO-obj.js'),
  LV: () => import('echarts/i18n/langLV-obj.js'),
  NL: () => import('echarts/i18n/langNL-obj.js'),
  PL: () => import('echarts/i18n/langPL-obj.js'),
  RO: () => import('echarts/i18n/langRO-obj.js'),
  PT_BR: () => import('echarts/i18n/langPT-br-obj.js'),
  RU: () => import('echarts/i18n/langRU-obj.js'),
  SL: () => import('echarts/i18n/langSI-obj.js'),
  SV: () => import('echarts/i18n/langSV-obj.js'),
  TH: () => import('echarts/i18n/langTH-obj.js'),
  TR: () => import('echarts/i18n/langTR-obj.js'),
  UK: () => import('echarts/i18n/langUK-obj.js'),
  VI: () => import('echarts/i18n/langVI-obj.js'),
  ZH: () => import('echarts/i18n/langZH-obj.js'),
};

/**
 * Resolve the ECharts locale object for a Superset locale, or undefined
 * when the locale is unsupported or the bundle yields no usable content.
 * Returning undefined makes the caller skip `registerLocale`, so echarts
 * keeps its builtin locale definitions instead of having them overwritten
 * by an empty object.
 */
export const loadLocale = async (
  locale: string,
): Promise<EChartsLocaleOption | undefined> => {
  const loader = LOCALE_LOADERS[locale];
  if (!loader) {
    // Locale not supported in ECharts
    return undefined;
  }
  try {
    const mod = await loader();
    // Depending on the module system, the locale object is either the
    // module's default export or the module namespace itself.
    const localeObj = mod.default ?? (mod as unknown as EChartsLocaleOption);
    if (localeObj && Object.keys(localeObj).length > 0) {
      return localeObj;
    }
  } catch {
    // fall through to the builtin locale
  }
  return undefined;
};
