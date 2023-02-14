import React from 'react';
import { ServiceNotAvailableWrapper, Alert, StyledH4, StyledP } from './styles';

import { InfoIcon, ColumnWrapper, RowWrapper } from 'src/Superstructure/components';

import { UNAVAILABLE_HEADER, UNAVAILABLE_BODY, UNAVAILABLE_BODY_RU } from 'src/Superstructure/messages';

const ServiceNotAvailable = () => (
  <ServiceNotAvailableWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#1b1e21" />
        </ColumnWrapper>
        <ColumnWrapper classes="col-md-11">
          <StyledH4>{UNAVAILABLE_HEADER}</StyledH4>
        </ColumnWrapper>
      </RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-md-11 offset-md-1">
          <StyledP>{UNAVAILABLE_BODY}</StyledP>
          <StyledP>{UNAVAILABLE_BODY_RU}</StyledP>
        </ColumnWrapper>
      </RowWrapper>
    </Alert>
  </ServiceNotAvailableWrapper>
);

export { ServiceNotAvailable };
