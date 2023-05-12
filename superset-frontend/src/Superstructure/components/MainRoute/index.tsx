import { hot } from 'react-hot-loader/root';
import React from 'react';
import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  InfoPanel,
  InfoPanelInner,
} from '../index';
import { IPanelMsgObj, StylesConfig } from '../../types/global';
import { RULES_RU, RULES_DRINKIT_RU, RULES_DONER42_RU } from '../../messages';
import { Changelog } from './Changelog';

const AnalyticsMain = (props: { stylesConfig: StylesConfig }) => {
  const { stylesConfig } = props;
  let InfoMessageObj: IPanelMsgObj = RULES_RU;

  if (stylesConfig.businessId === 'drinkit') InfoMessageObj = RULES_DRINKIT_RU;
  else if (stylesConfig.businessId === 'doner42')
    InfoMessageObj = RULES_DONER42_RU;

  return (
    <div style={{ padding: '12px 0 0 15px' }}>
      <RowWrapper>
        <ColumnWrapper classes="col-sm-12 col-md-8">
          <InfoPanel
            title={InfoMessageObj.title}
            extra={InfoMessageObj.extra}
            stylesConfig={stylesConfig}
          >
            <div>
              <InfoPanelInner msgObj={InfoMessageObj} />
              <RowWrapper>
                <ColumnWrapper classes="col-md-11 offset-md-1">
                  <ButtonsBlock
                    stylesConfig={stylesConfig}
                    btnsInfo={InfoMessageObj.buttons}
                  />
                </ColumnWrapper>
              </RowWrapper>
            </div>
          </InfoPanel>
          <div style={{ margin: '20px 0' }}>
            <Changelog />
          </div>
        </ColumnWrapper>
      </RowWrapper>
    </div>
  );
};

export default hot(AnalyticsMain);
