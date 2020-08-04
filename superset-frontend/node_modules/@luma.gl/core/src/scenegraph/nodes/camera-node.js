import ScenegraphNode from './scenegraph-node';

export default class CameraNode extends ScenegraphNode {
  constructor(props = {}) {
    super(props);
    this.projectionMatrix = props.projectionMatrix;
  }
}
