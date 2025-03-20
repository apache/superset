import { CSSObject } from '@emotion/react';
import { css, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import useExtensions, { ResolvedModule } from 'src/hooks/useExtensions';

const PlaceholderStyles: CSSObject = css`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
`;

const MainPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
`;

const Toolbar = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 8px;
    `}
  >
    <Icons.Table />
    <Icons.NavDashboard />
  </div>
);

const LeftPanel = ({ extensions }: { extensions: React.ReactElement[] }) => (
  <div
    css={theme => css`
      width: 400px;
      gap: 12px;
      display: flex;
      flex-direction: column;
      border-left: 1px solid ${theme.colors.grayscale.light2};
      border-right: 1px solid ${theme.colors.grayscale.light2};
    `}
  >
    {extensions}
  </div>
);

const CenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CenterTopPanel = () => (
  <div
    css={theme => css`
      ${PlaceholderStyles};
      border-bottom: 1px solid ${theme.colors.grayscale.light2};
    `}
  >
    <Icons.Cards />
    SQL Editor plugin
  </div>
);

const CenterBottomPanel = () => (
  <div css={PlaceholderStyles}>
    <Icons.Cards />
    SQL execution plugins
  </div>
);

const RightPanel = () => (
  <div
    css={theme => css`
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      border-left: 1px solid ${theme.colors.grayscale.light2};
      width: 400px;
    `}
  >
    <Icons.Cards />
    AI Chat plugin
  </div>
);

const SqlLabPoc = () => {
  const extensions = useExtensions();
  const elements = extensions.map(
    (extension: ResolvedModule, index: number) => {
      const Module = extension.default;
      // TODO: Get key from metadata
      return <Module key={`extension${index}`} />;
    },
  );

  return (
    <MainPanel>
      <Toolbar />
      <LeftPanel extensions={elements} />
      <CenterPanel>
        <CenterTopPanel />
        <CenterBottomPanel />
      </CenterPanel>
      <RightPanel />
    </MainPanel>
  );
};

export default SqlLabPoc;
