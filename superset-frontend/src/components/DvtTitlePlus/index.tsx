import React from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { SupersetTheme } from '@superset-ui/core';
import { StyledDvtTitlePlus, DvtTitlePlusTitle } from './dvt-title-plus.module';

export interface DvtTitlePlusProps {
  title: string;
  plus: boolean;
}

const DvtTitlePlus: React.FC<DvtTitlePlusProps> = ({
  title = '',
  plus = false,
}) => (
  <StyledDvtTitlePlus>
    <DvtTitlePlusTitle>{title}</DvtTitlePlusTitle>
    {plus && (
      <PlusOutlined
        css={(theme: SupersetTheme) => ({
          color: theme.colors.dvt.text.label,
        })}
      />
    )}
  </StyledDvtTitlePlus>
);

export default DvtTitlePlus;
