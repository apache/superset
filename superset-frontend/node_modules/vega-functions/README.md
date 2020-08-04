# vega-functions

Function implementations for the [Vega expression language](https://vega.github.io/vega/docs/expressions/). Unlike the basic utility functions included in the [vega-expression](https://github.com/vega/vega/tree/master/packages/vega-expression) package, this package includes custom expression functions, many of which are specific to Vega dataflows.

## Provided Functions

This package provides the following expression functions. All other constants and functions are provided by the base [vega-expression](https://github.com/vega/vega/tree/master/packages/vega-expression) package.

**Type Checking Functions**

- [isArray](https://vega.github.io/vega/docs/expressions/#isArray)
- [isBoolean](https://vega.github.io/vega/docs/expressions/#isBoolean)
- [isDate](https://vega.github.io/vega/docs/expressions/#isDate)
- [isNumber](https://vega.github.io/vega/docs/expressions/#isNumber)
- [isObject](https://vega.github.io/vega/docs/expressions/#isObject)
- [isRegExp](https://vega.github.io/vega/docs/expressions/#isRegExp)
- [isString](https://vega.github.io/vega/docs/expressions/#isString)
- [isTuple](https://vega.github.io/vega/docs/expressions/#isTuple)

**Type Coercion Functions**

- [toBoolean](https://vega.github.io/vega/docs/expressions/#toBoolean)
- [toDate](https://vega.github.io/vega/docs/expressions/#toDate)
- [toNumber](https://vega.github.io/vega/docs/expressions/#toNumber)
- [toString](https://vega.github.io/vega/docs/expressions/#toString)

**Math Functions**

- [random](https://vega.github.io/vega/docs/expressions/#random)

**Date/Time Functions**

- [quarter](https://vega.github.io/vega/docs/expressions/#quarter)
- [utcquarter](https://vega.github.io/vega/docs/expressions/#utcquarter)

**Array Functions**

- [clampRange](https://vega.github.io/vega/docs/expressions/#clampRange)
- [extent](https://vega.github.io/vega/docs/expressions/#extent)
- [inrange](https://vega.github.io/vega/docs/expressions/#inrange)
- [lerp](https://vega.github.io/vega/docs/expressions/#lerp)
- [peek](https://vega.github.io/vega/docs/expressions/#peek)
- [sequence](https://vega.github.io/vega/docs/expressions/#sequence)
- [span](https://vega.github.io/vega/docs/expressions/#span)

**String Functions**

- [pad](https://vega.github.io/vega/docs/expressions/#pad)
- [truncate](https://vega.github.io/vega/docs/expressions/#truncate)

**Object Functions**

- [merge](https://vega.github.io/vega/docs/expressions/#merge)

**Formatting Functions**

- [format](https://vega.github.io/vega/docs/expressions/#format)
- [utcFormat](https://vega.github.io/vega/docs/expressions/#utcFormat)
- [utcParse](https://vega.github.io/vega/docs/expressions/#utcParse)
- [timeFormat](https://vega.github.io/vega/docs/expressions/#timeFormat)
- [timeParse](https://vega.github.io/vega/docs/expressions/#timeParse)
- [monthFormat](https://vega.github.io/vega/docs/expressions/#monthFormat)
- [monthAbbrevFormat](https://vega.github.io/vega/docs/expressions/#monthAbbrevFormat)
- [dayFormat](https://vega.github.io/vega/docs/expressions/#dayFormat)
- [dayAbbrevFormat](https://vega.github.io/vega/docs/expressions/#dayAbbrevFormat)

**Color Functions**

- [rgb](https://vega.github.io/vega/docs/expressions/#rgb)
- [lab](https://vega.github.io/vega/docs/expressions/#lab)
- [hcl](https://vega.github.io/vega/docs/expressions/#hcl)
- [hsl](https://vega.github.io/vega/docs/expressions/#hsl)

**Event Functions**

- [pinchDistance](https://vega.github.io/vega/docs/expressions/#pinchDistance)
- [pinchAngle](https://vega.github.io/vega/docs/expressions/#pinchAngle)
- [inScope](https://vega.github.io/vega/docs/expressions/#inScope)

**Scale and Projection Functions**

- [bandspace](https://vega.github.io/vega/docs/expressions/#bandspace)
- [bandwidth](https://vega.github.io/vega/docs/expressions/#bandwidth)
- [copy](https://vega.github.io/vega/docs/expressions/#copy)
- [domain](https://vega.github.io/vega/docs/expressions/#domain)
- [gradient](https://vega.github.io/vega/docs/expressions/#gradient)
- [invert](https://vega.github.io/vega/docs/expressions/#invert)
- [range](https://vega.github.io/vega/docs/expressions/#range)
- [scale](https://vega.github.io/vega/docs/expressions/#scale)
- [panLinear](https://vega.github.io/vega/docs/expressions/#panLinear)
- [panLog](https://vega.github.io/vega/docs/expressions/#panLog)
- [panPow](https://vega.github.io/vega/docs/expressions/#panPow)
- [panSymlog](https://vega.github.io/vega/docs/expressions/#panSymlog)
- [zoomLinear](https://vega.github.io/vega/docs/expressions/#zoomLinear)
- [zoomLog](https://vega.github.io/vega/docs/expressions/#zoomLog)
- [zoomPow](https://vega.github.io/vega/docs/expressions/#zoomPow)
- [zoomSymlog](https://vega.github.io/vega/docs/expressions/#zoomSymlog)
- flush (used internally for axis and legend label layout)

**Geographic Functions**

- [geoArea](https://vega.github.io/vega/docs/expressions/#geoArea)
- [geoBounds](https://vega.github.io/vega/docs/expressions/#geoBounds)
- [geoCentroid](https://vega.github.io/vega/docs/expressions/#geoCentroid)

**Shape Functions**

- geoShape (used internally for mark clipping)
- pathShape (used internally for mark clipping)

**Data Functions**

- [indata](https://vega.github.io/vega/docs/expressions/#indata)
- [data](https://vega.github.io/vega/docs/expressions/#data)
- setdata (used internally for scale domain data)
- modify (used internally for trigger updates)

**Dataflow Functions**

- encode (used internally for signal updates)

**Tree (Hierarchy) Functions**

- [treePath](https://vega.github.io/vega/docs/expressions/#treePath)
- [treeAncestors](https://vega.github.io/vega/docs/expressions/#treeAncestors)

**Browser Functions**

- [screen](https://vega.github.io/vega/docs/expressions/#screen)
- [containerSize](https://vega.github.io/vega/docs/expressions/#containerSize)
- [windowSize](https://vega.github.io/vega/docs/expressions/#windowSize)

**Logging Functions**

- [warn](https://vega.github.io/vega/docs/expressions/#warn)
- [info](https://vega.github.io/vega/docs/expressions/#info)
- [debug](https://vega.github.io/vega/docs/expressions/#debug)
