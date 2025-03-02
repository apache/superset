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
      <button type="button" onClick={onHide}>
        Cancel
      </button>
      <button
        type="button"
        onClick={onHandledPrimaryAction}
        disabled={disablePrimaryButton}
        aria-disabled={disablePrimaryButton}
      >
        {primaryButtonName}
      </button>
    </div>
  </div>
);

export default Modal;
