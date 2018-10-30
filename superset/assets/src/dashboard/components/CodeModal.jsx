import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  code: PropTypes.string,
  codeCallback: PropTypes.func,
};

const defaultProps = {
  codeCallback: () => {},
  code: '',
};

export default class CodeModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { code: props.code };
    this.beforeOpen = this.beforeOpen.bind(this);
  }

  beforeOpen() {
    let code = this.props.code;
    if (!code && this.props.codeCallback) {
      code = this.props.codeCallback();
    }
    this.setState({ code });
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isButton
        beforeOpen={this.beforeOpen}
        modalTitle={t('Active Dashboard Filters')}
        modalBody={
          <div className="CodeModal">
            <pre>{this.state.code}</pre>
          </div>
        }
      />
    );
  }
}
CodeModal.propTypes = propTypes;
CodeModal.defaultProps = defaultProps;
