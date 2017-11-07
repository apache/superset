import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

export default class OnPasteSelect extends React.Component {
  onPaste(evt) {
    if (!this.props.multi) {
      return;
    }
    evt.preventDefault();
    const clipboard = evt.clipboardData.getData('Text');
    if (!clipboard) {
      return;
    }
    const regex = `[${this.props.separator}]+`;
    const values = clipboard.split(new RegExp(regex)).map(v => v.trim());
    const validator = this.props.isValidNewOption;
    const selected = this.props.value || [];
    const existingOptions = {};
    const existing = {};
    this.props.options.forEach((v) => {
      existingOptions[v[this.props.valueKey]] = 1;
    });
    let options = [];
    selected.forEach((v) => {
      options.push({ [this.props.labelKey]: v, [this.props.valueKey]: v });
      existing[v] = 1;
    });
    options = options.concat(values
      .filter((v) => {
        const notExists = !existing[v];
        existing[v] = 1;
        return notExists && (validator ? validator({ [this.props.labelKey]: v }) : !!v);
      })
      .map((v) => {
        const opt = { [this.props.labelKey]: v, [this.props.valueKey]: v };
        if (!existingOptions[v]) {
          this.props.options.unshift(opt);
        }
        return opt;
      }),
    );
    if (options.length) {
      if (this.props.onChange) {
        this.props.onChange(options);
      }
    }
  }
  render() {
    const SelectComponent = this.props.selectWrap;
    const refFunc = (ref) => {
      if (this.props.ref) {
        this.props.ref(ref);
      }
      this.pasteInput = ref;
    };
    const inputProps = { onPaste: this.onPaste.bind(this) };
    return (
      <SelectComponent
        {...this.props}
        ref={refFunc}
        inputProps={inputProps}
      />
    );
  }
}

OnPasteSelect.propTypes = {
  separator: PropTypes.string.isRequired,
  selectWrap: PropTypes.func.isRequired,
  ref: PropTypes.func,
  onChange: PropTypes.func.isRequired,
  valueKey: PropTypes.string.isRequired,
  labelKey: PropTypes.string.isRequired,
  options: PropTypes.array,
  multi: PropTypes.bool.isRequired,
  value: PropTypes.any,
  isValidNewOption: PropTypes.func,
};
OnPasteSelect.defaultProps = {
  separator: ',',
  selectWrap: Select,
  valueKey: 'value',
  labelKey: 'label',
  options: [],
  multi: false,
};
