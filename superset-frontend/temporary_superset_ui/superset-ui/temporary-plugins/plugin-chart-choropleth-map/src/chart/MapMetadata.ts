import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import { get } from 'lodash/fp';
import { RawMapMetadata } from '../types';
import Projection from './Projection';

export default class MapMetadata {
  config: RawMapMetadata;

  keyAccessor: (...args: unknown[]) => string;

  constructor(metadata: RawMapMetadata) {
    const { keyField } = metadata;

    this.config = metadata;
    this.keyAccessor = get(keyField);
  }

  loadMap(): Promise<FeatureCollection> {
    const { key } = this.config;

    return this.config.type === 'topojson'
      ? this.config.load().then(map => feature(map, map.objects[key]) as FeatureCollection)
      : this.config.load();
  }

  createProjection() {
    const { projection = 'Mercator', rotate } = this.config;
    const projectionFn = Projection[projection]();
    if (rotate) {
      projectionFn.rotate(rotate);
    }

    return projectionFn;
  }
}
