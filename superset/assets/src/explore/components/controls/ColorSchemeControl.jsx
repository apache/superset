import React from 'react';
import PropTypes from 'prop-types';
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
  choices: PropTypes.arrayOf(PropTypes.array).isRequired,
  schemes: PropTypes.object.isRequired,
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
    const currentScheme = key.value ?
      this.props.schemes[key.value] :
      this.props.schemes[defaultProps.value];

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
    const selectProps = {
      multi: false,
      name: `select-${this.props.name}`,
      placeholder: `Select (${this.props.choices.length})`,
      default: this.props.default,
      options: this.props.choices.map(choice => ({ value: choice[0], label: choice[1] })),
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
