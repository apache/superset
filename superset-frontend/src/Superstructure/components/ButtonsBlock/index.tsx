import React from 'react';
import { IPanelMsgObj } from '../../types/global';
import { ButtonsWrapper } from './styles';

const ButtonsBlock = ({ btnsInfo }: { btnsInfo: IPanelMsgObj['buttons'] }) => (
  <div>
    {btnsInfo && (
      <ButtonsWrapper>
        {btnsInfo?.map((btn, key) => (
          <a
            key={key}
            href={btn.link}
            className={`btn btn-sm ${btn.class} ${key}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginRight: key !== btnsInfo.length - 1 ? '20px' : '0' }}
          >
            {btn.txt}
          </a>
        ))}
      </ButtonsWrapper>
    )}
  </div>
);

export { ButtonsBlock };
