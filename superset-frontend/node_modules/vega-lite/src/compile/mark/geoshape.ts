import {GeoShapeTransform as VgGeoShapeTransform} from 'vega';
import {isFieldDef, vgField} from '../../channeldef';
import {GEOJSON} from '../../type';
import {VgPostEncodingTransform} from '../../vega.schema';
import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const geoshape: MarkCompiler = {
  vgMark: 'shape',
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'include',
        size: 'ignore',
        orient: 'ignore'
      })
    };
  },
  postEncodingTransform: (model: UnitModel): VgPostEncodingTransform[] => {
    const {encoding} = model;
    const shapeDef = encoding.shape;

    const transform: VgGeoShapeTransform = {
      type: 'geoshape',
      projection: model.projectionName(),
      // as: 'shape',
      ...(shapeDef && isFieldDef(shapeDef) && shapeDef.type === GEOJSON
        ? {field: vgField(shapeDef, {expr: 'datum'})}
        : {})
    };
    return [transform];
  }
};
