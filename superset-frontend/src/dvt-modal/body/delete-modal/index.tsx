import React, { useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import { ModalProps } from 'src/dvt-modal';
import useFetch from 'src/hooks/useFetch';
import DvtButton from 'src/components/DvtButton';
import DvtInput from 'src/components/DvtInput';
import {
  StyledDeleteModal,
  StyledDeleteModalHeader,
  StyledDeleteModalBody,
  StyledDeleteModalLabel,
  StyledDeleteModalButton,
} from './delete-modal.module';

const DvtDeleteModal = ({ meta, onClose }: ModalProps) => {
  const item = meta.item.id;
  const types = meta.type;

  const handleDelete = async () => {
    try {
      await fetch(`/api/v1/${types}/${item}`, { method: 'DELETE' });
      onClose();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <StyledDeleteModal>
      <StyledDeleteModalHeader>{t('Please confirm')}</StyledDeleteModalHeader>
      <StyledDeleteModalBody>
        <StyledDeleteModalLabel>
          {t('Are you sure you want to delete ?')}
        </StyledDeleteModalLabel>
        <StyledDeleteModalButton>
          <DvtButton
            label={t('DELETE')}
            colour="error"
            onClick={handleDelete}
            size="small"
            bold
          />
          <DvtButton
            bold
            colour="grayscale"
            label={t('CANCEL')}
            onClick={onClose}
            size="small"
          />
        </StyledDeleteModalButton>
      </StyledDeleteModalBody>
    </StyledDeleteModal>
  );
};

export default DvtDeleteModal;
