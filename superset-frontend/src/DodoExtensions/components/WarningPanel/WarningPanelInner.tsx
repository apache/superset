import React from 'react';

import { RowWrapper } from '../Wrappers/RowWrapper';
import { ColumnWrapper } from '../Wrappers/ColumnWrapper';
import { IPanelMsgObj } from '../../global';

const WarningPanelInner = ({ msgObj }: { msgObj: IPanelMsgObj }) => (
  <RowWrapper>
    <ColumnWrapper classes="col-md-11">
      <i>{msgObj.subTitle}</i>

      {(msgObj.listTitle || msgObj.releases?.length) && (
        <div
          style={{
            marginTop:
              msgObj.listTitle || msgObj.releases?.length ? '18px' : '0',
          }}
        >
          {msgObj.listTitle && <p>{msgObj.listTitle}</p>}

          {msgObj.releases?.length && (
            <ul style={{ paddingLeft: '28px' }}>
              {msgObj.releases.map((release, key) => (
                <div style={{ marginBottom: '20px' }}>
                  <li key={key}>
                    <b>{release.date}</b> <i>({release.status})</i>
                  </li>
                  {release.messages?.length && (
                    <ol>
                      {release.messages.map((message, key) => (
                        <li key={key}>{message}</li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </ul>
          )}
        </div>
      )}
      {(msgObj.listTitleExtra || msgObj.messagesExtra) && (
        <div
          style={{
            marginTop:
              msgObj.listTitleExtra || msgObj.messagesExtra ? '18px' : '0',
          }}
        >
          {msgObj.listTitleExtra && <p>{msgObj.listTitleExtra}</p>}
          {msgObj.messagesExtra && (
            <ul style={{ paddingLeft: '28px' }}>
              {msgObj.messagesExtra.map((message, key) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ColumnWrapper>
  </RowWrapper>
);

export { WarningPanelInner };
