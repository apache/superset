import React, { PropTypes } from 'react';
import { Modal } from 'react-bootstrap';
import cx from 'classnames';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  modalTitle: PropTypes.string.isRequired,
  modalBody: PropTypes.node.isRequired,
  beforeOpen: PropTypes.func,
  isButton: PropTypes.bool,
};

const defaultProps = {
  beforeOpen: () => {},
  isButton: false,
};

export default class ModalTrigger extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
    };
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
  }

  close() {
    this.setState({ showModal: false });
  }

  open(e) {
    e.preventDefault();
    this.props.beforeOpen();
    this.setState({ showModal: true });
  }

  render() {
    const classNames = cx({
      'btn btn-default btn-sm': this.props.isButton,
    });
    return (
      <a href="#" className={classNames} onClick={this.open}>
        {this.props.triggerNode}
        <Modal show={this.state.showModal} onHide={this.close}>
          <Modal.Header closeButton>
            <Modal.Title>{this.props.modalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {this.props.modalBody}
          </Modal.Body>
        </Modal>
      </a>
    );
  }
}

ModalTrigger.propTypes = propTypes;
ModalTrigger.defaultProps = defaultProps;
