import {GeoJSONTransform as VgGeoJSONTransform, Vector2} from 'vega';
import {isString} from 'vega-util';
import {GeoPositionChannel, LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2, SHAPE} from '../../channel';
import {isValueDef, ValueDef} from '../../channeldef';
import {GEOJSON} from '../../type';
import {duplicate, hash} from '../../util';
import {VgExprRef} from '../../vega.schema';
import {UnitModel} from '../unit';
import {DataFlowNode} from './dataflow';

export class GeoJSONNode extends DataFlowNode {
  public clone() {
    return new GeoJSONNode(null, duplicate(this.fields), this.geojson, this.signal);
  }

  public static parseAll(parent: DataFlowNode, model: UnitModel): DataFlowNode {
    if (model.component.projection && !model.component.projection.isFit) {
      return parent;
    }

    let geoJsonCounter = 0;

    for (const coordinates of [
      [LONGITUDE, LATITUDE],
      [LONGITUDE2, LATITUDE2]
    ] as Vector2<GeoPositionChannel>[]) {
      const pair = coordinates.map(channel =>
        model.channelHasField(channel)
          ? model.fieldDef(channel).field
          : isValueDef(model.encoding[channel])
          ? {expr: (model.encoding[channel] as ValueDef<number>).value + ''}
          : undefined
      ) as [GeoPositionChannel, GeoPositionChannel];

      if (pair[0] || pair[1]) {
        parent = new GeoJSONNode(parent, pair, null, model.getName(`geojson_${geoJsonCounter++}`));
      }
    }

    if (model.channelHasField(SHAPE)) {
      const fieldDef = model.fieldDef(SHAPE);
      if (fieldDef.type === GEOJSON) {
        parent = new GeoJSONNode(parent, null, fieldDef.field, model.getName(`geojson_${geoJsonCounter++}`));
      }
    }

    return parent;
  }

  constructor(
    parent: DataFlowNode,
    private fields?: Vector2<string | VgExprRef>,
    private geojson?: string,
    private signal?: string
  ) {
    super(parent);
  }

  public dependentFields() {
    const fields = (this.fields ?? []).filter(isString) as string[];
    return new Set([...(this.geojson ? [this.geojson] : []), ...fields]);
  }

  public producedFields() {
    return new Set<string>();
  }

  public hash() {
    return `GeoJSON ${this.geojson} ${this.signal} ${hash(this.fields)}`;
  }

  public assemble(): VgGeoJSONTransform {
    return {
      type: 'geojson',
      ...(this.fields ? {fields: this.fields} : {}),
      ...(this.geojson ? {geojson: this.geojson} : {}),
      signal: this.signal
    };
  }
}
