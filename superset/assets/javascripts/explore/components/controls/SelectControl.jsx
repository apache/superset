import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';

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
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
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
  showHeader: true,
  optionRenderer: opt => opt.label,
  valueRenderer: opt => opt.label,
  valueKey: 'value',
};

export default class SelectControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { options: this.getOptions(props) };
    this.onChange = this.onChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.choices !== this.props.choices ||
        nextProps.options !== this.props.options) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }
  onChange(opt) {
    let optionValue = opt ? opt[this.props.valueKey] : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map(o => o[this.props.valueKey]) : null;
    }
    this.props.onChange(optionValue);
  }
  getOptions(props) {
    if (props.options) {
      return props.options;
    }
    // Accepts different formats of input
    const options = props.choices.map((c) => {
      let option;
      if (Array.isArray(c)) {
        const label = c.length > 1 ? c[1] : c[0];
        option = {
          value: c[0],
          label,
        };
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
        valuesToAdd.forEach((v) => {
          if (values.indexOf(v) < 0) {
            options.push({ value: v, label: v });
          }
        });
      }
    }
    return options;
  }
  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder: t('Select %s', this.state.options.length),
      options: this.state.options,
      value: this.props.value,
      labelKey: 'label',
      valueKey: this.props.valueKey,
      autosize: false,
      clearable: this.props.clearable,
      isLoading: this.props.isLoading,
      onChange: this.onChange,
      optionRenderer: VirtualizedRendererWrap(this.props.optionRenderer),
      valueRenderer: this.props.valueRenderer,
      selectComponent: this.props.freeForm ? Creatable : Select,
    };
    return (
      <div>
        {this.props.showHeader &&
          <ControlHeader {...this.props} />
        }
        <OnPasteSelect {...selectProps} selectWrap={VirtualizedSelect} />
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
