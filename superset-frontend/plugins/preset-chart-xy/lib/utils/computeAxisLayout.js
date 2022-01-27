/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { getTextDimension } from '@superset-ui/core';
export default function computeAxisLayout(axis, { axisTitleHeight = 20, axisWidth, gapBetweenAxisLabelAndBorder = 4, gapBetweenTickAndTickLabel = 4, defaultTickSize = 8, tickTextStyle = {}, }) {
    const tickLabels = axis.getTickLabels();
    const tickLabelDimensions = tickLabels.map((text) => getTextDimension({
        style: tickTextStyle,
        text,
    }));
    const { labelAngle, labelFlush, labelOverlap, labelPadding, orient, tickSize = defaultTickSize, } = axis.config;
    const maxWidth = Math.max(...tickLabelDimensions.map(d => d.width), 0);
    // cheap heuristic, can improve
    const widthPerTick = axisWidth / tickLabels.length;
    const isLabelOverlap = maxWidth > widthPerTick;
    const labelAngleIfOverlap = labelOverlap.strategy === 'rotate' ? labelOverlap.labelAngle : 0;
    const labelAngleAfterOverlapCheck = isLabelOverlap ? labelAngleIfOverlap : 0;
    const finalLabelAngle = labelAngle === 0 ? labelAngleAfterOverlapCheck : labelAngle;
    const spaceForAxisTitle = axis.hasTitle()
        ? labelPadding + axisTitleHeight
        : 0;
    let tickTextAnchor = 'middle';
    let labelOffset = 0;
    let requiredMargin = tickSize +
        gapBetweenTickAndTickLabel +
        spaceForAxisTitle +
        gapBetweenAxisLabelAndBorder;
    if (axis.channelEncoder.isX()) {
        if (finalLabelAngle === 0) {
            const labelHeight = tickLabelDimensions.length > 0 ? tickLabelDimensions[0].height : 0;
            labelOffset = labelHeight + labelPadding;
            requiredMargin += labelHeight;
        }
        else {
            const labelHeight = Math.ceil(Math.abs(maxWidth * Math.sin((finalLabelAngle * Math.PI) / 180)));
            labelOffset = labelHeight + labelPadding;
            requiredMargin += labelHeight;
            tickTextAnchor =
                (orient === 'top' && finalLabelAngle > 0) ||
                    (orient === 'bottom' && finalLabelAngle < 0)
                    ? 'end'
                    : 'start';
        }
        requiredMargin += 8;
    }
    else {
        labelOffset = maxWidth + spaceForAxisTitle;
        requiredMargin += maxWidth;
    }
    return {
        axisWidth,
        labelAngle: finalLabelAngle,
        labelFlush,
        labelOffset,
        labelOverlap: isLabelOverlap ? labelOverlap.strategy : 'flat',
        minMargin: {
            [orient]: Math.ceil(requiredMargin),
        },
        orient,
        tickLabelDimensions,
        tickLabels,
        tickTextAnchor,
    };
}
//# sourceMappingURL=computeAxisLayout.js.map