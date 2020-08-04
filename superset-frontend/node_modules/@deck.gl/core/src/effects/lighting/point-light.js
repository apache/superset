import {PointLight as BasePointLight} from '@luma.gl/core';
import {projectPosition} from '../../shaderlib/project/project-functions';
import {COORDINATE_SYSTEM} from '../../lib';

export default class PointLight extends BasePointLight {
  constructor(props) {
    super(props);
    this.projectedLight = new BasePointLight(props);
  }

  getProjectedLight({layer}) {
    const viewport = layer.context.viewport;
    const {coordinateSystem, coordinateOrigin} = layer.props;
    const position = projectPosition(this.position, {
      viewport,
      coordinateSystem,
      coordinateOrigin,
      fromCoordinateSystem: viewport.isGeospatial
        ? COORDINATE_SYSTEM.LNGLAT
        : COORDINATE_SYSTEM.IDENTITY,
      fromCoordinateOrigin: [0, 0, 0]
    });
    this.projectedLight.color = this.color;
    this.projectedLight.intensity = this.intensity;
    this.projectedLight.position = position;
    return this.projectedLight;
  }
}
