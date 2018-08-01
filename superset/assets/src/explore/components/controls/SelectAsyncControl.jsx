/* eslint no-undef: 2 */
import React from 'react';
import PropTypes from 'prop-types';
import Select from '../../../components/AsyncSelect';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

import withToasts from '../../../messageToasts/enhancers/withToasts';

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
  addDangerToast: PropTypes.func.isRequired,
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
    let val;
    if (multi) {
      val = options.map(option => option.value);
    } else if (options) {
      val = options.value;
    } else {
      val = null;
    }
    onChange(val);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <Select
        dataEndpoint={dataEndpoint}
        onChange={onSelectionChange}
        onAsyncError={errorMsg => this.props.addDangerToast(onAsyncErrorMessage + ': ' + errorMsg)}
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

export default withToasts(SelectAsyncControl);
