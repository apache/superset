import React from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse, Well } from 'react-bootstrap';
import  './LayerSelector.css';

const propTypes = {
  layers: PropTypes.object,
  toggleCategory: PropTypes.func,
  toggleLayer: PropTypes.func,
  showSingleCategory: PropTypes.func,
  position: PropTypes.oneOf(['tl', 'tr', 'bl', 'br']),
  width: PropTypes.number,
  height: PropTypes.number,
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

  renderColorBar(colorBar) {
    if (colorBar) {

      const colorBars = colorBar.map(bar => (
        <p
          style={{ 'line-height': '5px' }}
          key={bar[0]}
        >
          <span style={{ color: 'rgba(' + bar[1].join(', ') + ')' }}>
            {'\u25FC'}
          </span>
          {bar[0]}
        </p>
      ));

      return (
        <div className="colorBar">
          { colorBars }
        </div>
        );
      }
    return null;
  }

  render() {
    if (Object.keys(this.props.layers).length === 0) {
      return null;
    }

    const layers = Object.entries(this.props.layers).map(([k, v]) => {
      let style = {};
      let icon = '';
      if (v.type === 'vector') {
        if (v['fill-type'] === 'fill') {
          style = { color: 'rgba(' + v.color.join(', ') + ')' };
          icon = '\u25FC';
        } else if (v['fill-type'] === 'point') {
          style = { color: 'rgba(' + v.color.join(', ') + ')' };
          icon = '\u26AB';
        } else if (v['fill-type'] === 'line') {
          style = { color: 'rgba(' + v.color.join(', ') + ')' };
          icon = '\u2014';
        } else if (v['fill-type'] === 'symbol') {
        style = {
          'background-image': 'url("https://cdn.rawgit.com/mapbox/mapbox' +
            '-gl-styles/master/sprites/bright-v9/_svg/' + v.icon + '.svg")',
          width: '20px',
          height: '20px',
          display: 'inline-block',
          'background-position-x': '-3px',
        };
        icon = '';
        }

      }
      return (
        <li key={k}>
          <input
            type="checkbox"
            name={k}
            checked={this.state[k]}
            onChange={this.handleInputChange}
          />
          <span style={style}>{icon}</span>
          <label htmlFor={k}>
            {v.legend + '\u2002'}
          </label>
          {this.renderColorBar(v.color_bar)}
        </li>
      );
    });

    return (
      <div
        className={'layerSelectorContainer'}
        style={{ width: this.props.width, height: this.props.height }}
      >
        <Button
          className={'cbutton'}
          onClick={() => this.setState({ open: !this.state.open })}
        >
          <i className="material-icons">layers</i>
        </Button>
        <div className={'layerSelector'}>
          <Collapse in={this.state.open} dimension={'width'}>
            <div>
              <Well className={'well'}>
                <h6> Layers </h6>
                <ul>{layers}</ul>
              </Well>
            </div>
          </Collapse>
        </div>
      </div>
    );
  }
}

LayerSelector.propTypes = propTypes;
LayerSelector.defaultProps = defaultProps;
