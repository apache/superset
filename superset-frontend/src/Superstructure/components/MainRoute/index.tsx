import { hot } from 'react-hot-loader/root';
import React from 'react';
import { Collapse } from 'antd';
import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  WarningPanel,
  WarningPanelInner,
  InfoPanel,
  InfoPanelInner,
} from '../index';
import { IPanelMsgObj } from '../../types/global';
import {
  RULES_RU,
  UPGRADE_2_0_RU,
  NEW_FEATURES_APRIL_2023_RU,
} from '../../messages';

const AnalyticsMain = () => {
  const InfoMessageObj: IPanelMsgObj = RULES_RU;
  const WarningMessageObj1: IPanelMsgObj = UPGRADE_2_0_RU;
  const WarningMessageObj2: IPanelMsgObj = NEW_FEATURES_APRIL_2023_RU;

  const renderCollapse = (messagesArray: IPanelMsgObj[]) =>
    messagesArray.map((msgObj, index) => (
      <Collapse.Panel
        header={
          <div>
            <h4>{msgObj.title}</h4>
            <p className="helper">{msgObj.date}</p>
          </div>
        }
        key={index}
      >
        <WarningPanel
          title={msgObj.title}
          subTitle={msgObj.date}
          extra={msgObj.extra}
        >
          <WarningPanelInner msgObj={msgObj} />
        </WarningPanel>
      </Collapse.Panel>
    ));

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
            <Collapse expandIconPosition="right" accordion>
              {renderCollapse([WarningMessageObj2, WarningMessageObj1])}
            </Collapse>
          </div>
        </ColumnWrapper>
      </RowWrapper>
    </div>
  );
};

export default hot(AnalyticsMain);
