import { useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components';

export type CustomDocLinkProps = {
  url: string;
  label: string;
};

export const CustomDocLink = ({ url, label }: CustomDocLinkProps) => {
  const theme = useTheme();
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label} <Icons.Full iconSize="m" iconColor={theme.colorPrimary} />
    </a>
  );
};
