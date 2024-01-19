// DODO was here
import React, { useMemo, useRef } from 'react';
import { t, useTruncation } from '@superset-ui/core';
import { useFilterScope } from './useFilterScope';
import {
  Row,
  RowLabel,
  RowTruncationCount,
  RowValue,
  TooltipList,
  TooltipSectionLabel,
} from './Styles';
import { FilterCardRowProps } from './types';
import { TooltipWithTruncation } from './TooltipWithTruncation';

const getTooltipSection = (items: string[] | undefined, label: string) =>
  Array.isArray(items) && items.length > 0 ? (
    <>
      <TooltipSectionLabel>{label}:</TooltipSectionLabel>
      <TooltipList>
        {items.map((item, key) => (
          // DODO added
          <li key={key}>{item}</li>
        ))}
      </TooltipList>
    </>
  ) : null;

export const ScopeRow = React.memo(({ filter }: FilterCardRowProps) => {
  const scope = useFilterScope(filter);
  const scopeRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  const [elementsTruncated, hasHiddenElements] = useTruncation(
    scopeRef,
    plusRef,
  );
  const tooltipText = useMemo(() => {
    if (elementsTruncated === 0 || !scope) {
      return null;
    }
    if (scope.all) {
      return <span>{t('All charts')}</span>;
    }
    return (
      <div>
        {getTooltipSection(scope.tabs, t('Tabs'))}
        {getTooltipSection(scope.charts, t('Charts'))}
      </div>
    );
  }, [elementsTruncated, scope]);

  return (
    <Row>
      <RowLabel>{t('Scope')}</RowLabel>
      <TooltipWithTruncation title={tooltipText}>
        <RowValue ref={scopeRef}>
          {scope
            ? Object.values(scope)
                .flat()
                .map((element, index) => (
                  <span key={element}>
                    {index === 0 ? element : `, ${element}`}
                  </span>
                ))
            : t('None')}
        </RowValue>
        {hasHiddenElements > 0 && (
          <RowTruncationCount ref={plusRef}>
            +{elementsTruncated}
          </RowTruncationCount>
        )}
      </TooltipWithTruncation>
    </Row>
  );
});
