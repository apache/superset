import { t } from "@superset-ui/core";
import { FunctionComponent, useEffect, useState } from "react";
import { FormLabel } from "src/components/Form";
import { Input } from "src/components/Input";
import Modal from "src/components/Modal";
import Dataset from "src/types/Dataset";

interface DuplicateDatasetModalProps {
  dataset: Dataset | null,
  onHide: () => void,
  onDuplicate: (newDatasetName: string) => void
}

const DuplicateDatasetModal: FunctionComponent<DuplicateDatasetModalProps> = ({
  dataset,
  onHide,
  onDuplicate,
}) => {

  const [show, setShow] = useState<boolean>(false);
  const [disableSave, setDisableSave] = useState<boolean>(false);
  const [newDuplicateDatasetName, setNewDuplicateDatasetName] = useState<string>("");

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetValue = event.target.value ?? '';
    setNewDuplicateDatasetName(targetValue);
    setDisableSave(targetValue === '');
  };

  const duplicateDataset = () => {
    onDuplicate(newDuplicateDatasetName);
  }

  useEffect(() => {
    setNewDuplicateDatasetName("");
    setShow(dataset !== null);
  }, [dataset]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Duplicate dataset')}
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={duplicateDataset}
    >
      <FormLabel htmlFor="duplicate">
          {t('New dataset name')}
      </FormLabel>
      <Input
        data-test="duplicate-modal-input"
        type="text"
        id="duplicate"
        autoComplete="off"
        value={newDuplicateDatasetName}
        onChange={onChange}
        onPressEnter={duplicateDataset}
      />
    </Modal>
  );
}

export default DuplicateDatasetModal;