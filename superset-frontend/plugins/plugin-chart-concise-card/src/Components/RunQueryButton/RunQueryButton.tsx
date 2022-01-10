import { styled } from '@superset-ui/core';
import React from 'react';

const ButtonComponent = styled.button<{ disabled: boolean }>`
  position: relative;
  bottom: 46px;
  left: 275px;
  width: 50px;
  height: 56px;
  border: 1px solid ${props => (props.disabled ? 'grey' : '#1A85A0')};
  border-radius: 3px;
  color: ${props => (props.disabled ? 'grey' : '#1A85A0')};
  background: white;
  text-align: center;
`;

export default function RunQueryButton(props: {
  setShouldRunQuery: Function;
  enableRunButton: boolean;
}) {
  const { setShouldRunQuery, enableRunButton } = props;

  return (
    <ButtonComponent disabled={!enableRunButton} onClick={() => setShouldRunQuery(true)}>
      Run
    </ButtonComponent>
  );
}
