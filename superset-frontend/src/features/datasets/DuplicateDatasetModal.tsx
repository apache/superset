/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t } from '@superset-ui/core';
import { FunctionComponent, useEffect, useState, ChangeEvent } from 'react';
import { FormLabel } from 'src/components/Form';
import { Input } from 'src/components/Input';
import Modal from 'src/components/Modal';
import Dataset from 'src/types/Dataset';

interface DuplicateDatasetModalProps {
  dataset: Dataset | null;
  onHide: () => void;
  onDuplicate: (newDatasetName: string) => void;
}

const DuplicateDatasetModal: FunctionComponent<DuplicateDatasetModalProps> = ({
  dataset,
  onHide,
  onDuplicate,
}) => {
  const [show, setShow] = useState<boolean>(false);
  const [disableSave, setDisableSave] = useState<boolean>(false);
  const [newDuplicateDatasetName, setNewDuplicateDatasetName] =
    useState<string>('');

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const targetValue = event.target.value ?? '';
    setNewDuplicateDatasetName(targetValue);
    setDisableSave(targetValue === '');
  };

  const duplicateDataset = () => {
    onDuplicate(newDuplicateDatasetName);
  };

  useEffect(() => {
    setNewDuplicateDatasetName('');
    setShow(dataset !== null);
  }, [dataset]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Duplicate dataset')}
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={duplicateDataset}
      primaryButtonName={t('Duplicate')}
    >
      <FormLabel htmlFor="duplicate">{t('New dataset name')}</FormLabel>
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
};

export default DuplicateDatasetModal;
