# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Server-side CDL validation.

A faithful port of the frontend validator (superset-frontend/src/Canvas/
validator.ts). It enforces structure, the no-code invariant, and variable
reference integrity so that ``generate_canvas`` can reject bad AI output with
structured errors the agent self-corrects against.
"""

from __future__ import annotations

import re
from typing import Any

# The catalog: the allowlist of node types plus their contract. Mirrors
# superset-frontend/src/Canvas/catalog.ts.
NODE_CATALOG: dict[str, dict[str, Any]] = {
    "Column": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Row": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Card": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Tabs": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Board": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Tab": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": ["label"],
    },  # noqa: E501
    "Divider": {
        "category": "display",
        "container": False,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Alert": {
        "category": "display",
        "container": False,
        "events": [],
        "bindableProps": [],
        "requiredProps": ["message"],
    },  # noqa: E501
    "Progress": {
        "category": "display",
        "container": False,
        "events": [],
        "bindableProps": ["value"],
        "requiredProps": [],
    },  # noqa: E501
    "Collapse": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Modal": {
        "category": "layout",
        "container": True,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Input": {
        "category": "control",
        "container": False,
        "events": ["change"],
        "bindableProps": ["value"],
        "requiredProps": [],
    },  # noqa: E501
    "Switch": {
        "category": "control",
        "container": False,
        "events": ["change"],
        "bindableProps": ["value"],
        "requiredProps": [],
    },  # noqa: E501
    "Select": {
        "category": "control",
        "container": False,
        "events": ["change"],
        "bindableProps": ["value"],
        "requiredProps": ["options"],
    },  # noqa: E501
    "Button": {
        "category": "control",
        "container": False,
        "events": ["click"],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
    "Filter": {
        "category": "control",
        "container": False,
        "events": [],
        "bindableProps": [],
        "requiredProps": ["column"],
    },  # noqa: E501
    "Markdown": {
        "category": "display",
        "container": False,
        "events": [],
        "bindableProps": [],
        "requiredProps": ["text"],
    },  # noqa: E501
    "Viz": {
        "category": "viz",
        "container": False,
        "events": [],
        "bindableProps": [],
        "requiredProps": [],
    },  # noqa: E501
}

ACTION_REQUIRED: dict[str, list[str]] = {
    "setVariable": ["name", "value"],
    "applyFilter": ["col", "op", "val"],
    "crossFilter": ["col", "op", "val"],
    "clearFilters": [],
    "navigateTab": ["tabsId", "tab"],
    "openModal": ["modalId"],
    "closeModal": ["modalId"],
    "openUrl": ["url"],
    "refresh": [],
}

FORMATTER_KINDS = ["number", "currency", "percent", "date", "template"]

# Declarative styling: an allowlisted CSS-property object (never a CSS string).
# Values may be literals or "@themeToken" references resolved from the antd
# theme at render time. Mirrors superset-frontend/src/Canvas/style.ts.
STYLE_PROPERTIES = [
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
    "rowGap",
    "columnGap",
    "width",
    "minWidth",
    "maxWidth",
    "height",
    "minHeight",
    "maxHeight",
    "background",
    "backgroundColor",
    "color",
    "border",
    "borderColor",
    "borderWidth",
    "borderStyle",
    "borderRadius",
    "boxShadow",
    "opacity",
    "overflow",
    "fontSize",
    "fontWeight",
    "fontFamily",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textTransform",
    "display",
    "flex",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "alignSelf",
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridColumn",
    "gridRow",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "inset",
    "zIndex",
    "transform",
    "transformOrigin",
    "rotate",
    "scale",
    "translate",
    "transition",
    "aspectRatio",
    "objectFit",
    "filter",
    "backdropFilter",
    "mixBlendMode",
    "cursor",
    "pointerEvents",
]

_UNSAFE_STYLE_VALUE = re.compile(r"url\(|expression\(|javascript:|@import|<|/\*", re.I)

_VAR_REF = re.compile(r"^\$([A-Za-z_]\w*)$")
_CODE_SMELL = re.compile(r"=>|\bfunction\b|new\s+Function", re.IGNORECASE)
_JS_URL = re.compile(r"^\s*(javascript|data|vbscript):", re.IGNORECASE)
_EVENT_TOKEN = "$event"  # noqa: S105


def _is_var_ref(value: Any) -> bool:
    return isinstance(value, str) and bool(_VAR_REF.match(value))


def _scan_no_code(value: Any, path: str, errors: list[str]) -> None:
    """The core safety gate: reject executable-looking strings."""
    if isinstance(value, str):
        if _CODE_SMELL.search(value):
            errors.append(f"{path}: disallowed executable string (no-code invariant)")
        return
    if isinstance(value, list):
        for i, item in enumerate(value):
            _scan_no_code(item, f"{path}[{i}]", errors)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "formatter" and isinstance(item, str):
                errors.append(
                    f"{path}.formatter: formatter must be a declarative object, "
                    "not a string"
                )
            _scan_no_code(item, f"{path}.{key}", errors)


def _collect_refs(value: Any, out: set[str]) -> None:
    if _is_var_ref(value) and value != _EVENT_TOKEN:
        out.add(value[1:])
    elif isinstance(value, list):
        for item in value:
            _collect_refs(item, out)
    elif isinstance(value, dict):
        for item in value.values():
            _collect_refs(item, out)


def _validate_style(style: Any, path: str, errors: list[str]) -> None:
    if style is None:
        return
    if not isinstance(style, dict):
        errors.append(f"{path}: style must be an object")
        return
    for prop, value in style.items():
        if prop not in STYLE_PROPERTIES:
            errors.append(f"{path}.{prop}: unsupported style property")
            continue
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            errors.append(f"{path}.{prop}: style values must be a string or number")
            continue
        if isinstance(value, str) and _UNSAFE_STYLE_VALUE.search(value):
            errors.append(f"{path}.{prop}: disallowed value")


def _validate_layout(layout: Any, path: str, errors: list[str]) -> None:
    if layout is None:
        return
    if not isinstance(layout, dict):
        errors.append(f"{path}: layout must be an object")
        return
    for key in ("x", "y", "w", "h"):
        value = layout.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append(f"{path}.{key}: {key} must be a number")
    for key in ("w", "h"):
        value = layout.get(key)
        if isinstance(value, (int, float)) and value < 1:
            errors.append(f"{path}.{key}: {key} must be at least 1")


def _validate_action(
    action: Any, path: str, declared: set[str], errors: list[str]
) -> None:
    if not isinstance(action, dict):
        errors.append(f"{path}: action must be an object")
        return
    name = action.get("action")
    required = ACTION_REQUIRED.get(name) if isinstance(name, str) else None
    if required is None:
        errors.append(f"{path}: unknown action {name!r}")
        return
    for key in required:
        if action.get(key) is None:
            errors.append(f"{path}: action {name!r} missing {key!r}")
    if name == "openUrl":
        url = action.get("url")
        if isinstance(url, str) and _JS_URL.match(url):
            errors.append(f"{path}.url: openUrl allows http(s) only")
    if name == "setVariable" and action.get("name") not in declared:
        errors.append(f"{path}.name: undeclared variable {action.get('name')!r}")


def _validate_node(  # noqa: C901
    node: Any, path: str, declared: set[str], errors: list[str]
) -> None:
    if not isinstance(node, dict):
        errors.append(f"{path}: node must be an object")
        return
    if not isinstance(node.get("id"), str) or not node.get("id"):
        errors.append(f"{path}: node.id (string) is required")

    node_type = node.get("type")
    if node_type not in NODE_CATALOG:
        errors.append(f"{path}: unknown node type {node_type!r} (not in catalog)")
        return
    entry = NODE_CATALOG[node_type]
    props = node.get("props") or {}

    for prop in entry["requiredProps"]:
        if props.get(prop) is None:
            errors.append(f"{path}.props.{prop}: required prop missing")

    children = node.get("children") or []
    if children and not entry["container"]:
        errors.append(f"{path}.children: {node_type!r} cannot have children")

    for prop, ref in (node.get("bind") or {}).items():
        if prop not in entry["bindableProps"]:
            errors.append(f"{path}.bind.{prop}: prop is not bindable")
        elif not _is_var_ref(ref):
            errors.append(f"{path}.bind.{prop}: must be a $var reference")
        elif ref[1:] not in declared:
            errors.append(f"{path}.bind.{prop}: undeclared variable {ref!r}")

    for event, actions in (node.get("on") or {}).items():
        if event not in entry["events"]:
            errors.append(f"{path}.on.{event}: {node_type!r} does not emit {event!r}")
        for i, action in enumerate(actions or []):
            _validate_action(action, f"{path}.on.{event}[{i}]", declared, errors)

    if node_type == "Viz":
        renderer = node.get("renderer")
        if renderer == "echarts":
            data = node.get("data") or {}
            if not data.get("queryContext"):
                errors.append(f"{path}.data: echarts Viz requires data.queryContext")
            if not data.get("encoding"):
                errors.append(f"{path}.data: echarts Viz requires data.encoding")
            _scan_no_code(node.get("option"), f"{path}.option", errors)
        elif renderer == "supersetChart":
            if not isinstance(node.get("chartId"), int):
                errors.append(f"{path}.chartId: supersetChart Viz requires chartId")
        else:
            errors.append(f"{path}.renderer: unknown Viz renderer {renderer!r}")

    _scan_no_code(props, f"{path}.props", errors)
    _validate_style(node.get("style"), f"{path}.style", errors)
    _validate_layout(node.get("layout"), f"{path}.layout", errors)

    refs: set[str] = set()
    _collect_refs(props, refs)
    _collect_refs(node.get("on"), refs)
    if node_type == "Viz":
        _collect_refs((node.get("data") or {}).get("queryContext"), refs)
    for name in refs:
        if name not in declared:
            errors.append(f"{path}: references undeclared variable ${name}")

    for i, child in enumerate(children):
        _validate_node(child, f"{path}.children[{i}]", declared, errors)


def validate_cdl(definition: Any) -> list[str]:
    """Return a list of human-readable validation errors (empty == valid)."""
    errors: list[str] = []
    if not isinstance(definition, dict):
        return ["definition must be an object"]
    if not isinstance(definition.get("cdlVersion"), int):
        errors.append("cdlVersion (int) is required")
    variables = definition.get("variables")
    if not isinstance(variables, dict):
        errors.append("variables object is required")
        variables = {}
    tree = definition.get("tree")
    if not tree:
        errors.append("tree (root node) is required")
        return errors
    declared = set(variables.keys())
    _validate_node(tree, "tree", declared, errors)
    return errors


def build_cdl_schema() -> dict[str, Any]:
    """The machine-readable CDL contract handed to the authoring agent."""
    return {
        "cdlVersion": 2,
        "summary": (
            "Canvas Definition Language: a typed, declarative component tree for "
            "an AI-native dashboard. Compose layout, controls, and charts. Nothing "
            "is code — presentation is a data 'option', data is a 'queryContext' + "
            "'encoding', behaviour is a bounded 'action' enum."
        ),
        "envelope": {
            "cdlVersion": "int (use 2)",
            "variables": "map of name -> {type: string|number|boolean, default, scope: query|ui}",  # noqa: E501
            "tree": "the root node",
            "canvasWidth": (
                "optional outer width cap. Omit or 'full' for full-bleed "
                "(default, like a dashboard — use for boards and overviews); a "
                "CSS width like '820px' centres a narrow reading column (use "
                "for the narrative idiom)."
            ),
        },
        "variableScopes": {
            "query": "projected onto dataMask; drives bound queries (governed, RLS, cached)",  # noqa: E501
            "ui": "client-only (active tab, toggles); never hits the backend",
        },
        "composition": {
            "summary": (
                "Do NOT default to a grid of chart cards with a filter bar on "
                "top — that is just a dashboard, and Superset already builds "
                "those. Choose the layout that fits the job, and put controls "
                "next to the thing they control."
            ),
            "idioms": {
                "narrative": (
                    "A written brief. Set envelope canvasWidth:'820px' (or a "
                    "root Column with style {maxWidth:'820px', margin:'0 auto'}); "
                    "prose Markdown, charts as BARE Viz nodes "
                    "between paragraphs (no Card), each followed by a small "
                    "caption Markdown styled {color:'@colorTextSecondary', "
                    "fontSize:'13px'}. Use when the canvas makes an argument."
                ),
                "tool": (
                    "A parameterised instrument. Inline controls (see "
                    "controlPlacement) followed by the charts they govern; "
                    "split into sections so a later control only affects what "
                    "comes after it."
                ),
                "bento": (
                    "An overview. A Row with style {display:'grid', "
                    "gridTemplateColumns:'repeat(12, minmax(0, 1fr))', gap:'20px'} "
                    "and children given varied {gridColumn:'span N'} (and "
                    "optionally {gridRow:'span 2'}). Vary the spans — a uniform "
                    "grid reads as a dashboard."
                ),
                "sidebar": (
                    "A Row containing a Column {flex:'0 0 300px'} rail and a "
                    "Column {flex:'1 1 420px'} main area."
                ),
                "freeform": (
                    "A Board node — coordinate placement, like a whiteboard or "
                    "a report designer. Set props {columns:12, rowHeight:40, "
                    "gap:8}; give each child a 'layout' {x,y,w,h,z?} in grid "
                    "units (x,y = top-left cell, w,h = span). Children may "
                    "OVERLAP — use 'z' to order them, e.g. a big-number tile "
                    "floating over a faint background chart, or a callout "
                    "pinned to a corner. Nothing else in Superset can do this."
                ),
            },
            "controlPlacement": {
                "rule": (
                    "Prefer controls embedded where they are relevant over a "
                    "control panel at the top. Spread multiple controls down "
                    "the page, each above the charts it affects."
                ),
                "inlineSentenceRecipe": (
                    "A Row styled {alignItems:'center', gap:'10px', "
                    "flexWrap:'wrap', fontSize:'19px'} containing: Markdown "
                    "fragment, the Input/Select, another Markdown fragment. "
                    "Give each Markdown {flex:'0 0 auto', margin:'0'} and the "
                    "input {flex:'0 0 110px'}, and drop the control's label — "
                    "the sentence carries the meaning."
                ),
            },
            "parametersVsFilters": (
                "A Filter node picks values FROM a column — the same thing a "
                "native dashboard filter does. A variable bound to an Input, "
                "referenced in a filter with an operator "
                "({col:'sales', op:'>', val:'$threshold'}), is a real "
                "PARAMETER and has no dashboard equivalent. Reach for it "
                "whenever the question is 'above/below X'. Declare the "
                "variable as type 'number' so typed text is coerced."
            ),
            "gotchas": [
                "Modal must be a child of the ROOT node, never of a grid — it "
                "portals out of the DOM and would leave an empty grid cell.",
                "Buttons/Switches inside a Row need {flex:'0 0 auto'}, or the "
                "row stretches them to equal width.",
                "Use 'repeat(12, minmax(0, 1fr))'; plain '1fr' lets a wide "
                "chart blow out its track and force horizontal scrolling.",
                "Panels sharing a grid band should have similar heights, or "
                "set the grid {alignItems:'stretch'} and the cards "
                "{height:'100%'}.",
                "Any node that HOSTS a control (Filter/Select/Input) should "
                "use '@colorBgContainer' for its background, not a hardcoded "
                "colour — the control's label follows the theme and will be "
                "invisible on a fixed surface in one of light/dark.",
            ],
        },
        "styling": {
            "summary": (
                "Every node accepts an optional 'style' OBJECT (never a CSS "
                "string) for layout and appearance. Values are literals "
                "('16px', '1fr 1fr') or '@themeToken' references resolved from "
                "the antd theme at render time — prefer tokens so light/dark "
                "theming keeps working."
            ),
            "properties": STYLE_PROPERTIES,
            "tokenExamples": [
                "@colorPrimary",
                "@colorBgContainer",
                "@colorBorder",
                "@colorText",
                "@colorTextSecondary",
                "@borderRadius",
                "@boxShadow",
                "@fontSizeLG",
            ],
            "example": {
                "style": {
                    "padding": "16px",
                    "background": "@colorBgContainer",
                    "borderRadius": "@borderRadius",
                    "boxShadow": "@boxShadow",
                }
            },
        },
        "commonNodeFields": {
            "id": "stable unique string",
            "type": "one of nodeTypes",
            "props": "typed props for the component",
            "style": "optional allowlisted style object (see 'styling')",
            "layout": "optional {x,y,w,h,z?} placement inside a Board parent",
            "bind": "{prop: '$var'} two-way binding (only bindableProps)",
            "on": "{event: [action, ...]} declarative handlers (only listed events)",
            "children": "array of nodes (containers only)",
        },
        "nodeTypes": NODE_CATALOG,
        "vizRenderers": {
            "echarts": {
                "data": {
                    "queryContext": {
                        "datasetId": "int (from list_datasets / get_dataset_info)",
                        "metrics": "list of saved-metric names or SQL like 'SUM(sales)'",  # noqa: E501
                        "groupby": "list of column names",
                        "filters": "list of {col, op, val} — val may be '$var'",
                        "rowLimit": "int — combine with orderby for top-N",
                        "orderby": (
                            "list of {by, desc} — 'by' names a metric or groupby "
                            "column. Use [{by: 'SUM(sales)', desc: true}] with "
                            "rowLimit for top-N, or [{by: 'year'}] to sort a "
                            "time axis chronologically."
                        ),
                    },
                    "encoding": {
                        "x": "category column",
                        "y": "value column or list",
                        "series": "optional column that fans into one series each",
                    },
                },
                "option": "an echarts option object (DATA ONLY — no functions)",
            },
            "supersetChart": {
                "chartId": "int — an existing saved chart (use list_charts to find one)",  # noqa: E501
                "filters": "optional extra [{col, op, val}] — val may be '$var'",
                "notes": (
                    "Renders the saved chart with its own viz plugin and "
                    "form_data. Canvas Filter nodes on the same dataset are "
                    "merged into its query automatically, so governed charts "
                    "react to canvas filters. Prefer this over an echarts Viz "
                    "when a suitable saved chart already exists."
                ),
            },
        },
        "filters": {
            "summary": (
                "A Filter node is a dashboard-style filter the user places. It "
                "auto-populates its options from the column's distinct values and "
                "auto-applies to EVERY echarts Viz on the same dataset — you do "
                "NOT need to add it to each chart's queryContext.filters."
            ),
            "props": {
                "column": "column to filter on (required)",
                "dataset": "datasetId the filter applies to (match your Viz datasetId)",  # noqa: E501
                "label": "display label",
                "multiple": "true for a multi-select (IN) filter",
                "op": "override the operator (default '==' single, 'IN' multiple)",
                "options": "optional explicit [{value,label}]; omit to auto-fetch",
            },
            "example": {
                "id": "f_platform",
                "type": "Filter",
                "props": {
                    "column": "platform",
                    "dataset": 1,
                    "label": "Platform",
                    "multiple": True,
                },
            },
        },
        "actions": {
            name: {"required": required} for name, required in ACTION_REQUIRED.items()
        },
        "formatters": {
            "kinds": FORMATTER_KINDS,
            "shape": "{kind: 'currency', currency: 'USD'} etc — declarative, resolved to a function client-side",  # noqa: E501
            "usage": "attach under option.yAxis.axisLabel.formatter or option.tooltip.valueFormatter",  # noqa: E501
        },
        "rules": [
            "NEVER emit a function or code string anywhere (formatters, handlers, option).",  # noqa: E501
            "A 'formatter' must be a declarative object, never a string.",
            "openUrl allows http(s) only.",
            "Every '$var' referenced must be declared in variables.",
            "Only containers (Column, Row, Card, Tabs, Tab) may have children.",
            "Tabs must contain Tab children (each needs a 'label'); the navigateTab "
            "action switches them via {tabsId: <Tabs node id>, tab: <Tab node id>}.",
            "Button actions are fully wired: setVariable, applyFilter/crossFilter "
            "(write canvas filters), clearFilters (clears filters + resets variables), "
            "navigateTab, refresh (re-runs every bound query).",
            "Input and Switch two-way bind their 'value' to a $var, like Select.",
            "Modal is hidden until a Button fires "
            "{action:'openModal', modalId:<Modal id>} "
            "— use it for drill-in detail panels without leaving the canvas.",
            "Collapse children each become a panel titled by their props.label.",
            "Alert (message + type info|success|warning|error) is for narrative "
            "callouts; Progress binds 'value' to a $var for goal tracking.",
            "Introspect datasets via list_datasets + get_dataset_info before building queryContext.",  # noqa: E501
        ],
        "example": {
            "cdlVersion": 2,
            "variables": {
                "region": {"type": "string", "default": "APAC", "scope": "query"}
            },  # noqa: E501
            "tree": {
                "id": "root",
                "type": "Column",
                "children": [
                    {
                        "id": "title",
                        "type": "Markdown",
                        "props": {"text": "Sales by month"},
                    },  # noqa: E501
                    {
                        "id": "controls",
                        "type": "Row",
                        "children": [
                            {
                                "id": "region",
                                "type": "Select",
                                "props": {
                                    "label": "Region",
                                    "options": [
                                        {"value": "APAC", "label": "APAC"},
                                        {"value": "EMEA", "label": "EMEA"},
                                    ],
                                },
                                "bind": {"value": "$region"},
                            }
                        ],
                    },
                    {
                        "id": "chart",
                        "type": "Viz",
                        "renderer": "echarts",
                        "data": {
                            "queryContext": {
                                "datasetId": 1,
                                "metrics": ["SUM(sales)"],
                                "groupby": ["month"],
                                "filters": [
                                    {"col": "region", "op": "==", "val": "$region"}
                                ],  # noqa: E501
                            },
                            "encoding": {"x": "month", "y": "SUM(sales)"},
                        },
                        "option": {
                            "series": [{"type": "line"}],
                            "tooltip": {
                                "valueFormatter": {
                                    "kind": "currency",
                                    "currency": "USD",
                                }
                            },
                        },
                    },
                ],
            },
        },
    }
