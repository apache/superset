import React from 'react';
import { InfoPanelWrapper, Alert, StyledH4, StyledCode, StyledP } from './styles';

import { PanelMsgParams } from 'src/Superstructure/types/global';
import { InfoIcon, ColumnWrapper, RowWrapper } from 'src/Superstructure/components';

import { RULES_TITLE, RULES_DESSCRIPTION, RULES_ATTENTION } from 'src/Superstructure/messages';

const InfoPanel = ({ title, body, children }: PanelMsgParams) => (
  <InfoPanelWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#004085" />
        </ColumnWrapper>
        <ColumnWrapper classes="col-md-11">
          <StyledH4>{title || RULES_TITLE}</StyledH4>
        </ColumnWrapper>
      </RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-md-11 offset-md-1">
          <StyledP>{body || RULES_DESSCRIPTION}</StyledP>
        </ColumnWrapper>
      </RowWrapper>
      <div style={{ marginTop: '20px' }}>
        <RowWrapper>
          <ColumnWrapper classes="col-md-11 offset-md-1">
            <StyledCode>{RULES_ATTENTION}</StyledCode>
          </ColumnWrapper>
        </RowWrapper>
      </div>
      {children}
    </Alert>
  </InfoPanelWrapper>
);

export { InfoPanel };
