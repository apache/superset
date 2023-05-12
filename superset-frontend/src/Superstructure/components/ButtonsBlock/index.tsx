import React from 'react';
import { IPanelMsgObj, StylesConfig } from '../../types/global';
import { ButtonsWrapper, Button } from './styles';

const ButtonsBlock = ({
  btnsInfo,
  stylesConfig,
}: {
  btnsInfo: IPanelMsgObj['buttons'];
  stylesConfig: StylesConfig;
}) => (
  <div>
    {btnsInfo && (
      <ButtonsWrapper>
        {btnsInfo?.map((btn, key) => (
          <Button
            key={key}
            href={btn.link}
            className="btn btn-sm"
            target="_blank"
            rel="noreferrer"
            stylesConfig={stylesConfig}
          >
            {btn.txt}
          </Button>
        ))}
      </ButtonsWrapper>
    )}
  </div>
);

export { ButtonsBlock };
