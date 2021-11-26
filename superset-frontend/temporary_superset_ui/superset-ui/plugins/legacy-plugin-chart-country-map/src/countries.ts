/*
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

/* eslint-disable import/no-webpack-loader-syntax, import/no-unresolved */
import austria from 'file-loader!./countries/austria.geojson';
import australia from 'file-loader!./countries/australia.geojson';
import belgium from 'file-loader!./countries/belgium.geojson';
import brazil from 'file-loader!./countries/brazil.geojson';
import bulgaria from 'file-loader!./countries/bulgaria.geojson';
import canada from 'file-loader!./countries/canada.geojson';
import china from 'file-loader!./countries/china.geojson';
import denmark from 'file-loader!./countries/denmark.geojson';
import egypt from 'file-loader!./countries/egypt.geojson';
import estonia from 'file-loader!./countries/estonia.geojson';
import france from 'file-loader!./countries/france.geojson';
import finland from 'file-loader!./countries/finland.geojson';
import germany from 'file-loader!./countries/germany.geojson';
import iceland from 'file-loader!./countries/iceland.geojson';
import india from 'file-loader!./countries/india.geojson';
import indonesia from 'file-loader!./countries/indonesia.geojson';
import iran from 'file-loader!./countries/iran.geojson';
import italy from 'file-loader!./countries/italy.geojson';
import italy_regions from 'file-loader!./countries/italy_regions.geojson';
import japan from 'file-loader!./countries/japan.geojson';
import korea from 'file-loader!./countries/korea.geojson';
import liechtenstein from 'file-loader!./countries/liechtenstein.geojson';
import norway from 'file-loader!./countries/norway.geojson';
import malaysia from 'file-loader!./countries/malaysia.geojson';
import morocco from 'file-loader!./countries/morocco.geojson';
import myanmar from 'file-loader!./countries/myanmar.geojson';
import netherlands from 'file-loader!./countries/netherlands.geojson';
import peru from 'file-loader!./countries/peru.geojson';
import poland from 'file-loader!./countries/poland.geojson';
import portugal from 'file-loader!./countries/portugal.geojson';
import russia from 'file-loader!./countries/russia.geojson';
import saudi_arabia from 'file-loader!./countries/saudi_arabia.geojson';
import singapore from 'file-loader!./countries/singapore.geojson';
import slovenia from 'file-loader!./countries/slovenia.geojson';
import sweden from 'file-loader!./countries/sweden.geojson';
import spain from 'file-loader!./countries/spain.geojson';
import switzerland from 'file-loader!./countries/switzerland.geojson';
import syria from 'file-loader!./countries/syria.geojson';
import thailand from 'file-loader!./countries/thailand.geojson';
import timorleste from 'file-loader!./countries/timorleste.geojson';
import uk from 'file-loader!./countries/uk.geojson';
import ukraine from 'file-loader!./countries/ukraine.geojson';
import uruguay from 'file-loader!./countries/uruguay.geojson';
import usa from 'file-loader!./countries/usa.geojson';
import zambia from 'file-loader!./countries/zambia.geojson';
import vietnam from 'file-loader!./countries/vietnam.geojson';

export const countries = {
  austria,
  australia,
  belgium,
  brazil,
  bulgaria,
  canada,
  china,
  denmark,
  egypt,
  estonia,
  france,
  finland,
  germany,
  iceland,
  india,
  indonesia,
  iran,
  italy,
  italy_regions,
  japan,
  korea,
  liechtenstein,
  malaysia,
  morocco,
  myanmar,
  netherlands,
  norway,
  peru,
  poland,
  portugal,
  russia,
  saudi_arabia,
  singapore,
  slovenia,
  spain,
  sweden,
  switzerland,
  syria,
  thailand,
  timorleste,
  uk,
  ukraine,
  uruguay,
  usa,
  zambia,
  vietnam,
};

export const countryOptions = Object.keys(countries).map(x => {
  if (x === 'uk' || x === 'usa') {
    return [x, x.toUpperCase()];
  }
  if (x === 'italy_regions') {
    return [x, 'Italy (regions)'];
  }
  return [x, x[0].toUpperCase() + x.slice(1)];
});

export default countries;
