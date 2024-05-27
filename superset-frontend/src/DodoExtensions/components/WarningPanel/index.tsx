// DODO was here
// DODO added all file

import React from 'react';

import {
  WarningPanelWrapper,
  Alert,
  StyledH4,
  StyledCode,
  StyledP,
  StyledButton,
} from './styles';
import Icon from '../../../components/Icons/Icon';
import { WarningMsgParams } from '../../global';
import { RowWrapper } from '../Wrappers/RowWrapper';
import { ColumnWrapper } from '../Wrappers/ColumnWrapper';
import { InfoIcon } from '../InfoIcon';

const WarningPanel = ({
  title,
  subTitle,
  body,
  extra,
  children,
  colors,
  onClose,
}: WarningMsgParams) => (
  <WarningPanelWrapper backgroundColor={colors?.backgroundColor || '#fff3cd'}>
    <Alert>
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
            <StyledP color={colors?.textColor || '#856404'}>
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

    {onClose && (
      <StyledButton buttonStyle="link" onClick={onClose}>
        <Icon fileName="cancel-x" />
      </StyledButton>
    )}
  </WarningPanelWrapper>
);

export { WarningPanel };
