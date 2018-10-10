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
  onViewportChange: PropTypes.func,
  onValuesChange: PropTypes.func,
};

const defaultProps = {
  aggregation: false,
  disabled: false,
  onViewportChange: () => {},
  onValuesChange: () => {},
};

export default class AnimatableDeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    const { getLayers, start, end, getStep, values, disabled, viewport, ...other } = props;
    this.other = other;
  }
  componentWillReceiveProps(nextProps) {
    this.setState({ values: nextProps.values });
  }
  render() {
    const {
      start,
      end,
      getStep,
      disabled,
      aggregation,
      children,
      getLayers,
      values,
      viewport,
    } = this.props;
    const layers = getLayers(values);
    return (
      <div>
        <DeckGLContainer
          {...this.other}
          viewport={viewport}
          layers={layers}
          onViewportChange={this.props.onViewportChange}
        />
        {!disabled &&
        <PlaySlider
          start={start}
          end={end}
          step={getStep(start)}
          values={values}
          range={!aggregation}
          onChange={this.props.onValuesChange}
        />
        }
        {children}
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
