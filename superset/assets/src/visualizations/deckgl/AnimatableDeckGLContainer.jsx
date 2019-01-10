import React from 'react';
import PropTypes from 'prop-types';

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  getStep: PropTypes.func,
  values: PropTypes.array.isRequired,
  aggregation: PropTypes.bool,
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
  children: PropTypes.node,
};

const defaultProps = {
  aggregation: false,
  disabled: false,
};

export default class AnimatableDeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    const { getLayers, start, end, getStep, values, disabled, viewport, ...other } = props;
    this.state = { values, viewport };
    this.other = other;
    this.onChange = this.onChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState({ values: nextProps.values, viewport: nextProps.viewport });
  }
  onChange(newValues) {
    this.setState({
      values: Array.isArray(newValues)
        ? newValues
        : [newValues, this.props.getStep(newValues)],
    });
  }
  render() {
    const { start, end, getStep, disabled, aggregation, children, getLayers } = this.props;
    const { values, viewport } = this.state;
    const layers = getLayers(values);
    return (
      <div>
        <DeckGLContainer
          {...this.other}
          viewport={viewport}
          layers={layers}
          onViewportChange={newViewport => this.setState({ viewport: newViewport })}
        />
        {!disabled &&
        <PlaySlider
          start={start}
          end={end}
          step={getStep(start)}
          values={values}
          range={!aggregation}
          onChange={this.onChange}
        />
        }
        {children}
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
