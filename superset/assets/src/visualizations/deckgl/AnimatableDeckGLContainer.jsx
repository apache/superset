import React from 'react';
import PropTypes from 'prop-types';

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const PLAYSLIDER_HEIGHT = 20;  // px

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

    this.onViewportChange = this.onViewportChange.bind(this);
  }
  onViewportChange(viewport) {
    const originalViewport = this.props.disabled
      ? { ...viewport }
      : { ...viewport, height: viewport.height + PLAYSLIDER_HEIGHT };
    this.props.onViewportChange(originalViewport);
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
      onValuesChange,
      viewport,
    } = this.props;
    const layers = getLayers(values);

    // leave space for the play slider
    const modifiedViewport = {
      ...viewport,
      height: disabled ? viewport.height : viewport.height - PLAYSLIDER_HEIGHT,
    };

    return (
      <div>
        <DeckGLContainer
          {...this.other}
          viewport={modifiedViewport}
          layers={layers}
          onViewportChange={this.onViewportChange}
        />
        {!disabled &&
        <PlaySlider
          start={start}
          end={end}
          step={getStep(start)}
          values={values}
          range={!aggregation}
          onChange={onValuesChange}
        />
        }
        {children}
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
