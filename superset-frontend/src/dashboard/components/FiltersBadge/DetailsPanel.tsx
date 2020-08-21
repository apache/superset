import React from 'react';
import { Collapse } from '../../../common/components/index';
import { SearchOutlined, MinusCircleFilled, CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import S from './Styles';

const Indicator = ({ indicator: { name, value = [], path }, onClick }) => (
  <S.Item onClick={() => onClick(path)}>
    <S.ItemIcon>
      <SearchOutlined />
    </S.ItemIcon>
    <S.Title bold>{name.toUpperCase()}</S.Title>
    {value.length ? `: ${[].concat(value).join(', ')}` : ''}
  </S.Item>
);

const DetailsPanel = ({
  appliedIndicators = [],
  incompatibleIndicators = [],
  unsetIndicators = [],
  onHighlightFilterSource,
}) => {
  const total = appliedIndicators.length + incompatibleIndicators.length + unsetIndicators.length;
  return (
    <S.Panel>
      <div>{`${total} Scoped Filters`}</div>
      <S.Reset>
        <Collapse
          ghost
          defaultActiveKey={['applied', 'incompatible']}
        >
          {appliedIndicators.length ? (
            <Collapse.Panel
              key="applied"
              header={
                <S.Title color="#59C189">
                  <CheckCircleFilled />
                  {` Applied (${appliedIndicators.length})`}
                </S.Title>
              }
            >
              <S.Indent>
                {appliedIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
                    indicator={indicator}
                    onClick={onHighlightFilterSource}
                  />
                ))}
              </S.Indent>
            </Collapse.Panel>
          ) : null}
          {incompatibleIndicators.length ? (
            <Collapse.Panel
              key="incompatible"
              header={
                <S.Title color="#FBC700">
                  <ExclamationCircleFilled />
                  {` Incompatible (${incompatibleIndicators.length})`}
                </S.Title>
              }
            >
              <S.Indent>
                {incompatibleIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
                    indicator={indicator}
                    onClick={onHighlightFilterSource}
                  />
                ))}
              </S.Indent>
            </Collapse.Panel>
          ) : null}
          <Collapse.Panel
            key="unset"
            header={
              <S.Title color="#B2B2B2">
                <MinusCircleFilled />
                {` Unset (${unsetIndicators.length})`}
              </S.Title>
            }
            disabled={!unsetIndicators.length}
          >
            <S.Indent>
              {unsetIndicators.map(indicator => (
                <Indicator
                  key={indicator.id}
                  indicator={indicator}
                  onClick={onHighlightFilterSource}
                />
              ))}
            </S.Indent>
          </Collapse.Panel>
        </Collapse>
      </S.Reset>
    </S.Panel>
  );
};

export default DetailsPanel;