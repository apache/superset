// DODO was here
import {
  ChangeEventHandler,
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useState,
  FC,
} from 'react';

import { t } from '@superset-ui/core';
// import { Input } from 'src/components/Input';
// import { Tooltip } from 'src/components/Tooltip';
// DODO added 44120742
import {
  AdHocMetricTitleEditDisabled,
  InformativeInputs,
  InformativeInputs2,
  SYSTEM_LANGUAGES,
} from 'src/DodoExtensions/AdhocMetricEditPopoverTitle';

// DODO commented out 44120742
// const TitleLabel = styled.span`
//   display: inline-block;
//   padding: 2px 0;
// `;

// DODO commented out 44120742
// const StyledInput = styled(Input)`
//   border-radius: ${({ theme }) => theme.borderRadius};
//   height: 26px;
//   padding-left: ${({ theme }) => theme.gridUnit * 2.5}px;
// `;

export interface AdhocMetricEditPopoverTitleProps {
  title?: {
    label?: string;
    labelRU?: string; // DODO added 44120742
    labelEN?: string; // DODO added 44120742
    hasCustomLabel?: boolean;
  };
  isEditDisabled?: boolean;
  // onChange: ChangeEventHandler<HTMLInputElement>;
  onChangeEN: ChangeEventHandler<HTMLInputElement>; // DODO added 44120742
  onChangeRU: ChangeEventHandler<HTMLInputElement>; // DODO added 44120742
}

const defaultLabelRU = 'Моя метрика';

const AdhocMetricEditPopoverTitle: FC<AdhocMetricEditPopoverTitleProps> = ({
  title,
  isEditDisabled,
  // onChange,
  onChangeEN, // DODO added 44120742
  onChangeRU, // DODO added 44120742
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLang, setEditLang] = useState(SYSTEM_LANGUAGES.en);

  const defaultLabel = t('My metric');

  // DODO added start 44120742
  const handleClick = useCallback((lang: string) => {
    setEditLang(lang);
    setIsEditMode(true);
  }, []);
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

  const handleKeyPressRU = useCallback(
    (ev: KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        handleBlurRU();
      }
    },
    [handleBlurRU],
  );

  const handleInputBlurEN = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        onChangeEN(e);
      }

      handleBlurEN();
    },
    [onChangeEN, handleBlurEN],
  );

  const handleInputBlurRU = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        onChangeRU(e);
      }
      handleBlurRU();
    },
    [onChangeRU, handleBlurRU],
  );
  // DODO added stop 44120742

  if (isEditDisabled) {
    return (
      // <span data-test="AdhocMetricTitle">{title?.label || defaultLabel}</span>
      <AdHocMetricTitleEditDisabled title={title} defaultLabel={defaultLabel} /> // DODO changed 44120742
    );
  }

  // if (isEditMode) {
  //   return (
  //     <StyledInput
  //       type="text"
  //       placeholder={title?.label}
  //       value={title?.hasCustomLabel ? title.label : ''}
  //       autoFocus
  //       onChange={onChange}
  //       onBlur={handleInputBlur}
  //       onKeyPress={handleKeyPress}
  //       data-test="AdhocMetricEditTitle#input"
  //     />
  //   );
  // }
  // DODO changed 44120742
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
    // DODO commented out 44120742
    // <Tooltip placement="top" title={t('Click to edit label')}>
    //   <span
    //     className="AdhocMetricEditPopoverTitle inline-editable"
    //     data-test="AdhocMetricEditTitle#trigger"
    //     onMouseOver={handleMouseOver}
    //     onMouseOut={handleMouseOut}
    //     onClick={handleClick}
    //     onBlur={handleBlur}
    //     role="button"
    //     tabIndex={0}
    //   >
    //     <TitleLabel>{title?.label || defaultLabel}</TitleLabel>
    //     &nbsp;
    //     <i
    //       className="fa fa-pencil"
    //       style={{ color: isHovered ? 'black' : 'grey' }}
    //     />
    //   </span>
    // </Tooltip>
    // DODO added 44120742
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
