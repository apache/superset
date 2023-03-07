import { hot } from 'react-hot-loader/root';
import React from 'react';

// Messages
import { RULES_RU, UPGRADE_2_0_RU } from 'src/Superstructure/messages';

import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  WarningPanel,
  InfoPanel,
} from 'src/Superstructure/components';

interface IWarningMsgObj {
  title: string;
  subTitle: string;
  listTitle?: string;
  listTitleExtra?: string;
  messages?: string[];
  messagesExtra?: string[];
  date: string;
}

const AnalyticsMain = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll && dodoElementAll.classList.contains('overwrite-height')) {
    dodoElementAll.classList.remove('overwrite-height');
  }

  const WarningMessageObj: IWarningMsgObj = UPGRADE_2_0_RU;

  return (
    <RowWrapper>
      <ColumnWrapper classes="col-sm-12 col-md-8">
        <InfoPanel
          title={RULES_RU.title}
          body={`${RULES_RU.messages.one} ${RULES_RU.messages.two}`}
          extra={RULES_RU.messages.three}
        >
          <RowWrapper>
            <ColumnWrapper classes="col-md-11 offset-md-1">
              <ButtonsBlock />
            </ColumnWrapper>
          </RowWrapper>
        </InfoPanel>
        <div style={{ marginTop: '20px' }}>
          <WarningPanel
            title={WarningMessageObj.title}
            subTitle={WarningMessageObj.date}
          >
            <RowWrapper>
              <ColumnWrapper classes="col-md-11">
                <i>{WarningMessageObj.subTitle}</i>

                {(WarningMessageObj.listTitle ||
                  WarningMessageObj.messages) && (
                  <div
                    style={{
                      marginTop:
                        WarningMessageObj.listTitle ||
                        WarningMessageObj.messages
                          ? '18px'
                          : '0',
                    }}
                  >
                    {WarningMessageObj.listTitle && (
                      <p>{WarningMessageObj.listTitle}</p>
                    )}
                    {WarningMessageObj.messages && (
                      <ol style={{ paddingLeft: '28px' }}>
                        {WarningMessageObj.messages.map((message, key) => (
                          <li key={key}>{message}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
                {(WarningMessageObj.listTitleExtra ||
                  WarningMessageObj.messagesExtra) && (
                  <div
                    style={{
                      marginTop:
                        WarningMessageObj.listTitleExtra ||
                        WarningMessageObj.messagesExtra
                          ? '18px'
                          : '0',
                    }}
                  >
                    {WarningMessageObj.listTitleExtra && (
                      <p>{WarningMessageObj.listTitleExtra}</p>
                    )}
                    {WarningMessageObj.messagesExtra && (
                      <ol style={{ paddingLeft: '28px' }}>
                        {WarningMessageObj.messagesExtra.map((message, key) => (
                          <li key={key}>{message}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </ColumnWrapper>
            </RowWrapper>
          </WarningPanel>
        </div>
      </ColumnWrapper>
    </RowWrapper>
  );
};

export default hot(AnalyticsMain);
