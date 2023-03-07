import { hot } from 'react-hot-loader/root';
import React from 'react';

// Messages
import { RULES_RU, UPGRADE_2_0_RU } from 'src/Superstructure/messages';

import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  WarningPanel,
  WarningPanelInner,
  InfoPanel,
  InfoPanelInner,
} from 'src/Superstructure/components';

import { IPanelMsgObj } from 'src/Superstructure/types/global';

const AnalyticsMain = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll && dodoElementAll.classList.contains('overwrite-height')) {
    dodoElementAll.classList.remove('overwrite-height');
  }

  const InfoMessageObj: IPanelMsgObj = RULES_RU;
  const WarningMessageObj: IPanelMsgObj = UPGRADE_2_0_RU;

  return (
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
        <div style={{ marginTop: '20px' }}>
          <WarningPanel
            title={WarningMessageObj.title}
            subTitle={WarningMessageObj.date}
            extra={WarningMessageObj.extra}
          >
            <WarningPanelInner msgObj={WarningMessageObj} />
          </WarningPanel>
        </div>
      </ColumnWrapper>
    </RowWrapper>
  );
};

export default hot(AnalyticsMain);
