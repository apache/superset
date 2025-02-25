import React from 'react';

interface DeleteModalProps {
  description: string;
  onConfirm: () => void;
  onHide: () => void;
  open: boolean;
  title: string;
}

const DeleteModal = ({ description, onConfirm, onHide, open, title }: DeleteModalProps) => {
  if (!open) return null;

  return (
    <div role="dialog">
      <h4>{title}</h4>
      <p>{description}</p>
      <button role="button" onClick={() => {
        try {
          onConfirm();
        } catch (error) {
          // Let the error propagate
          throw error;
        }
      }}>
        Confirm
      </button>
      <button role="button" onClick={onHide}>Cancel</button>
    </div>
  );
};

export default DeleteModal;