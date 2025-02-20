import React, { useEffect, useState } from 'react';
import { CSSObject } from '@emotion/react';
import { css, styled, SupersetClient } from '@superset-ui/core';
import Icons from 'src/components/Icons';

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

const Toolbar = () => {
  return (
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
};

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

const CenterTopPanel = () => {
  return (
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
};

const CenterBottomPanel = () => {
  return (
    <div css={PlaceholderStyles}>
      <Icons.Cards />
      SQL execution plugins
    </div>
  );
};

const RightPanel = () => {
  return (
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
};

interface Extension {
  scope: string;
  exposedModules: string[];
  remoteEntry: string;
}

const loadExtension = async ({
  scope,
  exposedModules,
  remoteEntry,
}: Extension) => {
  await new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = remoteEntry;
    element.type = 'text/javascript';
    element.async = true;
    element.onload = () => {
      resolve();
    };
    element.onerror = () => {
      reject(new Error(`Failed to load ${remoteEntry}`));
    };
    document.head.appendChild(element);
  });

  // @ts-ignore
  await __webpack_init_sharing__('default');
  const container = (window as any)[scope];

  // @ts-ignore
  await container.init(__webpack_share_scopes__.default);

  return exposedModules.map(async module => {
    const factory = await container.get(module);
    const Module = factory();
    return Module;
  });
};

const SqlLabPoc = () => {
  const [extensions, setExtensions] = useState<React.ReactElement[]>([]);

  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const response = await SupersetClient.get({
          endpoint: '/api/v1/extensions',
        });
        const extensions: Extension[] = response.json.result;
        const loadedExtensionsArray = await Promise.all(
          extensions.map(async extension => {
            const Modules = await loadExtension(extension);
            const resolvedModules = await Promise.all(
              Modules.map(Module => Module),
            );
            return resolvedModules.map(resolvedModule => {
              const ExtensionComponent = resolvedModule.default;
              return <ExtensionComponent />;
            });
          }),
        );

        setExtensions(loadedExtensionsArray.flat());
      } catch (error) {
        console.error('Failed to load extensions:', error);
      }
    };

    fetchExtensions();
  }, []);

  return (
    <MainPanel>
      <Toolbar />
      <LeftPanel extensions={extensions} />
      <CenterPanel>
        <CenterTopPanel />
        <CenterBottomPanel />
      </CenterPanel>
      <RightPanel />
    </MainPanel>
  );
};

export default SqlLabPoc;
