/// <reference types="react" />
import { TooltipPlacement } from 'antd/lib/tooltip';
import { TooltipProps } from './Tooltip';
export interface InfoTooltipWithTriggerProps {
    label?: string;
    tooltip?: TooltipProps['title'];
    icon?: string;
    onClick?: () => void;
    placement?: TooltipPlacement;
    bsStyle?: string;
    className?: string;
}
export declare function InfoTooltipWithTrigger({ label, tooltip, bsStyle, onClick, icon, className, placement, }: InfoTooltipWithTriggerProps): JSX.Element;
export default InfoTooltipWithTrigger;
//# sourceMappingURL=InfoTooltipWithTrigger.d.ts.map