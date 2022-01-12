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

import austria from './countries/austria.geojson';
import australia from './countries/australia.geojson';
import belgium from './countries/belgium.geojson';
import brazil from './countries/brazil.geojson';
import bulgaria from './countries/bulgaria.geojson';
import canada from './countries/canada.geojson';
import china from './countries/china.geojson';
import denmark from './countries/denmark.geojson';
import egypt from './countries/egypt.geojson';
import estonia from './countries/estonia.geojson';
import france from './countries/france.geojson';
import finland from './countries/finland.geojson';
import germany from './countries/germany.geojson';
import iceland from './countries/iceland.geojson';
import india from './countries/india.geojson';
import indonesia from './countries/indonesia.geojson';
import iran from './countries/iran.geojson';
import italy from './countries/italy.geojson';
import italy_regions from './countries/italy_regions.geojson';
import japan from './countries/japan.geojson';
import korea from './countries/korea.geojson';
import liechtenstein from './countries/liechtenstein.geojson';
import norway from './countries/norway.geojson';
import malaysia from './countries/malaysia.geojson';
import morocco from './countries/morocco.geojson';
import myanmar from './countries/myanmar.geojson';
import netherlands from './countries/netherlands.geojson';
import peru from './countries/peru.geojson';
import poland from './countries/poland.geojson';
import portugal from './countries/portugal.geojson';
import russia from './countries/russia.geojson';
import saudi_arabia from './countries/saudi_arabia.geojson';
import singapore from './countries/singapore.geojson';
import slovenia from './countries/slovenia.geojson';
import sweden from './countries/sweden.geojson';
import spain from './countries/spain.geojson';
import switzerland from './countries/switzerland.geojson';
import syria from './countries/syria.geojson';
import thailand from './countries/thailand.geojson';
import timorleste from './countries/timorleste.geojson';
import uk from './countries/uk.geojson';
import ukraine from './countries/ukraine.geojson';
import uruguay from './countries/uruguay.geojson';
import usa from './countries/usa.geojson';
import zambia from './countries/zambia.geojson';
import vietnam from './countries/vietnam.geojson';

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
