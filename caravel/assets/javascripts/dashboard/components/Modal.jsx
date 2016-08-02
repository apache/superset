import React, { PropTypes } from 'react';

const propTypes = {
  modalId: PropTypes.string.isRequired,
  title: PropTypes.string,
  modalContent: PropTypes.node,
  customButton: PropTypes.node,
};

function Modal({ modalId, title, modalContent, customButton }) {
  return (
    <div className="modal fade" id={modalId} role="dialog">
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <button type="button" className="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 className="modal-title">{title}</h4>
          </div>
          <div className="modal-body">
            {modalContent}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-default"
              data-dismiss="modal"
            >
              Cancel
            </button>
            {customButton}
          </div>
        </div>
      </div>
    </div>
  );
}

Modal.propTypes = propTypes;

export default Modal;
