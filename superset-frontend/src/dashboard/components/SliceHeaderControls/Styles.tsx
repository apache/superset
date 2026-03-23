import { css } from '@apache-superset/core/theme';

export const fullscreenStyles = (theme: any) => css`
  /* 1. Target the specific chart holder when it IS in fullscreen mode */
  [data-test='dashboard-component-chart-holder']:fullscreen {
    background-color: ${theme?.colors?.grayscale?.light5 || '#ffffff'} !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    padding: ${theme?.gridUnit ? theme.gridUnit * 4 : 16}px !important;
    overflow: visible !important; /* Allow tooltips and menus to be fully visible */
    position: relative !important;
    pointer-events: auto !important;
    z-index: 1000 !important;
    
    /* Force visibility and opacity to override classes like 'fade-out' */
    opacity: 1 !important;
    visibility: visible !important;
  }

  /* Ensure ALL children of the fullscreen holder are interactive */
  [data-test='dashboard-component-chart-holder']:fullscreen * {
    pointer-events: auto !important;
  }

  /* 2. FORCE the internal chart container to take up all remaining space */
  [data-test='dashboard-component-chart-holder']:fullscreen .dashboard-chart,
  [data-test='dashboard-component-chart-holder']:fullscreen .chart-container,
  [data-test='dashboard-component-chart-holder']:fullscreen .slice_container,
  [data-test='dashboard-component-chart-holder']:fullscreen .chart-slice {
    flex: 1 1 auto !important;
    height: 100% !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: visible !important;
  }

  /* 3. Ensure header and interactive elements are ON TOP */
  [data-test='dashboard-component-chart-header'] {
    z-index: 100 !important;
    position: relative !important;
  }

  /* 4. FIX INTERACTIVITY: Portaled components inside the fullscreen layer */
  /* These are now portaled into the chart holder via ConfigProvider */
  .ant-dropdown,
  .ant-tooltip,
  .ant-modal-root,
  .ant-select-dropdown,
  .ant-popover {
    z-index: 2000 !important;
    pointer-events: auto !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
`;