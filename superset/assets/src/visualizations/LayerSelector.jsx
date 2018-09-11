import React from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse, Well } from 'react-bootstrap';
import  './LayerSelector.css';

const propTypes = {
  layers: PropTypes.object,
  toggleCategory: PropTypes.func,
  showSingleCategory: PropTypes.func,
  position: PropTypes.oneOf(['tl', 'tr', 'bl', 'br']),
};

const defaultProps = {
  layers: {},
  toggleCategory: () => {},
  showSingleCategory: () => {},
  position: 'tr',
};

export default class LayerSelector extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = { open: false };
    for (const key in this.props.layers) {
      this.state[key] = this.props.layers[key].enabled;
    }
    this.handleInputChange = this.handleInputChange.bind(this);
  }
  
  handleInputChange(event) {
    const target = event.target;
    this.setState({
      [target.name]: target.checked,
    });
    this.props.toggleLayer(target.name, target.checked);
    
  }
  render() {
    if (Object.keys(this.props.layers).length === 0) {
      return null;
    }

    const layers = Object.entries(this.props.layers).map(([k, v]) => {
      const style = { color: 'rgba(' + v.color.join(', ') + ')' };
      const icon = v.type === 'fill' ? '\u25FC' : '\u2014';
      return (
        <li key={k}>
          <input
            type="checkbox"
            name={k}
            checked={this.state[k]}
            onChange={this.handleInputChange}
          />
          {v.legend + '\u2002'}
          <span style={style}>{icon}</span>
        </li>
      );
    });
    return (
      <div
        className={'layerSelector'}
      >
        <Button className={'cbutton'} onClick={() => this.setState({ open: !this.state.open })}>
          Layers
        </Button>
        <Collapse in={this.state.open} dimension={'width'}>
          <div>
            <Well className={'well'}>
              <h6> Layers </h6>
              <ul>{layers}</ul>
            </Well>
          </div>
        </Collapse>
      </div>

    );
  }
}

LayerSelector.propTypes = propTypes;
LayerSelector.defaultProps = defaultProps;
