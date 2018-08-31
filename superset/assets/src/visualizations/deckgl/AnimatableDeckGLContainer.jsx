import React from 'react';
import PropTypes from 'prop-types';

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  step: PropTypes.object,
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
    const { getLayers, start, end, step, values, disabled, viewport, ...other } = props;
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
        : [newValues, this.props.step.addTo(newValues)],
    });
  }
  render() {
    const { start, end, step, disabled, aggregation, children, getLayers } = this.props;
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
          step={step.addTo(start) - start}
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
