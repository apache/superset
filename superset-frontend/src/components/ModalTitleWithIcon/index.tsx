import { isValidElement, cloneElement } from 'react';
import { css, useTheme, t } from '@superset-ui/core';
import { Typography, Icons } from '@superset-ui/core/components';

type EditModeTitleConfig = {
  /** Indicates whether the component is in edit mode */
  isEditMode: boolean;
  /** Title shown when not in edit mode */
  titleAdd: string;
  /** Title shown when in edit mode */
  titleEdit: string;
};

type ModalTitleWithIconProps = {
  /**
   * Optional configuration for dynamic titles based on edit mode.
   * If provided, it overrides the static `title` prop.
   */
  editModeConfig?: EditModeTitleConfig;

  /**
   * Static title used when `editModeConfig` is not provided.
   */
  title?: string;

  /**
   * Optional icon displayed before the title.
   * If not provided and `editModeConfig` is set, a default icon is used:
   * - `EditOutlined` if `isEditMode === true`
   * - `PlusOutlined` if `isEditMode === false`
   */
  icon?: React.ReactNode;

  /**
   * Test ID used for end-to-end or unit testing (e.g. Cypress, Testing Library).
   */
  dataTestId?: string;

  /**
   * Ant Design Typography title level (default: 5)
   */
  level?: 1 | 2 | 3 | 4 | 5;
};

export const ModalTitleWithIcon = ({
  editModeConfig,
  title,
  icon,
  dataTestId = 'css-template-modal-title',
  level = 5,
}: ModalTitleWithIconProps) => {
  const theme = useTheme();
  const iconStyles = css`
    margin: auto ${theme.sizeUnit * 2}px auto 0;
  `;
  const titleStyles = css`
    && {
      margin: 0;
      margin-bottom: 0;
    }
  `;
  const renderedTitle = editModeConfig
    ? editModeConfig.isEditMode
      ? editModeConfig.titleEdit
      : editModeConfig.titleAdd
    : title;

  const renderedIcon = isValidElement(icon) ? (
    cloneElement(icon, { iconSize: 'l', css: iconStyles })
  ) : editModeConfig ? (
    editModeConfig.isEditMode ? (
      <Icons.EditOutlined iconSize="l" css={iconStyles} />
    ) : (
      <Icons.PlusOutlined iconSize="l" css={iconStyles} />
    )
  ) : null;

  return (
    <Typography.Title level={level} css={titleStyles} data-test={dataTestId}>
      {renderedIcon}
      {t(renderedTitle || '')}
    </Typography.Title>
  );
};
