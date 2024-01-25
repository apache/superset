import React from 'react';
import { InfoIcon, ColumnWrapper, RowWrapper } from '../index';
import { UNAVAILABLE } from '../../messages';
import { ServiceNotAvailableWrapper, Alert, StyledH4, StyledP } from './styles';

const ServiceNotAvailable = () => (
  <ServiceNotAvailableWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#1b1e21" />
        </ColumnWrapper>
        <ColumnWrapper classes="col-md-11">
          <StyledH4>{UNAVAILABLE.header}</StyledH4>
        </ColumnWrapper>
      </RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-md-11 offset-md-1">
          <StyledP>{UNAVAILABLE.body}</StyledP>
          <StyledP>{UNAVAILABLE.bodyRu}</StyledP>
        </ColumnWrapper>
      </RowWrapper>
    </Alert>
  </ServiceNotAvailableWrapper>
);

export { ServiceNotAvailable };
