import { hot } from 'react-hot-loader/root';
import React from 'react';
import {
  ButtonsBlock,
  RowWrapper,
  ColumnWrapper,
  InfoPanel,
  InfoPanelInner,
  WarningPanel,
} from '../index';
import {
  IPanelMsgObj,
  StylesConfig,
  AnnotationMessages,
} from '../../types/global';
import { RULES_RU, RULES_DRINKIT_RU, RULES_DONER42_RU } from '../../messages';
import { Changelog } from './Changelog';

const getColorsFromJson = (json_metadata: string) => {
  if (json_metadata) {
    const { backgroundColor = '#fff3cd', textColor = '#856404' } =
      JSON.parse(json_metadata);
    return { backgroundColor, textColor };
  }
  // eslint-disable-next-line theme-colors/no-literal-colors
  return { backgroundColor: '#fff3cd', textColor: '#856404' };
};

const AnalyticsMain = (props: {
  stylesConfig: StylesConfig;
  annotationMessages: AnnotationMessages;
}) => {
  const { stylesConfig, annotationMessages } = props;
  let InfoMessageObj: IPanelMsgObj = RULES_RU;

  if (stylesConfig.businessId === 'drinkit') InfoMessageObj = RULES_DRINKIT_RU;
  else if (stylesConfig.businessId === 'doner42')
    InfoMessageObj = RULES_DONER42_RU;

  return (
    <div style={{ padding: '12px 0 0 15px' }}>
      {annotationMessages && (
        <RowWrapper>
          <ColumnWrapper classes="col-sm-12 col-md-8">
            {annotationMessages.map(
              message =>
                message &&
                message.data.result && (
                  <div
                    key={message.data.result.id + Math.random()}
                    style={{ margin: '0 0 20px 0' }}
                  >
                    <WarningPanel
                      body={message.data.result.long_descr}
                      colors={getColorsFromJson(
                        message.data.result.json_metadata,
                      )}
                    />
                  </div>
                ),
            )}
          </ColumnWrapper>
        </RowWrapper>
      )}
      <RowWrapper>
        <ColumnWrapper classes="col-sm-12 col-md-8">
          <InfoPanel
            title={InfoMessageObj.title}
            extra={InfoMessageObj.extra}
            stylesConfig={stylesConfig}
          >
            <div>
              <InfoPanelInner msgObj={InfoMessageObj} />
              <RowWrapper>
                <ColumnWrapper classes="col-md-10">
                  <ButtonsBlock
                    stylesConfig={stylesConfig}
                    btnsInfo={InfoMessageObj.buttons}
                  />
                </ColumnWrapper>
              </RowWrapper>
            </div>
          </InfoPanel>
          <div style={{ margin: '20px 0' }}>
            <Changelog />
          </div>
        </ColumnWrapper>
      </RowWrapper>
    </div>
  );
};

export default hot(AnalyticsMain);
