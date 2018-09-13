import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default class DeleteComponentModal extends React.PureComponent {
  constructor(props) {
    super(props);

    this.modal = null;
    this.close = this.close.bind(this);
    this.deleteTab = this.deleteTab.bind(this);
    this.setModalRef = this.setModalRef.bind(this);
  }

  setModalRef(ref) {
    this.modal = ref;
  }

  close() {
    this.modal.close();
  }

  deleteTab() {
    this.modal.close();
    this.props.onDelete();
  }

  render() {
    return (
      <ModalTrigger
        ref={this.setModalRef}
        triggerNode={this.props.triggerNode}
        modalBody={
          <div className="delete-component-modal">
            <h1>{t('Delete dashboard tab?')}</h1>
            <div>
              Deleting a tab will remove all content within it. You may still
              reverse this action with the <b>undo</b> button (cmd + z) until
              you save your changes.
            </div>
            <div className="delete-modal-actions-container">
              <Button onClick={this.close}>{t('Cancel')}</Button>
              <Button bsStyle="primary" onClick={this.deleteTab}>
                {t('Delete')}
              </Button>
            </div>
          </div>
        }
      />
    );
  }
}

DeleteComponentModal.propTypes = propTypes;
