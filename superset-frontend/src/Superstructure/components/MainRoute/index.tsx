import { hot } from 'react-hot-loader/root';
import React from 'react';
import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  InfoPanel,
  InfoPanelInner,
} from '../index';
import { IPanelMsgObj } from '../../types/global';
import { RULES_RU } from '../../messages';
import { Changelog } from './Changelog';

const AnalyticsMain = () => {
  const InfoMessageObj: IPanelMsgObj = RULES_RU;

  return (
    <div style={{ padding: '12px 0 0 15px' }}>
      <RowWrapper>
        <ColumnWrapper classes="col-sm-12 col-md-8">
          <InfoPanel title={InfoMessageObj.title} extra={InfoMessageObj.extra}>
            <div>
              <InfoPanelInner msgObj={InfoMessageObj} />
              <RowWrapper>
                <ColumnWrapper classes="col-md-11 offset-md-1">
                  <ButtonsBlock btnsInfo={InfoMessageObj.buttons} />
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
