import React from 'react';
import { Tag as AntdTag } from 'antd';
import { styled } from '@superset-ui/core';
import { useCSSTextTruncation } from 'src/hooks/useTruncation';
import { Tooltip } from '../Tooltip';
import { CustomTagProps } from './types';

const StyledTag = styled(AntdTag)`
  & .ant-tag-close-icon {
    display: inline-flex;
    align-items: center;
    margin-left: ${({ theme }) => theme.gridUnit}px;
  }

  & .tag-content {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// TODO: use antd Tag props instead of any. Currently it's causing a typescript error
const Tag = (props: any) => {
  const [tagRef, tagIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();
  return (
    <Tooltip title={tagIsTruncated ? props.children : null}>
      <StyledTag {...props} className="ant-select-selection-item">
        <span className="tag-content" ref={tagRef}>
          {props.children}
        </span>
      </StyledTag>
    </Tooltip>
  );
};

/**
 * Custom tag renderer dedicated for oneLine mode
 */
export const oneLineTagRender = (props: CustomTagProps) => {
  const { label } = props;

  const onPreventMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    // if close icon is clicked, stop propagation to avoid opening the dropdown
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'svg' ||
      target.tagName === 'path' ||
      (target.tagName === 'span' &&
        target.className.includes('ant-tag-close-icon'))
    ) {
      event.stopPropagation();
    }
  };

  return (
    <Tag onMouseDown={onPreventMouseDown} {...props}>
      {label}
    </Tag>
  );
};
