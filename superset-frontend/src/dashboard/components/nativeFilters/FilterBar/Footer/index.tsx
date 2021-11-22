import { styled, t } from '@superset-ui/core';
import React, { FC } from 'react';
import Button from 'src/components/Button';
import { DataMaskState, DataMaskStateWithId } from 'src/dataMask/types';

type FooterProps = {
  onApply: () => void;
  onClearAll: () => void;
  getFilterBarTestId: (id: string) => {};
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  isApplyDisabled: boolean;
};

const ActionButtons = styled.div`
  display: flex;
  flex: 1;
  justify-content: flex-end;
  padding: 5px;
`;

const Footer: FC<FooterProps> = ({
  onApply,
  onClearAll,
  getFilterBarTestId,
  isApplyDisabled,
  dataMaskApplied,
  dataMaskSelected,
}) => {
  const isClearAllDisabled = Object.values(dataMaskApplied).every(
    filter =>
      dataMaskSelected[filter.id]?.filterState?.value === null ||
      (!dataMaskSelected[filter.id] && filter.filterState?.value === null),
  );

  return (
    <ActionButtons>
      <Button
        disabled={isClearAllDisabled}
        buttonStyle="link"
        buttonSize="small"
        isUppercase={false}
        onClick={onClearAll}
        {...getFilterBarTestId('clear-button')}
      >
        {t('Clear all')}
      </Button>
      <Button
        disabled={isApplyDisabled}
        buttonStyle="primary"
        htmlType="submit"
        buttonSize="small"
        onClick={onApply}
        {...getFilterBarTestId('apply-button')}
      >
        {t('Apply')}
      </Button>
    </ActionButtons>
  );
};

export default Footer;
