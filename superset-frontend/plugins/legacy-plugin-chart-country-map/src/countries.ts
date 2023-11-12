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
import argentina from './countries/argentina.geojson';
import australia from './countries/australia.geojson';
import belgium from './countries/belgium.geojson';
import bolivia from './countries/bolivia.geojson';
import brazil from './countries/brazil.geojson';
import bulgaria from './countries/bulgaria.geojson';
import burundi from './countries/burundi.geojson';
import canada from './countries/canada.geojson';
import chile from './countries/chile.geojson';
import china from './countries/china.geojson';
import colombia from './countries/colombia.geojson';
import costa_rica from './countries/costa rica.geojson';
import cuba from './countries/cuba.geojson';
import cyprus from './countries/cyprus.geojson';
import denmark from './countries/denmark.geojson';
import dominican_republic from './countries/dominican republic.geojson';
import ecuador from './countries/ecuador.geojson';
import egypt from './countries/egypt.geojson';
import el_salvador from './countries/el salvador.geojson';
import estonia from './countries/estonia.geojson';
import ethiopia from './countries/ethiopia.geojson';
import france from './countries/france.geojson';
import france_regions from './countries/france_regions.geojson';
import finland from './countries/finland.geojson';
import germany from './countries/germany.geojson';
import guatemala from './countries/guatemala.geojson';
import haiti from './countries/haiti.geojson';
import honduras from './countries/honduras.geojson';
import iceland from './countries/iceland.geojson';
import india from './countries/india.geojson';
import indonesia from './countries/indonesia.geojson';
import iran from './countries/iran.geojson';
import italy from './countries/italy.geojson';
import italy_regions from './countries/italy_regions.geojson';
import japan from './countries/japan.geojson';
import jordan from './countries/jordan.geojson';
import kazakhstan from './countries/kazakhstan.geojson';
import kenya from './countries/kenya.geojson';
import korea from './countries/korea.geojson';
import kuwait from './countries/kuwait.geojson';
import kyrgyzstan from './countries/kyrgyzstan.geojson';
import latvia from './countries/latvia.geojson';
import liechtenstein from './countries/liechtenstein.geojson';
import lithuania from './countries/lithuania.geojson';
import nigeria from './countries/nigeria.geojson';
import norway from './countries/norway.geojson';
import malaysia from './countries/malaysia.geojson';
import mexico from './countries/mexico.geojson';
import morocco from './countries/morocco.geojson';
import myanmar from './countries/myanmar.geojson';
import netherlands from './countries/netherlands.geojson';
import nicaragua from './countries/nicaragua.geojson';
import oman from './countries/oman.geojson';
import pakistan from './countries/pakistan.geojson';
import panama from './countries/panama.geojson';
import papua_new_guinea from './countries/papua new guinea.geojson';
import paraguay from './countries/paraguay.geojson';
import philippines from './countries/philippines.geojson';
import peru from './countries/peru.geojson';
import poland from './countries/poland.geojson';
import portugal from './countries/portugal.geojson';
import puerto_rico from './countries/puerto rico.geojson';
import qatar from './countries/qatar.geojson';
import russia from './countries/russia.geojson';
import rwanda from './countries/rwanda.geojson';
import saint_barthelemy from './countries/saint barthelemy.geojson';
import saint_martin from './countries/saint martin.geojson';
import saudi_arabia from './countries/saudi_arabia.geojson';
import singapore from './countries/singapore.geojson';
import slovenia from './countries/slovenia.geojson';
import sweden from './countries/sweden.geojson';
import spain from './countries/spain.geojson';
import srilanka from './countries/srilanka.geojson';
import switzerland from './countries/switzerland.geojson';
import syria from './countries/syria.geojson';
import tajikistan from './countries/tajikistan.geojson';
import tanzania from './countries/tanzania.geojson';
import thailand from './countries/thailand.geojson';
import timorleste from './countries/timorleste.geojson';
import turkey from './countries/turkey.geojson';
import turkmenistan from './countries/turkmenistan.geojson';
import united_arab_emirates from './countries/united_arab_emirates.geojson';
import uganda from './countries/uganda.geojson';
import uk from './countries/uk.geojson';
import ukraine from './countries/ukraine.geojson';
import uruguay from './countries/uruguay.geojson';
import usa from './countries/usa.geojson';
import uzbekistan from './countries/uzbekistan.geojson';
import zambia from './countries/zambia.geojson';
import venezuela from './countries/venezuela.geojson';
import vietnam from './countries/vietnam.geojson';

export const countries = {
  austria,
  argentina,
  australia,
  belgium,
  bolivia,
  brazil,
  bulgaria,
  burundi,
  canada,
  chile,
  china,
  colombia,
  costa_rica,
  cuba,
  cyprus,
  denmark,
  dominican_republic,
  ecuador,
  egypt,
  el_salvador,
  estonia,
  ethiopia,
  france,
  france_regions,
  finland,
  germany,
  guatemala,
  haiti,
  honduras,
  iceland,
  india,
  indonesia,
  iran,
  italy,
  italy_regions,
  japan,
  jordan,
  kazakhstan,
  kenya,
  korea,
  kuwait,
  kyrgyzstan,
  latvia,
  liechtenstein,
  lithuania,
  malaysia,
  mexico,
  morocco,
  myanmar,
  netherlands,
  nicaragua,
  nigeria,
  norway,
  oman,
  pakistan,
  panama,
  papua_new_guinea,
  paraguay,
  philippines,
  peru,
  poland,
  portugal,
  puerto_rico,
  qatar,
  russia,
  rwanda,
  saint_barthelemy,
  saint_martin,
  saudi_arabia,
  singapore,
  slovenia,
  spain,
  srilanka,
  sweden,
  switzerland,
  syria,
  tajikistan,
  tanzania,
  thailand,
  timorleste,
  turkey,
  turkmenistan,
  united_arab_emirates,
  uganda,
  uk,
  ukraine,
  uruguay,
  usa,
  uzbekistan,
  zambia,
  venezuela,
  vietnam,
};

export const countryOptions = Object.keys(countries).map(x => {
  if (x === 'uk' || x === 'usa') {
    return [x, x.toUpperCase()];
  }
  if (x === 'italy_regions') {
    return [x, 'Italy (regions)'];
  }
  if (x === 'france_regions') {
    return [x, 'France (regions)'];
  }
  return [x, x[0].toUpperCase() + x.slice(1)];
});

export default countries;
