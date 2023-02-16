import React from 'react';

import {
  DODOPIZZA_ANALYTICS_URL,
  DODOPIZZA_KNOWLEDGEBASE_URL,
} from 'src/Superstructure/constants';

import { RULES_RU } from 'src/Superstructure/messages';

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
      {RULES_RU.btnAnalyticsText}
    </a>
    <a
      className="btn btn-warning btn-sm"
      href={DODOPIZZA_KNOWLEDGEBASE_URL}
      target="_blank"
      rel="noreferrer"
    >
      {RULES_RU.btnRulesText}
    </a>
  </ButtonsWrapper>
);

export { ButtonsBlock };
