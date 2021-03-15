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
import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { StyledModal } from '../../../common/components/Modal';
import Button from '../../../components/Button';
import { Form } from '../../../common/components';
import CrossFilterScopingForm from './CrossFilterScopingForm';
import { Scope } from '../nativeFilters/types';
import { CrossFilterScopingFormType } from './types';
import { StyledForm } from '../nativeFilters/FiltersConfigModal/FiltersConfigModal';

type CrossFilterScopingModalProps = {
  chartId: number;
  isOpen: boolean;
  onClose: () => void;
};

const CrossFilterScopingModal: FC<CrossFilterScopingModalProps> = ({
  isOpen,
  chartId,
  onClose,
}) => {
  const [form] = Form.useForm<CrossFilterScopingFormType>();
  const scope = useSelector<any, Scope>(({ charts }) => charts[chartId]?.scope);
  return (
    <StyledModal
      visible={isOpen}
      maskClosable={false}
      title={t('Cross Filter Scoping')}
      width="55%"
      destroyOnClose
      onCancel={onClose}
      onOk={onClose}
      centered
      data-test="cross-filter-scoping-modal"
      footer={
        <>
          <Button
            key="cancel"
            buttonStyle="secondary"
            data-test="cross-filter-scoping-modal-cancel-button"
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            key="submit"
            buttonStyle="primary"
            onClick={onClose}
            data-test="cross-filter-scoping-modal-save-button"
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      <StyledForm preserve={false} form={form} layout="vertical">
        <CrossFilterScopingForm form={form} scope={scope} />
      </StyledForm>
    </StyledModal>
  );
};

export default CrossFilterScopingModal;
