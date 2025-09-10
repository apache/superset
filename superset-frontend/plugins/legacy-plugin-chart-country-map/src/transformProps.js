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
export default function transformProps(chartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    linearColorScheme,
    numberFormat,
    selectCountry,
    colorScheme,
    sliceId,
  } = formData;

  // Minimal URL override: allow ?country_code=IN|US|UK|GB to override selected country
  let countryFromForm = selectCountry
    ? String(selectCountry).toLowerCase()
    : null;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlCountryCode = params.get('country_code');
    if (urlCountryCode) {
      const cc = String(urlCountryCode).toUpperCase();
      const alpha2ToPluginKey = {
        US: 'usa',
        IN: 'india',
        ID: 'indonesia',
        AE: 'united_arab_emirates',
        UK: 'uk',
        SA: 'saudi_arabia',
        ZA: 'south_africa',
        MY: 'malaysia',
        PH: 'philippines',
        PHP: 'philippines',
      };
      if (alpha2ToPluginKey[cc]) {
        countryFromForm = alpha2ToPluginKey[cc];
      }
    }
  } catch (e) {
    // no-op if URL parsing fails or window is unavailable
  }

  // countryFromForm contains final selection, optionally overridden via URL

  return {
    width,
    height,
    data: queriesData[0].data,
    country: countryFromForm,
    linearColorScheme,
    numberFormat,
    colorScheme,
    sliceId,
  };
}
