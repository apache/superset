import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import ModalTrigger from '../../components/ModalTrigger';

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
  [0, "Don't refresh"],
  [10, '10 seconds'],
  [30, '30 seconds'],
  [60, '1 minute'],
  [300, '5 minutes'],
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
        isButton
        modalTitle="Refresh Interval"
        modalBody={
          <div>
            Choose the refresh frequency for this dashboard
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
