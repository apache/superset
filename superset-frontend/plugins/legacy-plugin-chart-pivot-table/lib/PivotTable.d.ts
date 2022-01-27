export default PivotTable;
declare function PivotTable(element: any, props: any): void;
declare namespace PivotTable {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<PropTypes.InferProps<{
        html: PropTypes.Requireable<string>;
        columns: PropTypes.Requireable<(string | (string | null)[] | null)[]>;
    }>>;
    const height: PropTypes.Requireable<number>;
    const columnFormats: PropTypes.Requireable<{
        [x: string]: string | null;
    }>;
    const numberFormat: PropTypes.Requireable<string>;
    const numGroups: PropTypes.Requireable<number>;
    const verboseMap: PropTypes.Requireable<{
        [x: string]: string | null;
    }>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=PivotTable.d.ts.map