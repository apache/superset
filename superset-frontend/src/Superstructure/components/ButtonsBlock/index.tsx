import React from 'react';

import {
  DODOPIZZA_ANALYTICS_URL,
  DODOPIZZA_KNOWLEDGEBASE_URL,
} from 'src/Superstructure/constants';

import { GO_TO_ANALYTICS_BTN, RULES_BTN } from 'src/Superstructure/messages';

import { ButtonsWrapper } from './styles';

const ButtonsBlock = () => (
  <ButtonsWrapper>
    <a
      href={DODOPIZZA_ANALYTICS_URL}
      className="btn btn-info btn-sm"
      target="_blank"
      rel="noreferrer"
      style={{ marginRight: '20px' }}
    >
      {GO_TO_ANALYTICS_BTN}
    </a>
    <a
      className="btn btn-warning btn-sm"
      href={DODOPIZZA_KNOWLEDGEBASE_URL}
      target="_blank"
      rel="noreferrer"
    >
      {RULES_BTN}
    </a>
  </ButtonsWrapper>
);

export { ButtonsBlock };
