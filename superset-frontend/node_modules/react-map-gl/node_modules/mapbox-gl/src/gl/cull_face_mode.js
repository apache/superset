// @flow

import type {CullFaceModeType, FrontFaceType} from './types';

const BACK = 0x0405;
const CCW = 0x0901;

class CullFaceMode {
    enable: boolean;
    mode: CullFaceModeType;
    frontFace: FrontFaceType;

    constructor(enable: boolean, mode: CullFaceModeType, frontFace: FrontFaceType) {
        this.enable = enable;
        this.mode = mode;
        this.frontFace = frontFace;
    }

    static disabled: $ReadOnly<CullFaceMode>;
    static backCCW: $ReadOnly<CullFaceMode>;
}

CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);

export default CullFaceMode;
