import React from 'react';
import { Collapse } from 'antd';
import { WarningPanel, WarningPanelInner } from '../index';
import { IPanelMsgObj } from '../../types/global';
import {
  UPGRADE_2_0_RU,
  NEW_FEATURES_APRIL_2023_RU,
  NEW_FEATURES_MAY_2023_RU,
  NEW_FEATURES_JUNE_2023_RU,
  NEW_FEATURES_JULY_2023_RU,
  NEW_FEATURES_AUGUST_2023_RU,
  NEW_FEATURES_NOVEMBER_2023_RU,
} from '../../changelogMessages';

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

export const Changelog = () => (
  <Collapse expandIconPosition="right" accordion>
    {renderCollapse([
      NEW_FEATURES_NOVEMBER_2023_RU,
      NEW_FEATURES_AUGUST_2023_RU,
      NEW_FEATURES_JULY_2023_RU,
      NEW_FEATURES_JUNE_2023_RU,
      NEW_FEATURES_MAY_2023_RU,
      NEW_FEATURES_APRIL_2023_RU,
      UPGRADE_2_0_RU,
    ])}
  </Collapse>
);
