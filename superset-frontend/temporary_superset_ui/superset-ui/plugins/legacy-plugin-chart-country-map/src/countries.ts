/* eslint-disable import/no-webpack-loader-syntax, import/no-unresolved */
import belgium from 'file-loader!./countries/belgium.geojson';
import brazil from 'file-loader!./countries/brazil.geojson';
import bulgaria from 'file-loader!./countries/bulgaria.geojson';
import canada from 'file-loader!./countries/canada.geojson';
import china from 'file-loader!./countries/china.geojson';
import egypt from 'file-loader!./countries/egypt.geojson';
import france from 'file-loader!./countries/france.geojson';
import germany from 'file-loader!./countries/germany.geojson';
import india from 'file-loader!./countries/india.geojson';
import indonesia from 'file-loader!./countries/indonesia.geojson';
import iran from 'file-loader!./countries/iran.geojson';
import italy from 'file-loader!./countries/italy.geojson';
import japan from 'file-loader!./countries/japan.geojson';
import korea from 'file-loader!./countries/korea.geojson';
import liechtenstein from 'file-loader!./countries/liechtenstein.geojson';
import malaysia from 'file-loader!./countries/malaysia.geojson';
import morocco from 'file-loader!./countries/morocco.geojson';
import myanmar from 'file-loader!./countries/myanmar.geojson';
import netherlands from 'file-loader!./countries/netherlands.geojson';
import portugal from 'file-loader!./countries/portugal.geojson';
import russia from 'file-loader!./countries/russia.geojson';
import singapore from 'file-loader!./countries/singapore.geojson';
import slovenia from 'file-loader!./countries/slovenia.geojson';
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

export const countries = {
  belgium,
  brazil,
  bulgaria,
  canada,
  china,
  egypt,
  france,
  germany,
  india,
  indonesia,
  iran,
  italy,
  japan,
  korea,
  liechtenstein,
  malaysia,
  morocco,
  myanmar,
  netherlands,
  portugal,
  russia,
  singapore,
  slovenia,
  spain,
  switzerland,
  syria,
  thailand,
  timorleste,
  uk,
  ukraine,
  uruguay,
  usa,
  zambia,
};

export const countryOptions = Object.keys(countries).map(x => {
  if (x === 'uk' || x === 'usa') {
    return [x, x.toUpperCase()];
  }
  return [x, x[0].toUpperCase() + x.slice(1)];
});

export default countries;
