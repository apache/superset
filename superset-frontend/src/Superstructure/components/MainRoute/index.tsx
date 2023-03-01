import { hot } from 'react-hot-loader/root';
import React from 'react';

// Messages
import { RULES_RU, CSV_TEMP_PROBLEM_RU } from 'src/Superstructure/messages';

import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  WarningPanel,
  InfoPanel,
} from 'src/Superstructure/components';

const AnalyticsMain = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll && dodoElementAll.classList.contains('overwrite-height')) {
    dodoElementAll.classList.remove('overwrite-height');
  }

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
            title={CSV_TEMP_PROBLEM_RU.title}
            subTitle={CSV_TEMP_PROBLEM_RU.date}
          >
            <RowWrapper>
              <ColumnWrapper classes="col-md-11">
                <p>{CSV_TEMP_PROBLEM_RU.subTitle}</p>
                <ol style={{ paddingLeft: '28px' }}>
                  <li>{CSV_TEMP_PROBLEM_RU.message1}</li>
                  <li>{CSV_TEMP_PROBLEM_RU.message2}</li>
                  <li>{CSV_TEMP_PROBLEM_RU.message3}</li>
                </ol>
              </ColumnWrapper>
            </RowWrapper>
          </WarningPanel>
        </div>
      </ColumnWrapper>
    </RowWrapper>
  );
};

export default hot(AnalyticsMain);
