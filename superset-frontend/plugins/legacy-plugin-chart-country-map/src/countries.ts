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

import australia from './countries/australia.geojson';
import austria from './countries/austria.geojson';
import belgium from './countries/belgium.geojson';
import brazil from './countries/brazil.geojson';
import bulgaria from './countries/bulgaria.geojson';
import burundi from './countries/burundi.geojson';
import burundi_communes from './countries/burundi_communes.geojson';
import canada from './countries/canada.geojson';
import china from './countries/china.geojson';
import cyprus from './countries/cyprus.geojson';
import denmark from './countries/denmark.geojson';
import egypt from './countries/egypt.geojson';
import estonia from './countries/estonia.geojson';
import ethiopia from './countries/ethiopia.geojson';
import ethiopia_regions from './countries/ethiopia_regions.geojson';
import ethiopia_woredas from './countries/ethiopia_woredas.geojson';
import ethiopia_zones from './countries/ethiopia_zones.geojson';
import finland from './countries/finland.geojson';
import france from './countries/france.geojson';
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
import kenya_counties from './countries/kenya_counties.geojson';
import korea from './countries/korea.geojson';
import kuwait from './countries/kuwait.geojson';
import liechtenstein from './countries/liechtenstein.geojson';
import lithuania from './countries/lithuania.geojson';
import malaysia from './countries/malaysia.geojson';
import mexico from './countries/mexico.geojson';
import morocco from './countries/morocco.geojson';
import myanmar from './countries/myanmar.geojson';
import netherlands from './countries/netherlands.geojson';
import nigeria from './countries/nigeria.geojson';
import nigeria_areas from './countries/nigeria_areas.geojson';
import norway from './countries/norway.geojson';
import oman from './countries/oman.geojson';
import pakistan from './countries/pakistan.geojson';
import peru from './countries/peru.geojson';
import philippines from './countries/philippines.geojson';
import poland from './countries/poland.geojson';
import portugal from './countries/portugal.geojson';
import qatar from './countries/qatar.geojson';
import russia from './countries/russia.geojson';
import rwanda from './countries/rwanda.geojson';
import rwanda_districts from './countries/rwanda_districts.geojson';
import rwanda_provinces from './countries/rwanda_provinces.geojson';
import saudi_arabia from './countries/saudi_arabia.geojson';
import singapore from './countries/singapore.geojson';
import slovenia from './countries/slovenia.geojson';
import spain from './countries/spain.geojson';
import sweden from './countries/sweden.geojson';
import switzerland from './countries/switzerland.geojson';
import syria from './countries/syria.geojson';
import tanzania from './countries/tanzania.geojson';
import tanzania_districts from './countries/tanzania_districts.geojson';
import thailand from './countries/thailand.geojson';
import timorleste from './countries/timorleste.geojson';
import uganda from './countries/uganda.geojson';
import uganda_districts from './countries/uganda_districts.geojson';
import uk from './countries/uk.geojson';
import ukraine from './countries/ukraine.geojson';
import united_arab_emirates from './countries/united_arab_emirates.geojson';
import uruguay from './countries/uruguay.geojson';
import usa from './countries/usa.geojson';
import vietnam from './countries/vietnam.geojson';
import zambia from './countries/zambia.geojson';
import zambia_districts from './countries/zambia_districts.geojson';

export const countries = {
  australia,
  austria,
  belgium,
  brazil,
  bulgaria,
  burundi,
  burundi_communes,
  canada,
  china,
  cyprus,
  denmark,
  egypt,
  estonia,
  ethiopia,
  ethiopia_regions,
  ethiopia_woredas,
  ethiopia_zones,
  finland,
  france,
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
  kenya_counties,
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
  nigeria_areas,
  norway,
  oman,
  pakistan,
  peru,
  philippines,
  poland,
  portugal,
  qatar,
  russia,
  rwanda,
  rwanda_districts,
  rwanda_provinces,
  saudi_arabia,
  singapore,
  slovenia,
  spain,
  sweden,
  switzerland,
  syria,
  tanzania,
  tanzania_districts,
  thailand,
  timorleste,
  uganda,
  uganda_districts,
  uk,
  ukraine,
  united_arab_emirates,
  uruguay,
  usa,
  vietnam,
  zambia,
  zambia_districts,
};

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const countryOptions = Object.keys(countries).map(x => {
  if (x === 'uk' || x === 'usa') {
    return [x, x.toUpperCase()];
  }
  if (x === 'italy_regions') {
    return [x, 'Italy (regions)'];
  }
  return [x, x.split('_').map(capitalize).join(' ')];
});

export default countries;
