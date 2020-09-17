import { styled } from '@superset-ui/core';

const Pill = styled.div`
  display: inline-block;
  background: ${({ color }) => color || '#000'};
  color: #fff;
  border-radius: 1em;
  vertical-align: text-top;
  padding: 0 8px;
  font-size: 14px;
  font-weight: normal;

  &:hover {
    cursor: pointer;
    filter: brightness(3);
  }

  svg {
    vertical-align: text-top;
  }
`;

interface TitleProps {
  bold?: boolean;
  color?: string;
}

const Title = styled.span`
  color: ${({ color }: TitleProps) => color || 'auto'};
  font-weight: ${({ bold }) => (bold ? '600' : 'auto')};

  & > .anticon * {
    color: ${({ color }) => color || 'auto'};
  }
`;

const ItemIcon = styled.i`
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -20px;
`;

const Item = styled.button`
  cursor: pointer;
  display: block;
  padding: 0;
  border: none;
  background: none;
  white-space: nowrap;
  position: relative;
  outline: none;

  &::-moz-focus-inner {
    border: 0;
  }

  &:hover > i {
    display: block;
  }
`;

const Reset = styled.div`
  margin: 0 -16px;
`;

const Indent = styled.div`
  padding-left: 24px;
  margin: -12px 0;
`;

const Panel = styled.div`
  color: #fff;
  min-width: 200px;
  max-width: 400px;
  overflow-x: hidden;

  * {
    color: #fff;
  }
`;

const S = {
  Pill,
  Title,
  Reset,
  Indent,
  Panel,
  Item,
  ItemIcon,
};

export default S;
