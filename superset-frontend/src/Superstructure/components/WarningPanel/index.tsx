import React from 'react';
import { WarningMsgParams } from '../../types/global';
import { InfoIcon, ColumnWrapper, RowWrapper } from '../index';

import {
  WarningPanelWrapper,
  Alert,
  StyledH4,
  StyledCode,
  StyledP,
} from './styles';

const WarningPanel = ({
  title,
  subTitle,
  body,
  extra,
  children,
  colors,
}: WarningMsgParams) => (
  <WarningPanelWrapper>
    <Alert style={{ backgroundColor: colors?.backgroundColor || '#fff3cd' }}>
      <RowWrapper>
        {title && (
          <div>
            <ColumnWrapper classes="col-md-1 tinycolumn">
              <InfoIcon color={colors?.textColor || '#856404'} />
            </ColumnWrapper>
            <ColumnWrapper classes="col-md-11">
              <StyledH4 style={{ color: colors?.textColor || '#856404' }}>
                {title || ''}
              </StyledH4>
            </ColumnWrapper>
          </div>
        )}

        {subTitle && (
          <ColumnWrapper classes="col-md-11">
            <StyledP style={{ color: colors?.textColor || '#856404' }}>
              {subTitle || ''}
            </StyledP>
          </ColumnWrapper>
        )}
      </RowWrapper>

      {body && (
        <div style={{ marginTop: title ? '20px 0' : '0 0 20px 0' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <StyledP style={{ color: colors?.textColor || '#856404' }}>
                {body || ''}
              </StyledP>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      )}

      {children && <div style={{ marginTop: '20px' }}>{children}</div>}

      {extra && (
        <div style={{ marginTop: '20px' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <StyledCode>{extra || ''}</StyledCode>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      )}
    </Alert>
  </WarningPanelWrapper>
);

export { WarningPanel };
