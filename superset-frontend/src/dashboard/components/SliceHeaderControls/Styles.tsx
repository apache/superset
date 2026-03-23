import { css, SupersetTheme } from '@apache-superset/core/theme';

export const fullscreenStyles = (theme: SupersetTheme) => css`
  /* Using && to increase specificity without needing !important as often */
  &&[data-test='dashboard-component-chart-holder']:fullscreen {
    background-color: ${theme.colorBgBase};
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: ${theme.sizeUnit * 4}px;
    overflow: visible;
    position: relative;
    pointer-events: auto;
    z-index: 1000;
    opacity: 1;
    visibility: visible;

    /* Ensure children take up available space */
    .dashboard-chart,
    .chart-container,
    .slice_container,
    .chart-slice {
      flex: 1 1 auto;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: visible;
    }

    /* Portaled components inside the fullscreen layer */
    .ant-dropdown,
    .ant-tooltip,
    .ant-modal-root,
    .ant-select-dropdown,
    .ant-popover {
      z-index: 2000;
      pointer-events: auto;
      visibility: visible;
      opacity: 1;
    }
  }

  /* Interaction and Header fixes */
  [data-test='dashboard-component-chart-holder']:fullscreen * {
    pointer-events: auto;
  }

  [data-test='dashboard-component-chart-header'] {
    z-index: 100;
    position: relative;
  }
`;