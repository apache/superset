import React, { PropTypes } from 'react';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';
import { slugify } from '../../modules/utils';
import Select, { Creatable } from 'react-select';


const propTypes = {
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
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
  freeForm: false,
  label: null,
  multi: false,
  onChange: () => {},
  value: '',
};

export default class SelectField extends React.Component {
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map((o) => o.value) : null;
    }
    if (this.props.name === 'datasource' && optionValue !== null) {
      this.props.onChange(this.props.name, optionValue, opt.label);
    } else {
      this.props.onChange(this.props.name, optionValue);
    }
  }
  renderOption(opt) {
    if (this.props.name === 'viz_type') {
      const url = `/static/assets/images/viz_thumbnails/${opt.value}.png`;
      return (
        <div>
          <img className="viz-thumb-option" src={url} alt={opt.value} />
          <span>{opt.value}</span>
        </div>
      );
    }
    return opt.label;
  }
  render() {
    const choices = this.props.choices;
    const options = choices.map((c) => ({ value: c[0], label: c[1] }));
    if (this.props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = choices.map((c) => c[0]);
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

    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder: `Select (${choices.length})`,
      options,
      value: this.props.value,
      autosize: false,
      clearable: this.props.clearable,
      onChange: this.onChange.bind(this),
      optionRenderer: this.renderOption.bind(this),
    };
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectWrap = this.props.freeForm ?
      (<Creatable {...selectProps} />) : (<Select {...selectProps} />);
    if (this.props.label) {
      return (
        <div id={`formControlsSelect-${slugify(this.props.label)}`}>
          <ControlLabelWithTooltip
            label={this.props.label}
            description={this.props.description}
          />
          {selectWrap}
        </div>
      );
    }
    return (
      <div>
        {selectWrap}
      </div>
    );
  }
}

SelectField.propTypes = propTypes;
SelectField.defaultProps = defaultProps;
