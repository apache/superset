// @ts-nocheck
import React, { ChangeEvent, useState, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Modal from 'src/components/Modal';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import Button from 'src/components/Button';
import { loadTags } from 'src/components/Tags/utils';
import { useToasts } from 'src/components/MessageToasts/withToasts';

interface BulkTagModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  selected: any[];
  resourceName: string;
  // clearOnHide: boolean;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({
  show,
  selected = [],
  onHide,
  refreshData,
  resourceName,
}) => {
  const { addSuccessToast, addDangerToast } = useToasts();
  useEffect(() => {}, []);

  const onSave = async () => {
    await SupersetClient.post({
      endpoint: `/api/v1/tag/bulk_create`,
      jsonPayload: {
        tags: tags.map(tag => tag.value),
        objects_to_tag: selected.map(item => [resourceName, +item.original.id]),
      },
    })
      .then(({ json = {} }) => {
        addSuccessToast(`Tagged ${selected.length} items`);
      })
      .catch(err => {
        addDangerToast('Failed to tag items');
      });

    refreshData();
    onHide();
  };

  const [tags, setTags] = useState<TaggableResourceOption[]>([]);

  return (
    <Modal
      title="Bulk tag"
      show={show}
      onHide={onHide}
      footer={
        <div>
          <Button
            data-test="modal-save-dashboard-button"
            buttonStyle="secondary"
            onClick={onHide}
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="modal-save-dashboard-button"
            buttonStyle="primary"
            onClick={onSave}
          >
            {t('Save')}
          </Button>
        </div>
      }
    >
      <>
        <>{`You are adding tags to the ${selected.length} entities`}</>
        <br />
        <FormLabel>{t('tags')}</FormLabel>
        <AsyncSelect
          ariaLabel="tags"
          value={tags}
          options={loadTags}
          onHide={onHide}
          onChange={tags => setTags(tags)}
          placeholder="Select Tags"
          mode="multiple"
        />
      </>
    </Modal>
  );
};

export default BulkTagModal;
