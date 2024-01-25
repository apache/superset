import React from 'react';
import { RowWrapper, ColumnWrapper } from '../index';
import { IPanelMsgObj } from '../../types/global';

const InfoPanelInner = ({ msgObj }: { msgObj: IPanelMsgObj }) => (
  <RowWrapper>
    <ColumnWrapper classes="col-md-11">
      <i>{msgObj.subTitle}</i>

      {(msgObj.listTitle || msgObj.messages) && (
        <div
          style={{
            marginTop: msgObj.listTitle || msgObj.messages ? '18px' : '0',
          }}
        >
          {msgObj.listTitle && <p>{msgObj.listTitle}</p>}
          {msgObj.messages && (
            <ol style={{ paddingLeft: '28px' }}>
              {msgObj.messages.map((message, key) => (
                <li key={key}>{message}</li>
              ))}
            </ol>
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
            <ol style={{ paddingLeft: '28px' }}>
              {msgObj.messagesExtra.map((message, key) => (
                <li key={key}>{message}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </ColumnWrapper>
  </RowWrapper>
);

export { InfoPanelInner };
