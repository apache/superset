import React from 'react';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  triggerNode: React.PropTypes.node.isRequired,
  code: React.PropTypes.string,
  codeCallback: React.PropTypes.func,
};

const defaultProps = {
};

export default class CodeModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      refreshFrequency: props.initialRefreshFrequency,
    };
  }
  beforeOpen() {
    let code = this.props.code;
    if (this.props.codeCallback) {
      code = this.props.codeCallback();
    }
    this.setState({ code });
  }
  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isButton
        beforeOpen={this.beforeOpen.bind(this)}
        modalTitle="Active Dashboard Filters"
        modalBody={
          <div className="CodeModal">
            <pre>
              {this.state.code}
            </pre>
          </div>
        }
      />
    );
  }
}
CodeModal.propTypes = propTypes;
CodeModal.defaultProps = defaultProps;
