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

/**
 * Translate a legacy `country_map` chart's form_data into the new
 * `country_map_v2` form_data shape.
 *
 * Triggered from controlPanel.formDataOverrides whenever a user switches
 * a saved chart's viz type to country_map_v2. We try to preserve as much
 * intent as possible:
 *
 *   - Legacy `select_country: 'france'` → admin_level=1, country='FRA'
 *   - Legacy `select_country: 'france_overseas'` → composite='france_overseas'
 *   - Legacy `select_country: 'turkey_regions'`  → admin_level='aggregated',
 *                                                   country='TUR', region_set='nuts_1'
 *   - Legacy `select_country: 'italy_regions'`   → ITA/regions
 *   - Legacy `select_country: 'philippines_regions'` → PHL/regions
 *   - Legacy `select_country: 'france_regions'`  → FRA/regions
 *
 * Worldview defaults to 'ukr' (the new plugin's default editorial choice).
 * Standard controls (entity, metric, color scheme, number format) flow
 * through the standard `formDataOverrides` path; this migration only
 * touches the country/admin/composite/region_set quartet.
 */

interface PartialFormData {
  select_country?: string;
  [k: string]: unknown;
}

interface MigrationOutput {
  admin_level?: string;
  country?: string;
  composite?: string;
  region_set?: string;
  worldview?: string;
}

// Composite outputs — legacy keys that should map to the new plugin's
// composite_maps.yaml-driven composite control rather than to a country.
const LEGACY_TO_COMPOSITE: Record<string, string> = {
  france_overseas: 'france_overseas',
};

// Aggregated region outputs — legacy keys that should map to the new
// plugin's regional_aggregations.yaml-driven country+region_set pair.
const LEGACY_TO_AGGREGATED: Record<
  string,
  { country: string; region_set: string }
> = {
  france_regions: { country: 'FRA', region_set: 'regions' },
  italy_regions: { country: 'ITA', region_set: 'regions' },
  philippines_regions: { country: 'PHL', region_set: 'regions' },
  turkey_regions: { country: 'TUR', region_set: 'nuts_1' },
};

// Per-country subdivisions — legacy snake_case keys mapped to ISO 3166-1
// alpha-3 codes used by the new plugin's country control. Coverage is
// intentionally broad — every legacy country file maps to a sibling
// entry in the new build's admin 1 outputs.
const LEGACY_TO_ISO_A3: Record<string, string> = {
  afghanistan: 'AFG',
  aland: 'ALD',
  albania: 'ALB',
  algeria: 'DZA',
  american_samoa: 'ASM',
  andorra: 'AND',
  angola: 'AGO',
  anguilla: 'AIA',
  antarctica: 'ATA',
  antigua_and_barbuda: 'ATG',
  argentina: 'ARG',
  armenia: 'ARM',
  australia: 'AUS',
  austria: 'AUT',
  azerbaijan: 'AZE',
  bahrain: 'BHR',
  bangladesh: 'BGD',
  barbados: 'BRB',
  belarus: 'BLR',
  belgium: 'BEL',
  belize: 'BLZ',
  benin: 'BEN',
  bermuda: 'BMU',
  bhutan: 'BTN',
  bolivia: 'BOL',
  bosnia_and_herzegovina: 'BIH',
  botswana: 'BWA',
  brazil: 'BRA',
  brunei: 'BRN',
  bulgaria: 'BGR',
  burkina_faso: 'BFA',
  burundi: 'BDI',
  cambodia: 'KHM',
  cameroon: 'CMR',
  canada: 'CAN',
  cape_verde: 'CPV',
  central_african_republic: 'CAF',
  chad: 'TCD',
  chile: 'CHL',
  china: 'CHN',
  colombia: 'COL',
  comoros: 'COM',
  cook_islands: 'COK',
  costa_rica: 'CRI',
  croatia: 'HRV',
  cuba: 'CUB',
  cyprus: 'CYP',
  czech_republic: 'CZE',
  democratic_republic_of_the_congo: 'COD',
  denmark: 'DNK',
  djibouti: 'DJI',
  dominica: 'DMA',
  dominican_republic: 'DOM',
  ecuador: 'ECU',
  egypt: 'EGY',
  el_salvador: 'SLV',
  equatorial_guinea: 'GNQ',
  eritrea: 'ERI',
  estonia: 'EST',
  ethiopia: 'ETH',
  fiji: 'FJI',
  finland: 'FIN',
  france: 'FRA',
  french_polynesia: 'PYF',
  gabon: 'GAB',
  gambia: 'GMB',
  germany: 'DEU',
  ghana: 'GHA',
  greece: 'GRC',
  greenland: 'GRL',
  grenada: 'GRD',
  guatemala: 'GTM',
  guinea: 'GIN',
  guyana: 'GUY',
  haiti: 'HTI',
  honduras: 'HND',
  hungary: 'HUN',
  iceland: 'ISL',
  india: 'IND',
  indonesia: 'IDN',
  iran: 'IRN',
  israel: 'ISR',
  italy: 'ITA',
  ivory_coast: 'CIV',
  japan: 'JPN',
  jordan: 'JOR',
  kazakhstan: 'KAZ',
  kenya: 'KEN',
  korea: 'KOR',
  kuwait: 'KWT',
  kyrgyzstan: 'KGZ',
  laos: 'LAO',
  latvia: 'LVA',
  lebanon: 'LBN',
  lesotho: 'LSO',
  liberia: 'LBR',
  libya: 'LBY',
  liechtenstein: 'LIE',
  lithuania: 'LTU',
  luxembourg: 'LUX',
  macedonia: 'MKD',
  madagascar: 'MDG',
  malawi: 'MWI',
  malaysia: 'MYS',
  maldives: 'MDV',
  mali: 'MLI',
  malta: 'MLT',
  marshall_islands: 'MHL',
  mauritania: 'MRT',
  mauritius: 'MUS',
  mexico: 'MEX',
  moldova: 'MDA',
  mongolia: 'MNG',
  montenegro: 'MNE',
  montserrat: 'MSR',
  morocco: 'MAR',
  mozambique: 'MOZ',
  myanmar: 'MMR',
  namibia: 'NAM',
  nauru: 'NRU',
  nepal: 'NPL',
  netherlands: 'NLD',
  new_caledonia: 'NCL',
  new_zealand: 'NZL',
  nicaragua: 'NIC',
  niger: 'NER',
  nigeria: 'NGA',
  northern_mariana_islands: 'MNP',
  norway: 'NOR',
  oman: 'OMN',
  pakistan: 'PAK',
  palau: 'PLW',
  panama: 'PAN',
  papua_new_guinea: 'PNG',
  paraguay: 'PRY',
  peru: 'PER',
  philippines: 'PHL',
  poland: 'POL',
  portugal: 'PRT',
  qatar: 'QAT',
  republic_of_serbia: 'SRB',
  romania: 'ROU',
  russia: 'RUS',
  rwanda: 'RWA',
  saint_lucia: 'LCA',
  saint_pierre_and_miquelon: 'SPM',
  saint_vincent_and_the_grenadines: 'VCT',
  samoa: 'WSM',
  san_marino: 'SMR',
  sao_tome_and_principe: 'STP',
  saudi_arabia: 'SAU',
  senegal: 'SEN',
  seychelles: 'SYC',
  sierra_leone: 'SLE',
  singapore: 'SGP',
  slovakia: 'SVK',
  slovenia: 'SVN',
  solomon_islands: 'SLB',
  somalia: 'SOM',
  south_africa: 'ZAF',
  spain: 'ESP',
  sri_lanka: 'LKA',
  sudan: 'SDN',
  suriname: 'SUR',
  sweden: 'SWE',
  switzerland: 'CHE',
  syria: 'SYR',
  taiwan: 'TWN',
  tajikistan: 'TJK',
  tanzania: 'TZA',
  thailand: 'THA',
  the_bahamas: 'BHS',
  timorleste: 'TLS',
  togo: 'TGO',
  tonga: 'TON',
  trinidad_and_tobago: 'TTO',
  tunisia: 'TUN',
  turkey: 'TUR',
  turkmenistan: 'TKM',
  turks_and_caicos_islands: 'TCA',
  uganda: 'UGA',
  uk: 'GBR',
  ukraine: 'UKR',
  united_arab_emirates: 'ARE',
  united_states_minor_outlying_islands: 'UMI',
  united_states_virgin_islands: 'VIR',
  uruguay: 'URY',
  usa: 'USA',
  uzbekistan: 'UZB',
  vanuatu: 'VUT',
  venezuela: 'VEN',
  vietnam: 'VNM',
  wallis_and_futuna: 'WLF',
  yemen: 'YEM',
  zambia: 'ZMB',
  zimbabwe: 'ZWE',
};

export default function migrateFromLegacy(
  formData: PartialFormData,
): MigrationOutput {
  const legacy = String(formData.select_country ?? '').toLowerCase();
  if (!legacy) return {};

  if (LEGACY_TO_COMPOSITE[legacy]) {
    return {
      admin_level: '1',
      composite: LEGACY_TO_COMPOSITE[legacy],
      worldview: 'ukr',
    };
  }
  if (LEGACY_TO_AGGREGATED[legacy]) {
    const { country, region_set } = LEGACY_TO_AGGREGATED[legacy];
    return {
      admin_level: 'aggregated',
      country,
      region_set,
      worldview: 'ukr',
    };
  }
  if (LEGACY_TO_ISO_A3[legacy]) {
    return {
      admin_level: '1',
      country: LEGACY_TO_ISO_A3[legacy],
      worldview: 'ukr',
    };
  }
  // Unknown legacy code — leave the country control empty so the user
  // can re-pick. Worldview defaults flow from the control's own default.
  return {};
}
