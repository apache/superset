/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import Select from '../../../components/AsyncSelect';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  multi: PropTypes.bool,
  mutator: PropTypes.func,
  onAsyncErrorMessage: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
  ]),
};

const defaultProps = {
  multi: true,
  onAsyncErrorMessage: t('Error while fetching data'),
  onChange: () => {},
  placeholder: t('Select ...'),
};

const SelectAsyncControl = (props) => {
  const { value, onChange, dataEndpoint, multi, mutator, placeholder, onAsyncErrorMessage } = props;
  const onSelectionChange = (options) => {
    const optionValues = options.map(option => option.value);
    onChange(optionValues);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <Select
        dataEndpoint={dataEndpoint}
        onChange={onSelectionChange}
        onAsyncError={errorMsg => notify.error(onAsyncErrorMessage + ': ' + errorMsg)}
        mutator={mutator}
        multi={multi}
        value={value}
        placeholder={placeholder}
        valueRenderer={v => (<div>{v.label}</div>)}
      />
    </div>
  );
};

SelectAsyncControl.propTypes = propTypes;
SelectAsyncControl.defaultProps = defaultProps;

export default SelectAsyncControl;
