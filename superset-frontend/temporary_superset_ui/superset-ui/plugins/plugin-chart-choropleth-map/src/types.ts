// eslint-disable-next-line import/no-unresolved
import type { Topology } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import type Projection from './chart/Projection';

interface BaseMapMetadata {
  key: string;
  name: string;
  keyField: string;
  projection?: Projection;
  rotate?: [number, number] | [number, number, number];
}

interface TopojsonMapMetadata extends BaseMapMetadata {
  type: 'topojson';
  load: () => Promise<Topology>;
}

interface GeojsonMapMetadata extends BaseMapMetadata {
  type: 'geojson';
  load: () => Promise<FeatureCollection>;
}

export type RawMapMetadata = TopojsonMapMetadata | GeojsonMapMetadata;
