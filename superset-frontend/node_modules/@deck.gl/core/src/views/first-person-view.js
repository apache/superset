import View from './view';
import Viewport from '../viewports/viewport';
import {Matrix4, _SphericalCoordinates as SphericalCoordinates} from 'math.gl';
import FirstPersonController from '../controllers/first-person-controller';

function getDirectionFromBearingAndPitch({bearing, pitch}) {
  const spherical = new SphericalCoordinates({bearing, pitch});
  const direction = spherical.toVector3().normalize();
  return direction;
}

export default class FirstPersonView extends View {
  get controller() {
    return this._getControllerProps({
      type: FirstPersonController
    });
  }

  _getViewport(props) {
    // TODO - push direction handling into Matrix4.lookAt
    const {
      // view matrix arguments
      modelMatrix = null,
      bearing,
      up = [0, 0, 1] // Defines up direction, default positive z axis,
    } = props.viewState;

    // Always calculate direction from bearing and pitch
    const dir = getDirectionFromBearingAndPitch({
      bearing,
      pitch: 89
    });

    // Direction is relative to model coordinates, of course
    const center = modelMatrix ? modelMatrix.transformDirection(dir) : dir;

    // Just the direction. All the positioning is done in viewport.js
    const viewMatrix = new Matrix4().lookAt({eye: [0, 0, 0], center, up});

    return new Viewport(
      Object.assign({}, props, {
        zoom: null, // triggers meter level zoom
        viewMatrix
      })
    );
  }
}

FirstPersonView.displayName = 'FirstPersonView';
