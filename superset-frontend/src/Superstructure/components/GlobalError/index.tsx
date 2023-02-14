import React from 'react';
import { GlobalErrorWrapper, Alert, StyledH4, StyledCode, StyledP } from './styles';

import { ErrorParams } from 'src/Superstructure/types/global';
import { InfoIcon, ColumnWrapper, RowWrapper } from 'src/Superstructure/components';

import { GLOBAL_WARNING_DEFAULT_HEADER, GLOBAL_WARNING_DEFAULT_BODY } from 'src/Superstructure/messages';

const GlobalError = ({ title, body, stackTrace }: ErrorParams) => (
  <GlobalErrorWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#721c24" />
        </ColumnWrapper>
        <ColumnWrapper classes="col-md-11">
          <StyledH4>{title || GLOBAL_WARNING_DEFAULT_HEADER}</StyledH4>
        </ColumnWrapper>
      </RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-md-11 offset-md-1">
          <StyledP>{body || GLOBAL_WARNING_DEFAULT_BODY}</StyledP>
        </ColumnWrapper>
      </RowWrapper>
      {stackTrace && <div style={{ marginTop: '20px' }}>
        <RowWrapper>
          <ColumnWrapper classes="col-md-8 offset-md-1">
            <StyledCode>{stackTrace}</StyledCode>
          </ColumnWrapper>
        </RowWrapper>
      </div>
      }
    </Alert>
  </GlobalErrorWrapper>
);

export { GlobalError };
