// DODO was here

import React, {
  ChangeEventHandler,
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useState,
} from 'react';
import { t } from '@superset-ui/core';
import {
  AdHocMetricTitleEditDisabled,
  InformativeInputs,
  InformativeInputs2,
  SYSTEM_LANGUAGES,
} from 'src/DodoExtensions/AdhocMetricEditPopoverTitle';

export interface AdhocMetricEditPopoverTitleProps {
  title?: {
    label?: string;
    labelRU?: string;
    labelEN?: string;
    hasCustomLabel?: boolean;
  };
  isEditDisabled?: boolean;
  // onChange: ChangeEventHandler<HTMLInputElement>;
  onChangeEN: ChangeEventHandler<HTMLInputElement>;
  onChangeRU: ChangeEventHandler<HTMLInputElement>;
}

// DODO changed
const AdhocMetricEditPopoverTitle: React.FC<AdhocMetricEditPopoverTitleProps> =
  ({ title, isEditDisabled, /* onChange, */ onChangeEN, onChangeRU }) => {
    const [isEditMode, setIsEditMode] = useState(false);
    const [editLang, setEditLang] = useState(SYSTEM_LANGUAGES.en);

    const defaultLabel = t('My metric');
    // DODO added
    const defaultLabelRU = t('Моя метрика');

    // DODO added
    const handleClick = useCallback((lang: string) => {
      setEditLang(lang);
      setIsEditMode(true);
    }, []);

    // DODO added
    const handleBlurEN = useCallback(() => setIsEditMode(false), []);
    const handleBlurRU = useCallback(() => setIsEditMode(false), []);

    const handleKeyPressEN = useCallback(
      (ev: KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          handleBlurEN();
        }
      },
      [handleBlurEN],
    );

    // DODO added
    const handleKeyPressRU = useCallback(
      (ev: KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          handleBlurRU();
        }
      },
      [handleBlurRU],
    );

    // DODO added
    const handleInputBlurEN = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '') {
          onChangeEN(e);
        }

        handleBlurEN();
      },
      [onChangeEN, handleBlurEN],
    );

    // DODO added
    const handleInputBlurRU = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '') {
          onChangeRU(e);
        }

        handleBlurRU();
      },
      [onChangeRU, handleBlurRU],
    );

    if (isEditDisabled) {
      return (
        <AdHocMetricTitleEditDisabled
          title={title}
          defaultLabel={defaultLabel}
        />
      );
    }

    // DODO added
    if (isEditMode && editLang) {
      return (
        <InformativeInputs
          editLang={editLang}
          title={title}
          defaultLabel={defaultLabel}
          onChangeEN={onChangeEN}
          handleInputBlurEN={handleInputBlurEN}
          handleKeyPressEN={handleKeyPressEN}
          defaultLabelRU={defaultLabelRU}
          onChangeRU={onChangeRU}
          handleInputBlurRU={handleInputBlurRU}
          handleKeyPressRU={handleKeyPressRU}
        />
      );
    }

    return (
      <InformativeInputs2
        title={title}
        defaultLabel={defaultLabel}
        defaultLabelRU={defaultLabelRU}
        handleClick={handleClick}
        handleBlurEN={handleBlurEN}
        handleBlurRU={handleBlurRU}
      />
    );
  };

export default AdhocMetricEditPopoverTitle;
