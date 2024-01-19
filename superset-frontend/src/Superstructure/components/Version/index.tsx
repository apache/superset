import React from 'react';
import { StyledVersion } from './styles';

const Version = ({ appVersion }: { appVersion: string }) => (
  <StyledVersion>{appVersion}</StyledVersion>
);

export { Version };
