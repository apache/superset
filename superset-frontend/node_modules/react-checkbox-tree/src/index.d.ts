import * as React from 'react';

declare module "react-checkbox-tree" {
    interface Node {
        label: JSX.Element;
        value: string;
        children?: Array<Node>;
        className?: string;
        disabled?: boolean;
        icon?: JSX.Element;
        showCheckbox?: boolean;
        title?: string;
    }

    interface Icons {
        check?: JSX.Element;
        uncheck?: JSX.Element;
        halfCheck?: JSX.Element;
        expandOpen?: JSX.Element;
        expandClose?: JSX.Element;
        expandAll?: JSX.Element;
        collapseAll?: JSX.Element;
        parentClose?: JSX.Element;
        parentOpen?: JSX.Element;
        leaf?: JSX.Element;
    }

    interface Language {
        collapseAll: string;
        expandAll: string;
        toggle: string;
    }

    interface CheckboxProps {
        nodes: Array<Node>;
        checked: Array<string>;
        expanded: Array<string>;
        onCheck: (checked: Array<string>) => void;
        onExpand: (expanded: Array<string>) => void;

        disabled?: boolean;
        expandDisabled?: boolean;
        expandOnClick?: boolean;
        icons?: Icons;
        lang?: Language;
        name?: string;
        nameAsArray?: boolean;
        nativeCheckboxes?: boolean;
        noCascade?: boolean;
        onlyLeafCheckboxes?: boolean;
        optimisticToggle?: boolean;
        showExpandAll?: boolean;
        showNodeIcon?: boolean;
        showNodeTitles?: boolean;
        onClick?: (event: { checked: boolean, value: any }) => void;
    }

    export default class CheckboxTree extends React.Component<CheckboxProps> { }
}
