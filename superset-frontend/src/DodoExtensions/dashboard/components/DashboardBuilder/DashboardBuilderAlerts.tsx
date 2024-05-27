// DODO added #34037254

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@superset-ui/core';
import { SingleAnnotation } from '../../../../Superstructure/types/global';
import { loadAnnotationMessages } from '../../../utils/annotationUtils';
import { WarningPanel } from '../../../components';

/* TODO: добавить возможность закрыть каждый месседж, хранить в стейте */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-right: 32px;
  row-gap: 12px;
`;

const useAlertsMessages = () => {
  const [annotationMessages, setAnnotationMessages] = useState<
    Array<SingleAnnotation & { closed?: boolean }>
  >([]);

  useEffect(() => {
    loadAnnotationMessages().then(result => setAnnotationMessages(result));
  }, []);

  const openMessages = useMemo(
    () => annotationMessages.filter(item => !item.closed),
    [annotationMessages],
  );

  const setClose = useCallback((id: number) => {
    setAnnotationMessages(value =>
      value.map(item => {
        if (item.id === id) {
          return { ...item, closed: true };
        }
        return item;
      }),
    );
  }, []);

  const getColorsFromJson = (json_metadata: string) => {
    if (json_metadata) {
      const { backgroundColor = '#fff3cd', textColor = '#856404' } =
        JSON.parse(json_metadata);
      return { backgroundColor, textColor };
    }
    // eslint-disable-next-line theme-colors/no-literal-colors
    return { backgroundColor: '#fff3cd', textColor: '#856404' };
  };

  const alerts = useMemo(
    () => (
      <>
        {openMessages.length > 0 && (
          <Wrapper>
            {openMessages.map(message => (
              <WarningPanel
                key={message.id}
                body={message.long_descr}
                colors={getColorsFromJson(message.json_metadata)}
                onClose={() => setClose(message.id)}
              />
            ))}
          </Wrapper>
        )}
      </>
    ),
    [annotationMessages],
  );

  return {
    alerts,
  };
};

export { useAlertsMessages };
