import React, { PropTypes } from 'react';
import Select, { Creatable } from 'react-select';

const propTypes = {
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  editUrl: PropTypes.string,
  freeForm: PropTypes.bool,
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
  editUrl: null,
  freeForm: false,
  label: null,
  multi: false,
  onChange: () => {},
  value: '',
};

export default class SelectField extends React.Component {
  constructor(props) {
    super(props);
    this.state = { options: this.getOptions() };
    this.onChange = this.onChange.bind(this);
    this.renderOption = this.renderOption.bind(this);
  }
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map((o) => o.value) : null;
    }
    this.props.onChange(optionValue);
  }
  getOptions() {
    const options = this.props.choices.map((c) => {
      const label = c.length > 1 ? c[1] : c[0];
      const newOptions = {
        value: c[0],
        label,
      };
      if (c[2]) newOptions.imgSrc = c[2];
      return newOptions;
    });
    if (this.props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = this.props.choices.map((c) => c[0]);
      if (this.props.value) {
        if (typeof this.props.value === 'object') {
          this.props.value.forEach((v) => {
            if (values.indexOf(v) === -1) {
              options.push({ value: v, label: v });
            }
          });
        } else {
          if (values.indexOf(this.props.value) === -1) {
            options.push({ value: this.props.value, label: this.props.value });
          }
        }
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
      onChange: this.onChange,
      optionRenderer: this.renderOption,
    };
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectWrap = this.props.freeForm ?
      (<Creatable {...selectProps} />) : (<Select {...selectProps} />);
    return (
      <div>
        {selectWrap}
        {this.props.editUrl &&
          <a href={`${this.props.editUrl}/${this.props.value}`}>edit</a>
        }
      </div>
    );
  }
}

SelectField.propTypes = propTypes;
SelectField.defaultProps = defaultProps;
