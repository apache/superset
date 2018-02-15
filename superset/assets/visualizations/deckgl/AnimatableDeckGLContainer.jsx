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
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
};

const defaultProps = {
  disabled: false,
};

export default class AnimatableDeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    const { getLayers, start, end, step, values, disabled, viewport, ...other } = props;
    this.state = { values, viewport };
    this.other = other;
  }
  componentWillReceiveProps(nextProps) {
    this.setState({ values: nextProps.values, viewport: nextProps.viewport });
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
          onChange={newValues => this.setState({ values: newValues })}
        />
        }
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
