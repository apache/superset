/**
 * Sets the body and title content of a modal, and shows it. Assumes HTML for modal exists and that
 * it handles closing (i.e., works with bootstrap)
 *
 * @param {object} options object of the form
 *  {
 *    title: {string},
 *    body: {string},
 *    modalSelector: {string, default: '.misc-modal' },
 *    titleSelector: {string, default: '.misc-modal .modal-title' },
 *    bodySelector:  {string, default: '.misc-modal .modal-body' },
 *   }
 */
export function showModal(options: object): void;
export function formatSelectOptionsForRange(start: any, end: any): any[][];
export function formatSelectOptions(options: any): any;
export function getDatasourceParameter(datasourceId: any, datasourceType: any): string;
export function getParam(name: any): string;
export function mainMetric(savedMetrics: any): any;
//# sourceMappingURL=utils.d.ts.map