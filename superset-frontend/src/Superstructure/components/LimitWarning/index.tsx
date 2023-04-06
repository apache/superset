import React from 'react';
import { InfoIcon, ColumnWrapper, RowWrapper } from '../index';
import { LIMIT_WARNING_HEADER, LIMIT_WARNING_BODY } from '../../messages';
import { LimitWarningWrapper, Alert, StyledH4, StyledP } from './styles';

const LimitWarning = ({ limit }: { limit: Number }) => (
  <LimitWarningWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#856404" />
        </ColumnWrapper>
        <ColumnWrapper classes="col-md-11">
          <StyledH4>{LIMIT_WARNING_HEADER}</StyledH4>
        </ColumnWrapper>
      </RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-md-11 offset-md-1">
          <StyledP>
            {LIMIT_WARNING_BODY} <b>{limit}</b>
          </StyledP>
        </ColumnWrapper>
      </RowWrapper>
    </Alert>
  </LimitWarningWrapper>
);

export { LimitWarning };
