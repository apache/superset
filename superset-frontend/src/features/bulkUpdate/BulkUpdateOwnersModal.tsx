/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { useState, FC, useCallback } from 'react';

import { t, SupersetClient, ensureIsArray } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { AsyncSelect, Row } from 'src/components';
import Chart from 'src/types/Chart';
import { Dashboard } from 'src/pages/DashboardList';
import Owners from 'src/dashboard/components/PropertiesModal';

import getOwnerName from 'src/utils/getOwnerName';
import rison from 'rison';
import Owner from 'src/types/Owner';

interface BulkUpdateOwnersModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  resourceName: 'chart' | 'dashboard';
  resourceLabel: string;
  selected: Chart[] | Dashboard[];
}

const BulkUpdateOwnersModal: FC<BulkUpdateOwnersModalProps> = ({
  show,
  selected = [],
  resourceName,
  resourceLabel,
  onHide,
  refreshData,
  addSuccessToast,
  addDangerToast,
}) => {
  const [owners, setOwners] = useState<(typeof Owners)[]>([]);

  const resourceLabelPlural = t(
    '%s',
    selected.length > 1 ? `${resourceLabel}s` : resourceLabel,
  );

  const loadAccessOptions = useCallback(
    (input = '', page: number, pageSize: number) => {
      const query = rison.encode({
        filter: input,
        page,
        page_size: pageSize,
      });
      return SupersetClient.get({
        endpoint: `/api/v1/dashboard/related/owners?q=${query}`,
      }).then(response => ({
        data: response.json.result.map(
          (item: { value: number; text: string }) => ({
            value: item.value,
            label: item.text,
          }),
        ),
        totalCount: response.json.count,
      }));
    },
    [],
  );

  const handleOnChangeOwners = (
    selectedOwners: { value: number; label: string }[],
  ) => {
    const parsedOwners: (typeof Owners)[] = ensureIsArray(selectedOwners).map(
      o => ({
        id: o.value,
        full_name: o.label,
      }),
    );
    setOwners(parsedOwners);
  };

  const handleOwnersSelectValue = () =>
    (owners || []).map((owner: Owner) => ({
      value: owner.id,
      label: getOwnerName(owner),
    }));

  const onSave = async () => {
    if (!owners.length) {
      addDangerToast(t('Please select at least one owner'));
      return;
    }
    Promise.all(
      selected.map(item => {
        const url = `/api/v1/${resourceName}/${item.id}`;
        const payload = {
          owners: owners.map(owner => owner.id),
        };
        return SupersetClient.put({
          url,
          headers: { 'Content-Type': 'application/json' },
          jsonPayload: payload,
        });
      }),
    )
      .then(() => {
        addSuccessToast(
          t('Successfully updated owners for %s', resourceLabelPlural),
        );
      })
      .catch(() => {
        addDangerToast(
          t('Failed to update owners for %s', resourceLabelPlural),
        );
      });
    onHide();
    setOwners([]);
    refreshData();
  };

  return (
    <Modal
      title={<h4>{t('Bulk update owners for %s', resourceLabelPlural)}</h4>}
      show={show}
      onHide={() => {
        setOwners([]);
        onHide();
      }}
      footer={
        <div>
          <Button
            data-test="modal-cancel-update-owners-button"
            buttonStyle="secondary"
            onClick={onHide}
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="modal-save-update-owners-button"
            buttonStyle="primary"
            onClick={onSave}
            disabled={!owners.length}
          >
            {t('Update Owners')}
          </Button>
        </div>
      }
    >
      <Row gutter={16}>
        <div className="bulk-update-owners-text">
          {t(
            'You are updating owners for %s %s',
            selected.length,
            resourceLabelPlural,
          )}
        </div>
      </Row>
      <Row gutter={16}>
        <FormLabel>{t('Owners')}</FormLabel>
        <AsyncSelect
          allowClear
          ariaLabel={t('Owners')}
          mode="multiple"
          onChange={handleOnChangeOwners}
          options={loadAccessOptions}
          value={handleOwnersSelectValue()}
          placeholder={t('Search for owners')}
        />
      </Row>
    </Modal>
  );
};

export default BulkUpdateOwnersModal;
