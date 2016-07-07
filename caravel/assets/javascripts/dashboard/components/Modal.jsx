import React, { PropTypes } from 'react';

const propTypes = {
  modalId: PropTypes.string.isRequired,
  title: PropTypes.string,
  modalContent: PropTypes.node,
  customButtons: PropTypes.node
};

class Modal extends React.Component {
  render() {
    return (
      <div className="modal fade" id={this.props.modalId} role="dialog">
          <div className="modal-dialog" role="document">
              <div className="modal-content">
                  <div className="modal-header">
                      <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                      </button>
                      <h4 className="modal-title">{this.props.title}</h4>
                  </div>
                  <div className="modal-body">
                    {this.props.modalContent}
                  </div>
                  <div className="modal-footer">
                      <button type="button"
                              className="btn btn-default"
                              data-dismiss="modal">
                          Cancel
                      </button>
                      {this.props.customButtons}
                  </div>
              </div>
          </div>
      </div>
    );
  }
}

Modal.propTypes = propTypes;

export default Modal;
