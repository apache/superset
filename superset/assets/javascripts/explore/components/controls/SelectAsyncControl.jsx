/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import Select from '../../../components/AsyncSelect';
import { t } from '../../../locales';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
  ]),
};

const defaultProps = {
  onChange: () => {},
};

class SelectAsyncControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      value: this.props.value,
    };
  }

  onChange(options) {
    const optionValues = options.map(option => option.value);
    this.setState({ value: optionValues });
    this.props.onChange(optionValues);
  }

  mutator(data) {
    if (!data || !data.result) {
      return [];
    }

    return data.result.map(layer => ({ value: layer.id, label: layer.name }));
  }

  render() {
    return (
      <Select
        dataEndpoint={'/annotationlayermodelview/api/read?'}
        onChange={this.onChange.bind(this)}
        onAsyncError={() => notify.error(t('Error while fetching annotation layers'))}
        mutator={this.mutator}
        multi
        value={this.state.value}
        placeholder={t('Select a annotation layer')}
        valueRenderer={v => (<div>{v.label}</div>)}
      />
    );
  }
}

SelectAsyncControl.propTypes = propTypes;
SelectAsyncControl.defaultProps = defaultProps;

export default SelectAsyncControl;
