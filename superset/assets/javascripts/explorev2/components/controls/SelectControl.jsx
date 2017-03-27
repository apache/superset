import React, { PropTypes } from 'react';
import Select, { Creatable } from 'react-select';

const propTypes = {
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
};

const defaultProps = {
  choices: [],
  clearable: true,
  description: null,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  onChange: () => {},
};

export default class SelectControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { options: this.getOptions(props) };
    this.onChange = this.onChange.bind(this);
    this.renderOption = this.renderOption.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.choices !== this.props.choices) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map((o) => o.value) : null;
    }
    this.props.onChange(optionValue);
  }
  getOptions(props) {
    // Accepts different formats of input
    const options = props.choices.map(c => {
      let option;
      if (Array.isArray(c)) {
        const label = c.length > 1 ? c[1] : c[0];
        option = {
          value: c[0],
          label,
        };
        if (c[2]) option.imgSrc = c[2];
      } else if (Object.is(c)) {
        option = c;
      } else {
        option = {
          value: c,
          label: c,
        };
      }
      return option;
    });
    if (props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = options.map(c => c.value);
      if (props.value) {
        let valuesToAdd = props.value;
        if (!Array.isArray(valuesToAdd)) {
          valuesToAdd = [valuesToAdd];
        }
        valuesToAdd.forEach(v => {
          if (values.indexOf(v) < 0) {
            options.push({ value: v, label: v });
          }
        });
      }
    }
    return options;
  }
  renderOption(opt) {
    if (opt.imgSrc) {
      return (
        <div>
          <img className="viz-thumb-option" src={opt.imgSrc} alt={opt.value} />
          <span>{opt.label}</span>
        </div>
      );
    }
    return opt.label;
  }
  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder: `Select (${this.state.options.length})`,
      options: this.state.options,
      value: this.props.value,
      autosize: false,
      clearable: this.props.clearable,
      isLoading: this.props.isLoading,
      onChange: this.onChange,
      optionRenderer: this.renderOption,
    };
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectWrap = this.props.freeForm ?
      (<Creatable {...selectProps} />) : (<Select {...selectProps} />);
    return (
      <div>
        {selectWrap}
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
