import { hot } from 'react-hot-loader/root';
import React from 'react';

import { InfoPanel } from 'src/Superstructure/components';

import { ButtonsBlock, RowWrapper, ColumnWrapper } from 'src/Superstructure/components';

const AnalyticsMain = () => {
  // In dodois the div.all has css property min-height, that forces the footer to be overlapped
  const dodoElementAll = document.getElementsByClassName('all')[0];

  if (dodoElementAll && dodoElementAll.classList.contains('overwrite-height')) {
    dodoElementAll.classList.remove('overwrite-height');
  }

  return (
    <RowWrapper>
      <RowWrapper>
        <ColumnWrapper classes="col-sm-12 col-md-8">
          <InfoPanel>
            <RowWrapper>
              <ColumnWrapper classes="col-md-11 offset-md-1">
                <ButtonsBlock />
              </ColumnWrapper>
            </RowWrapper>
          </InfoPanel>
        </ColumnWrapper>
      </RowWrapper>
    </RowWrapper>
  );
};

export default hot(AnalyticsMain);
