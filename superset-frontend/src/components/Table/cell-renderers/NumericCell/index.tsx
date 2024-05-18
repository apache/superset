/* eslint-disable @typescript-eslint/naming-convention */
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
import { logging } from '@superset-ui/core';

export interface NumericCellProps {
  /**
   * The number to display (before optional formatting applied)
   */
  value: number;
  /**
   * ISO 639-1 language code with optional region or script modifier (e.g. en_US).
   */
  locale?: LocaleCode;
  /**
   * Options for number formatting
   */
  options?: NumberOptions;
}

export enum LocaleCode {
  af = 'af',
  ak = 'ak',
  sq = 'sq',
  am = 'am',
  ar = 'ar',
  hy = 'hy',
  as = 'as',
  az = 'az',
  bm = 'bm',
  bn = 'bn',
  eu = 'eu',
  be = 'be',
  bs = 'bs',
  br = 'br',
  bg = 'bg',
  my = 'my',
  ca = 'ca',
  ce = 'ce',
  zh = 'zh',
  zh_Hans = 'zh-Hans',
  zh_Hant = 'zh-Hant',
  cu = 'cu',
  kw = 'kw',
  co = 'co',
  hr = 'hr',
  cs = 'cs',
  da = 'da',
  nl = 'nl',
  nl_BE = 'nl-BE',
  dz = 'dz',
  en = 'en',
  en_AU = 'en-AU',
  en_CA = 'en-CA',
  en_GB = 'en-GB',
  en_US = 'en-US',
  eo = 'eo',
  et = 'et',
  ee = 'ee',
  fo = 'fo',
  fi = 'fi',
  fr = 'fr',
  fr_CA = 'fr-CA',
  fr_CH = 'fr-CH',
  ff = 'ff',
  gl = 'gl',
  lg = 'lg',
  ka = 'ka',
  de = 'de',
  de_AT = 'de-AT',
  de_CH = 'de-CH',
  el = 'el',
  gu = 'gu',
  ht = 'ht',
  ha = 'ha',
  he = 'he',
  hi = 'hi',
  hu = 'hu',
  is = 'is',
  ig = 'ig',
  id = 'id',
  ia = 'ia',
  ga = 'ga',
  it = 'it',
  ja = 'ja',
  jv = 'jv',
  kl = 'kl',
  kn = 'kn',
  ks = 'ks',
  kk = 'kk',
  km = 'km',
  ki = 'ki',
  rw = 'rw',
  ko = 'ko',
  ku = 'ku',
  ky = 'ky',
  lo = 'lo',
  la = 'la',
  lv = 'lv',
  ln = 'ln',
  lt = 'lt',
  lu = 'lu',
  lb = 'lb',
  mk = 'mk',
  mg = 'mg',
  ms = 'ms',
  ml = 'ml',
  mt = 'mt',
  gv = 'gv',
  mi = 'mi',
  mr = 'mr',
  mn = 'mn',
  ne = 'ne',
  nd = 'nd',
  se = 'se',
  nb = 'nb',
  nn = 'nn',
  ny = 'ny',
  or = 'or',
  om = 'om',
  os = 'os',
  ps = 'ps',
  fa = 'fa',
  fa_AF = 'fa-AF',
  pl = 'pl',
  pt = 'pt',
  pt_BR = 'pt-BR',
  pt_PT = 'pt-PT',
  pa = 'pa',
  qu = 'qu',
  ro = 'ro',
  ro_MD = 'ro-MD',
  rm = 'rm',
  rn = 'rn',
  ru = 'ru',
  sm = 'sm',
  sg = 'sg',
  sa = 'sa',
  gd = 'gd',
  sr = 'sr',
  sn = 'sn',
  ii = 'ii',
  sd = 'sd',
  si = 'si',
  sk = 'sk',
  sl = 'sl',
  so = 'so',
  st = 'st',
  es = 'es',
  es_ES = 'es-ES',
  es_MX = 'es-MX',
  su = 'su',
  sw = 'sw',
  sw_CD = 'sw-CD',
  sv = 'sv',
  tg = 'tg',
  ta = 'ta',
  tt = 'tt',
  te = 'te',
  th = 'th',
  bo = 'bo',
  ti = 'ti',
  to = 'to',
  tr = 'tr',
  tk = 'tk',
  uk = 'uk',
  ur = 'ur',
  ug = 'ug',
  uz = 'uz',
  vi = 'vi',
  vo = 'vo',
  cy = 'cy',
  fy = 'fy',
  wo = 'wo',
  xh = 'xh',
  yi = 'yi',
  yo = 'yo',
  zu = 'zu',
}

export enum CurrencyCode {
  AED = 'AED',
  AFN = 'AFN',
  ALL = 'ALL',
  AMD = 'AMD',
  ANG = 'ANG',
  AOA = 'AOA',
  ARS = 'ARS',
  AUD = 'AUD',
  AWG = 'AWG',
  AZN = 'AZN',
  BAM = 'BAM',
  BBD = 'BBD',
  BDT = 'BDT',
  BGN = 'BGN',
  BHD = 'BHD',
  BIF = 'BIF',
  BMD = 'BMD',
  BND = 'BND',
  BOB = 'BOB',
  BRL = 'BRL',
  BSD = 'BSD',
  BTN = 'BTN',
  BWP = 'BWP',
  BYN = 'BYN',
  BZD = 'BZD',
  CAD = 'CAD',
  CDF = 'CDF',
  CHF = 'CHF',
  CLP = 'CLP',
  CNY = 'CNY',
  COP = 'COP',
  CRC = 'CRC',
  CUC = 'CUC',
  CUP = 'CUP',
  CVE = 'CVE',
  CZK = 'CZK',
  DJF = 'DJF',
  DKK = 'DKK',
  DOP = 'DOP',
  DZD = 'DZD',
  EGP = 'EGP',
  ERN = 'ERN',
  ETB = 'ETB',
  EUR = 'EUR',
  FJD = 'FJD',
  FKP = 'FKP',
  GBP = 'GBP',
  GEL = 'GEL',
  GHS = 'GHS',
  GIP = 'GIP',
  GMD = 'GMD',
  GNF = 'GNF',
  GTQ = 'GTQ',
  GYD = 'GYD',
  HKD = 'HKD',
  HNL = 'HNL',
  HRK = 'HRK',
  HTG = 'HTG',
  HUF = 'HUF',
  IDR = 'IDR',
  ILS = 'ILS',
  INR = 'INR',
  IQD = 'IQD',
  IRR = 'IRR',
  ISK = 'ISK',
  JMD = 'JMD',
  JOD = 'JOD',
  JPY = 'JPY',
  KES = 'KES',
  KGS = 'KGS',
  KHR = 'KHR',
  KMF = 'KMF',
  KPW = 'KPW',
  KRW = 'KRW',
  KWD = 'KWD',
  KYD = 'KYD',
  KZT = 'KZT',
  LAK = 'LAK',
  LBP = 'LBP',
  LKR = 'LKR',
  LRD = 'LRD',
  LSL = 'LSL',
  LYD = 'LYD',
  MAD = 'MAD',
  MDL = 'MDL',
  MGA = 'MGA',
  MKD = 'MKD',
  MMK = 'MMK',
  MNT = 'MNT',
  MOP = 'MOP',
  MRU = 'MRU',
  MUR = 'MUR',
  MVR = 'MVR',
  MWK = 'MWK',
  MXN = 'MXN',
  MYR = 'MYR',
  MZN = 'MZN',
  NAD = 'NAD',
  NGN = 'NGN',
  NIO = 'NIO',
  NOK = 'NOK',
  NPR = 'NPR',
  NZD = 'NZD',
  OMR = 'OMR',
  PAB = 'PAB',
  PEN = 'PEN',
  PGK = 'PGK',
  PHP = 'PHP',
  PKR = 'PKR',
  PLN = 'PLN',
  PYG = 'PYG',
  QAR = 'QAR',
  RON = 'RON',
  RSD = 'RSD',
  RUB = 'RUB',
  RWF = 'RWF',
  SAR = 'SAR',
  SBD = 'SBD',
  SCR = 'SCR',
  SDG = 'SDG',
  SEK = 'SEK',
  SGD = 'SGD',
  SHP = 'SHP',
  SLL = 'SLL',
  SOS = 'SOS',
  SRD = 'SRD',
  SSP = 'SSP',
  STN = 'STN',
  SVC = 'SVC',
  SYP = 'SYP',
  SZL = 'SZL',
  THB = 'THB',
  TJS = 'TJS',
  TMT = 'TMT',
  TND = 'TND',
  TOP = 'TOP',
  TRY = 'TRY',
  TTD = 'TTD',
  TWD = 'TWD',
  TZS = 'TZS',
  UAH = 'UAH',
  UGX = 'UGX',
  USD = 'USD',
  UYU = 'UYU',
  UZS = 'UZS',
  VES = 'VES',
  VND = 'VND',
  VUV = 'VUV',
  WST = 'WST',
  XAF = 'XAF',
  XCD = 'XCD',
  XOF = 'XOF',
  XPF = 'XPF',
  YER = 'YER',
  ZAR = 'ZAR',
  ZMW = 'ZMW',
  ZWL = 'ZWL',
}

interface NumberOptions {
  /**
   * Style of number to display
   */
  style?: Style;

  /**
   * ISO 4217 currency code
   */
  currency?: CurrencyCode;

  /**
   * Languages in the form of a ISO 639-1 language code with optional region or script modifier (e.g. de_AT).
   */
  maximumFractionDigits?: number;

  /**
   * A number from 1 to 21 (default is 21)
   */
  maximumSignificantDigits?: number;

  /**
   * A number from 0 to 20 (default is 3)
   */
  minimumFractionDigits?: number;

  /**
   * A number from 1 to 21 (default is 1)
   */
  minimumIntegerDigits?: number;

  /**
   * A number from 1 to 21 (default is 21)
   */
  minimumSignificantDigits?: number;
}

export enum Style {
  Currency = 'currency',
  Decimal = 'decimal',
  Percent = 'percent',
}

export enum CurrencyDisplay {
  Symbol = 'symbol',
  Code = 'code',
  Name = 'name',
}

export function NumericCell(props: NumericCellProps) {
  const { value, locale = LocaleCode.en_US, options } = props;
  let displayValue = value?.toString() ?? value;
  try {
    displayValue = value?.toLocaleString?.(locale, options);
  } catch (e) {
    logging.error(e);
  }

  return <span>{displayValue}</span>;
}

export default NumericCell;
