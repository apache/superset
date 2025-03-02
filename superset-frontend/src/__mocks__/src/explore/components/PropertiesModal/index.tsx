const PropertiesModal = ({ show, onHide, onSave, slice }: any) => (
  <div
    role="dialog"
    data-test="properties-modal"
    style={{ display: show ? 'block' : 'none' }}
  >
    <button type="button" onClick={onHide}>
      Cancel
    </button>
    <button type="button" onClick={() => onSave(slice)}>
      Save
    </button>
  </div>
);

export default PropertiesModal;
