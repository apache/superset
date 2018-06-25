import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  initialRefreshFrequency: PropTypes.number,
  onChange: PropTypes.func,
};

const defaultProps = {
  initialRefreshFrequency: 0,
  onChange: () => {},
};

const options = [
  [0, t("Don't refresh")],
  [10, t('10 seconds')],
  [30, t('30 seconds')],
  [60, t('1 minute')],
  [300, t('5 minutes')],
  [1800, t('30 minutes')],
  [3600, t('1 hour')],
  [21600, t('6 hours')],
  [43200, t('12 hours')],
  [86400, t('24 hours')],
].map(o => ({ value: o[0], label: o[1] }));

class RefreshIntervalModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      refreshFrequency: props.initialRefreshFrequency,
    };
  }
  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isMenuItem
        modalTitle={t('Refresh Interval')}
        modalBody={
          <div>
            {t('Choose the refresh frequency for this dashboard')}
            <Select
              options={options}
              value={this.state.refreshFrequency}
              onChange={opt => {
                const value = opt ? opt.value : options[0].value;
                this.setState({
                  refreshFrequency: value,
                });
                this.props.onChange(value);
              }}
            />
          </div>
        }
      />
    );
  }
}
RefreshIntervalModal.propTypes = propTypes;
RefreshIntervalModal.defaultProps = defaultProps;

export default RefreshIntervalModal;
