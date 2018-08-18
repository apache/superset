import React from 'react';
import PropTypes from 'prop-types';

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  aggregation: PropTypes.bool,
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
  children: PropTypes.node,
};

const defaultProps = {
  aggregation: false,
  disabled: false,
  step: 1,
};

export default class AnimatableDeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    const { getLayers, start, end, step, values, disabled, viewport, ...other } = props;
    this.state = { values, viewport };
    this.other = other;
    this.onChange = this.onChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState({ values: nextProps.values, viewport: nextProps.viewport });
  }
  onChange(newValues) {
    let values;
    if (!Array.isArray(newValues)) {
      values = [newValues, newValues + this.props.step];
    } else {
      values = newValues;
    }
    this.setState({ values });
  }
  render() {
    const layers = this.props.getLayers(this.state.values);
    return (
      <div>
        <DeckGLContainer
          {...this.other}
          viewport={this.state.viewport}
          layers={layers}
          onViewportChange={newViewport => this.setState({ viewport: newViewport })}
        />
        {!this.props.disabled &&
        <PlaySlider
          start={this.props.start}
          end={this.props.end}
          step={this.props.step}
          values={this.state.values}
          range={!this.props.aggregation}
          onChange={this.onChange}
        />
        }
        {this.props.children}
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
