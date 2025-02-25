import React from 'react';

const Modal = ({
  title,
  children,
  onHide,
  onHandledPrimaryAction,
  primaryButtonName,
  show,
  disablePrimaryButton,
}: any) => (
  <div
    role="dialog"
    className="modal"
    style={{ display: show ? 'block' : 'none' }}
  >
    <div data-testid="css-template-modal-title">{title}</div>
    <div className="modal-content">{children}</div>
    <div className="modal-footer">
      <button onClick={onHide}>Cancel</button>
      <button
        onClick={onHandledPrimaryAction}
        disabled={disablePrimaryButton}
        role="button"
        aria-disabled={disablePrimaryButton}
      >
        {primaryButtonName}
      </button>
    </div>
  </div>
);

export default Modal;