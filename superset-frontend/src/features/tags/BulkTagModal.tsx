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
import React, { useState, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Modal from 'src/components/Modal';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import Button from 'src/components/Button';
import { loadTags } from 'src/components/Tags/utils';
import { TaggableResourceOption } from 'src/features/tags/TagModal';

interface BulkTagModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  selected: any[];
  resourceName: string;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({
  show,
  selected = [],
  onHide,
  refreshData,
  resourceName,
  addSuccessToast,
  addDangerToast,
}) => {
  useEffect(() => {}, []);
  const [tags, setTags] = useState<TaggableResourceOption[]>([]);

  const onSave = async () => {
    await SupersetClient.post({
      endpoint: `/api/v1/tag/bulk_create`,
      jsonPayload: {
        tags: tags.map(tag => ({
          name: tag.value,
          objects_to_tag: selected.map(item => [
            resourceName,
            +item.original.id,
          ]),
        })),
      },
    })
      .then(({ json = {} }) => {
        addSuccessToast(t('Tagged %s items', selected.length));
      })
      .catch(err => {
        addDangerToast(t('Failed to tag items'));
      });

    refreshData();
    onHide();
    setTags([]);
  };

  return (
    <Modal
      title={t('Bulk tag')}
      show={show}
      onHide={() => {
        setTags([]);
        onHide();
      }}
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
        <>{t('You are adding tags to the %s entities', selected.length)}</>
        <br />
        <FormLabel>{t('tags')}</FormLabel>
        <AsyncSelect
          ariaLabel="tags"
          // @ts-ignore
          value={tags}
          options={loadTags}
          onHide={onHide}
          // @ts-ignore
          onChange={tags => setTags(tags)}
          placeholder={t('Select Tags')}
          mode="multiple"
        />
      </>
    </Modal>
  );
};

export default BulkTagModal;
