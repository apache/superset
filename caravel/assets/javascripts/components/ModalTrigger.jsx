import React, { PropTypes } from 'react';
import { Modal } from 'react-bootstrap';

const propTypes = {
  buttonBody: PropTypes.node.isRequired,
  modalTitle: PropTypes.string.isRequired,
  modalBody: PropTypes.node.isRequired,
  beforeOpen: PropTypes.func,
};

const defaultProps = {
  beforeOpen: () => {},
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

  open() {
    this.props.beforeOpen();
    this.setState({ showModal: true });
  }

  render() {
    return (
      <span
        className="btn btn-default btn-sm"
        onClick={this.open}
      >
        {this.props.buttonBody}&nbsp;
        <Modal show={this.state.showModal} onHide={this.close}>
          <Modal.Header closeButton>
            <Modal.Title>{this.props.modalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {this.props.modalBody}
          </Modal.Body>
        </Modal>
      </span>
    );
  }
}

ModalTrigger.propTypes = propTypes;
ModalTrigger.defaultProps = defaultProps;
