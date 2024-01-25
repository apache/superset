import React from 'react';
import { PanelMsgParams } from '../../types/global';
import { InfoIcon, ColumnWrapper, RowWrapper } from '../index';
import {
  InfoPanelWrapper,
  Alert,
  StyledH4,
  StyledCode,
  StyledP,
} from './styles';

const InfoPanel = ({
  title,
  subTitle,
  body,
  extra,
  children,
  stylesConfig,
}: PanelMsgParams) => (
  <InfoPanelWrapper>
    <Alert stylesConfig={stylesConfig}>
      <RowWrapper>
        {title && (
          <ColumnWrapper classes="col-md-12">
            <div style={{ display: 'flex' }}>
              <InfoIcon color={stylesConfig.colors.primary} />
              <StyledH4>{title || ''}</StyledH4>
            </div>
          </ColumnWrapper>
        )}

        {subTitle && (
          <ColumnWrapper classes="col-md-11">
            <StyledP>{subTitle || ''}</StyledP>
          </ColumnWrapper>
        )}
      </RowWrapper>

      {body && (
        <div style={{ marginTop: '20px' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <StyledP>{body || ''}</StyledP>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      )}

      {children && <div style={{ marginTop: '20px' }}>{children}</div>}

      {extra && (
        <div style={{ marginTop: '20px' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-10">
              <StyledCode>{extra || ''}</StyledCode>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      )}
    </Alert>
  </InfoPanelWrapper>
);

export { InfoPanel };
