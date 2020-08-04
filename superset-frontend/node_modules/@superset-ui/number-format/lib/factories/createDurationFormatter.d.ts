import prettyMsFormatter from 'pretty-ms';
import NumberFormatter from '../NumberFormatter';
export default function createDurationFormatter(config?: {
    description?: string;
    id?: string;
    label?: string;
    multiplier?: number;
} & prettyMsFormatter.Options): NumberFormatter;
//# sourceMappingURL=createDurationFormatter.d.ts.map