// @ts-nocheck
import React, { ChangeEvent, useState, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Modal from 'src/components/Modal';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { loadTags } from 'src/components/Tags/utils';

interface BulkTagModalProps {
  // onHide: () => void;
  // refreshData: () => void;
  // addSuccessToast: (msg: string) => void;
  // addDangerToast: (msg: string) => void;
  show: boolean;
  resources: any[];
  // clearOnHide: boolean;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({
  show,
  resources = [],
  //   onHide,
  //   refreshData,
  //   addSuccessToast,
  //   addDangerToast,
}) => {
  useEffect(() => {}, []);

  return (
    <Modal title="Bulk tag" show={show}>
      <>
        <>{`You are adding tags to the ${resources.length} entities`}</>
        <br />
        <FormLabel>{t('tags')}</FormLabel>
        <AsyncSelect
          ariaLabel="tags"
          // value={tagsValue}
          // onChange={onTagSearchChange}
          options={loadTags}
          placeholder="Select"
          mode="multiple"
        />
      </>
    </Modal>
  );
};

export default BulkTagModal;
