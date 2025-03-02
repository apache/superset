interface DeleteModalProps {
  description: string;
  onConfirm: () => void;
  onHide: () => void;
  open: boolean;
  title: string;
}

const DeleteModal = ({
  description,
  onConfirm,
  onHide,
  open,
  title,
}: DeleteModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div role="dialog">
      <h4>{title}</h4>
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>
        Confirm
      </button>
      <button type="button" onClick={onHide}>
        Cancel
      </button>
    </div>
  );
};

export default DeleteModal;
