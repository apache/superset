export default Calendar;
declare function Calendar(element: any, props: any): void;
declare namespace Calendar {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<PropTypes.InferProps<{
        data: PropTypes.Requireable<object>;
        domain: PropTypes.Requireable<string>;
        range: PropTypes.Requireable<number>;
        start: PropTypes.Requireable<number>;
        subdomain: PropTypes.Requireable<string>;
    }>>;
    const height: PropTypes.Requireable<number>;
    const cellPadding: PropTypes.Requireable<number>;
    const cellRadius: PropTypes.Requireable<number>;
    const cellSize: PropTypes.Requireable<number>;
    const linearColorScheme: PropTypes.Requireable<string>;
    const showLegend: PropTypes.Requireable<boolean>;
    const showMetricName: PropTypes.Requireable<boolean>;
    const showValues: PropTypes.Requireable<boolean>;
    const steps: PropTypes.Requireable<number>;
    const timeFormatter: PropTypes.Requireable<(...args: any[]) => any>;
    const valueFormatter: PropTypes.Requireable<(...args: any[]) => any>;
    const verboseMap: PropTypes.Requireable<object>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Calendar.d.ts.map