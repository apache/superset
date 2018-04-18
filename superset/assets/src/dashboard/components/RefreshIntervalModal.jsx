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
  [0, t('Don\'t refresh')],
  [10, t('10 seconds')],
  [30, t('30 seconds')],
  [60, t('1 minute')],
  [300, t('5 minutes')],
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
              onChange={(opt) => {
                this.setState({ refreshFrequency: opt.value });
                this.props.onChange(opt.value);
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
