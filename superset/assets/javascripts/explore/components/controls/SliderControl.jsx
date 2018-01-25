import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';
import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';

const propTypes = {
  start: PropTypes.number,
  step: PropTypes.number,
  end: PropTypes.number,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  showHeader: PropTypes.bool,
};

const defaultProps = {
  start: null,
  step: null,
  end: null,
  clearable: true,
  description: null,
  isLoading: false,
  label: null,
  onChange: () => {},
  showHeader: true,
};

export default class SliderControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(event) {
    this.props.onChange(event.target.value);
  }
  formatter(value) {
    return (new Date(value)).toUTCString();
  }
  render() {
    return (
      <div>
        {this.props.showHeader &&
          <ControlHeader {...this.props} />
        }
        <ReactBootstrapSlider
          value={this.props.value}
          formatter={this.formatter}
          change={this.onChange}
          //slideStop={this.onChange}
          min={this.props.start}
          max={this.props.end}
          step={this.props.step}
          orientation="horizontal"
          reversed={false}
          disabled="enabled" />
      </div>
    );
  }
}

SliderControl.propTypes = propTypes;
SliderControl.defaultProps = defaultProps;
