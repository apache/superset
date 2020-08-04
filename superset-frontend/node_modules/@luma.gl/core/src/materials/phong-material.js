import Material from './material';

const defaultProps = {
  ambient: 0.35,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [30, 30, 30]
};

export default class PhongMaterial extends Material {
  constructor(props) {
    super(props);
    props = Object.assign({}, defaultProps, props);
    Object.assign(this, props);
  }
}
