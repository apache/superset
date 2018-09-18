import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import { colorScalerFactory } from '../../../modules/colors';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  default: PropTypes.string,
  choices: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.array),
    PropTypes.func,
  ]).isRequired,
  schemes: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.func,
  ]).isRequired,
  isLinear: PropTypes.bool,
};

const defaultProps = {
  choices: [],
  schemes: {},
  onChange: () => {},
};

export default class ColorSchemeControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      scheme: this.props.value,
    };

    this.onChange = this.onChange.bind(this);
    this.renderOption = this.renderOption.bind(this);
  }

  onChange(option) {
    const optionValue = option ? option.value : null;
    this.props.onChange(optionValue);
    this.setState({ scheme: optionValue });
  }

  renderOption(key) {
    const { schemes } = this.props;
    const schemeLookup = _.isFunction(schemes) ? schemes() : schemes;
    const currentScheme = schemeLookup[key.value || defaultProps.value];

    let colors = currentScheme;
    if (this.props.isLinear) {
      const colorScaler = colorScalerFactory(currentScheme);
      colors = [...Array(20).keys()].map(d => (colorScaler(d / 20)));
    }

    const list = colors.map((color, i) => (
      <li
        key={`${currentScheme}-${i}`}
        style={{ backgroundColor: color, border: `1px solid ${color === 'white' ? 'black' : color}` }}
      >&nbsp;</li>
    ));
    return (<ul className="color-scheme-container">{list}</ul>);
  }

  render() {
    const { choices } = this.props;
    const options = (_.isFunction(choices) ? choices() : choices)
      .map(choice => ({ value: choice[0], label: choice[1] }));

    const selectProps = {
      multi: false,
      name: `select-${this.props.name}`,
      placeholder: `Select (${options.length})`,
      default: this.props.default,
      options,
      value: this.props.value,
      autosize: false,
      clearable: false,
      onChange: this.onChange,
      optionRenderer: this.renderOption,
      valueRenderer: this.renderOption,
    };
    return (
      <div>
        <ControlHeader {...this.props} />
        <Creatable {...selectProps} />
      </div>
    );
  }
}

ColorSchemeControl.propTypes = propTypes;
ColorSchemeControl.defaultProps = defaultProps;
