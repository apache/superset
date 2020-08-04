export default class Pass {
  constructor(gl, props = {}) {
    const {id = 'pass'} = props;
    this.id = id; // id of this pass
    this.gl = gl;
    this.props = {};
    Object.assign(this.props, props);
  }

  setProps(props) {
    Object.assign(this.props, props);
  }

  render() {}

  cleanup() {}
}
