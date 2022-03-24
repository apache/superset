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
import burundi from './countries/burundi.geojson';
import canada from './countries/canada.geojson';
import china from './countries/china.geojson';
import cyprus from './countries/cyprus.geojson';
import denmark from './countries/denmark.geojson';
import egypt from './countries/egypt.geojson';
import estonia from './countries/estonia.geojson';
import ethiopia from './countries/ethiopia.geojson';
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
import jordan from './countries/jordan.geojson';
import kenya from './countries/kenya.geojson';
import korea from './countries/korea.geojson';
import kuwait from './countries/kuwait.geojson';
import liechtenstein from './countries/liechtenstein.geojson';
import lithuania from './countries/lithuania.geojson';
import nigeria from './countries/nigeria.geojson';
import norway from './countries/norway.geojson';
import malaysia from './countries/malaysia.geojson';
import mexico from './countries/mexico.geojson';
import morocco from './countries/morocco.geojson';
import myanmar from './countries/myanmar.geojson';
import netherlands from './countries/netherlands.geojson';
import oman from './countries/oman.geojson';
import pakistan from './countries/pakistan.geojson';
import philippines from './countries/philippines.geojson';
import peru from './countries/peru.geojson';
import poland from './countries/poland.geojson';
import portugal from './countries/portugal.geojson';
import qatar from './countries/qatar.geojson';
import russia from './countries/russia.geojson';
import rwanda from './countries/rwanda.geojson';
import saudi_arabia from './countries/saudi_arabia.geojson';
import singapore from './countries/singapore.geojson';
import slovenia from './countries/slovenia.geojson';
import sweden from './countries/sweden.geojson';
import spain from './countries/spain.geojson';
import switzerland from './countries/switzerland.geojson';
import syria from './countries/syria.geojson';
import tanzania from './countries/tanzania.geojson';
import thailand from './countries/thailand.geojson';
import timorleste from './countries/timorleste.geojson';
import united_arab_emirates from './countries/united_arab_emirates.geojson';
import uganda from './countries/uganda.geojson';
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
  burundi,
  canada,
  china,
  cyprus,
  denmark,
  egypt,
  estonia,
  ethiopia,
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
  jordan,
  kenya,
  korea,
  kuwait,
  liechtenstein,
  lithuania,
  malaysia,
  mexico,
  morocco,
  myanmar,
  netherlands,
  nigeria,
  norway,
  oman,
  pakistan,
  philippines,
  peru,
  poland,
  portugal,
  qatar,
  russia,
  rwanda,
  saudi_arabia,
  singapore,
  slovenia,
  spain,
  sweden,
  switzerland,
  syria,
  tanzania,
  thailand,
  timorleste,
  united_arab_emirates,
  uganda,
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
