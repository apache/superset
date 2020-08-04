import {GeoPointTransform as VgGeoPointTransform, Vector2} from 'vega';
import {isString} from 'vega-util';
import {GeoPositionChannel, LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2} from '../../channel';
import {isValueDef, ValueDef} from '../../channeldef';
import {duplicate, hash} from '../../util';
import {VgExprRef} from '../../vega.schema';
import {UnitModel} from '../unit';
import {DataFlowNode} from './dataflow';

export class GeoPointNode extends DataFlowNode {
  public clone() {
    return new GeoPointNode(null, this.projection, duplicate(this.fields), duplicate(this.as));
  }

  constructor(
    parent: DataFlowNode,
    private projection: string,
    private fields: [string | VgExprRef, string | VgExprRef],
    private as: [string, string]
  ) {
    super(parent);
  }

  public static parseAll(parent: DataFlowNode, model: UnitModel): DataFlowNode {
    if (!model.projectionName()) {
      return parent;
    }

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

      const suffix = coordinates[0] === LONGITUDE2 ? '2' : '';

      if (pair[0] || pair[1]) {
        parent = new GeoPointNode(parent, model.projectionName(), pair, [
          model.getName('x' + suffix),
          model.getName('y' + suffix)
        ]);
      }
    }

    return parent;
  }

  public dependentFields() {
    return new Set(this.fields.filter(isString));
  }

  public producedFields() {
    return new Set(this.as);
  }

  public hash() {
    return `Geopoint ${this.projection} ${hash(this.fields)} ${hash(this.as)}`;
  }

  public assemble(): VgGeoPointTransform {
    return {
      type: 'geopoint',
      projection: this.projection,
      fields: this.fields,
      as: this.as
    };
  }
}
