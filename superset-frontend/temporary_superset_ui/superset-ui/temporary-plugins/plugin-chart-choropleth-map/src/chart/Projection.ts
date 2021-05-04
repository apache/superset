import { geoMercator, geoEquirectangular, geoAlbers, geoAlbersUsa } from 'd3-geo';

const Projection = {
  Mercator: geoMercator,
  Equirectangular: geoEquirectangular,
  Albers: geoAlbers,
  AlbersUsa: geoAlbersUsa,
};

type Projection = keyof typeof Projection;

export default Projection;
