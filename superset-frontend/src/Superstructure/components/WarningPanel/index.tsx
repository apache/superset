import React from 'react';
import { WarningPanelWrapper, Alert, StyledH4, StyledCode, StyledP } from './styles';

import { PanelMsgParams } from 'src/Superstructure/types/global';
import { InfoIcon, ColumnWrapper, RowWrapper } from 'src/Superstructure/components';

const WarningPanel = ({ title, subTitle, body, extra, children }: PanelMsgParams) => (
  <WarningPanelWrapper>
    <Alert>
      <RowWrapper>
        <ColumnWrapper classes="col-md-1 tinycolumn">
          <InfoIcon color="#856404" />
        </ColumnWrapper>

        {title &&
          <ColumnWrapper classes="col-md-11">
            <StyledH4>{title || ''}</StyledH4>
          </ColumnWrapper>
        }

        {subTitle &&
          <ColumnWrapper classes="col-md-11">
            <StyledP>{subTitle || ''}</StyledP>
          </ColumnWrapper>
        }
      </RowWrapper>

      {body &&
        <div style={{ marginTop: '20px' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <StyledP>{body || ''}</StyledP>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      }

      {children &&
        <div style={{ marginTop: '20px' }}>
          {children}
        </div>
      }

      {extra &&
        <div style={{ marginTop: '20px' }}>
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <StyledCode>{extra || ''}</StyledCode>
            </ColumnWrapper>
          </RowWrapper>
        </div>
      }

    </Alert>
  </WarningPanelWrapper>
);

export { WarningPanel };
