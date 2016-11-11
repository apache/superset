import React, { PropTypes } from 'react';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';
import { slugify } from '../../modules/utils';
import Select, { Creatable } from 'react-select';


const propTypes = {
  name: PropTypes.string.isRequired,
  choices: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  multi: PropTypes.bool,
  freeForm: PropTypes.bool,
};

const defaultProps = {
  multi: false,
  freeForm: false,
  value: '',
  label: null,
  description: null,
  onChange: () => {},
};

export default class SelectField extends React.Component {
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map((o) => o.value) : null;
    }
    this.props.onChange(this.props.name, optionValue);
  }
  render() {
    const options = this.props.choices.map((c) => ({ value: c[0], label: c[1] }));
    if (this.props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = this.props.choices.map((c) => c[0]);
      if (values.indexOf(this.props.value) === -1) {
        options.push({ value: this.props.value, label: this.props.value });
      }
    }

    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder: `Select (${this.props.choices.length})`,
      options,
      value: this.props.value,
      autosize: false,
      onChange: this.onChange.bind(this),
    };
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectWrap = this.props.freeForm ?
      (<Creatable {...selectProps} />) : (<Select {...selectProps} />);

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
}

SelectField.propTypes = propTypes;
SelectField.defaultProps = defaultProps;
