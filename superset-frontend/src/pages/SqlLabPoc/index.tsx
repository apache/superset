import { CSSObject } from '@emotion/react';
import { css, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import useExtensions, { ResolvedModule } from 'src/hooks/useExtensions';
import { useExtensionsContext } from 'src/extensions/ExtensionsContext';
import { useEffect } from 'react';

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
    <Icons.TableOutlined />
    <Icons.PlusCircleOutlined />
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
    <Icons.StarOutlined />
    SQL Editor plugin
  </div>
);

const CenterBottomPanel = () => (
  <div css={PlaceholderStyles}>
    <Icons.StarOutlined />
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
    <Icons.StarOutlined />
    AI Chat plugin
  </div>
);

const SqlLabPoc = () => {
  const extensions = useExtensions();
  const { views } = useExtensionsContext();

  useEffect(() => {
    extensions.forEach((extension: ResolvedModule) => {
      extension.activate();
    });
  }, [extensions]);

  return (
    <MainPanel>
      <Toolbar />
      <LeftPanel extensions={Object.values(views)} />
      <CenterPanel>
        <CenterTopPanel />
        <CenterBottomPanel />
      </CenterPanel>
      <RightPanel />
    </MainPanel>
  );
};

export default SqlLabPoc;
