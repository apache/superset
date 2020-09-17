import React from 'react';
import {
  SearchOutlined,
  MinusCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Collapse } from '../../../common/components/index';
import S from './Styles';
import { APPLIED, INCOMPATIBLE, UNSET } from './selectors';

export type Indicator = {
  id: string;
  name: string;
  value: string[];
  status: typeof APPLIED | typeof UNSET | typeof INCOMPATIBLE;
  path: string;
};

export interface IndicatorProps {
  indicator: Indicator;
  onClick: (path: string) => void;
}

const Indicator = ({
  indicator: { name, value = [], path },
  onClick,
}: IndicatorProps) => (
  <S.Item onClick={() => onClick(path)}>
    <S.ItemIcon>
      <SearchOutlined />
    </S.ItemIcon>
    <S.Title bold>{name.toUpperCase()}</S.Title>
    {value.length ? `: ${value.join(', ')}` : ''}
  </S.Item>
);

export interface DetailsPanelProps {
  appliedIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  unsetIndicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
}

const DetailsPanel = ({
  appliedIndicators = [],
  incompatibleIndicators = [],
  unsetIndicators = [],
  onHighlightFilterSource,
}: DetailsPanelProps) => {
  const total =
    appliedIndicators.length +
    incompatibleIndicators.length +
    unsetIndicators.length;
  return (
    <S.Panel>
      <div>{`${total} Scoped Filters`}</div>
      <S.Reset>
        <Collapse ghost defaultActiveKey={['applied', 'incompatible']}>
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
