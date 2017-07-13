# -*- coding: utf-8 -*-
"""
    pygments.lexers.igor
    ~~~~~~~~~~~~~~~~~~~~

    Lexers for Igor Pro.

    :copyright: Copyright 2006-2017 by the Pygments team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re

from pygments.lexer import RegexLexer, words
from pygments.token import Text, Comment, Keyword, Name, String

__all__ = ['IgorLexer']


class IgorLexer(RegexLexer):
    """
    Pygments Lexer for Igor Pro procedure files (.ipf).
    See http://www.wavemetrics.com/ and http://www.igorexchange.com/.

    .. versionadded:: 2.0
    """

    name = 'Igor'
    aliases = ['igor', 'igorpro']
    filenames = ['*.ipf']
    mimetypes = ['text/ipf']

    flags = re.IGNORECASE | re.MULTILINE

    flowControl = (
        'if', 'else', 'elseif', 'endif', 'for', 'endfor', 'strswitch', 'switch',
        'case', 'default', 'endswitch', 'do', 'while', 'try', 'catch', 'endtry',
        'break', 'continue', 'return', 'AbortOnRTE', 'AbortOnValue'
    )
    types = (
        'variable', 'string', 'constant', 'strconstant', 'NVAR', 'SVAR', 'WAVE',
        'STRUCT', 'dfref', 'funcref', 'char', 'uchar', 'int16', 'uint16', 'int32',
        'uint32', 'int64', 'uint64', 'float', 'double'
    )
    keywords = (
        'override', 'ThreadSafe', 'MultiThread', 'static',  'Proc',
        'Picture', 'Prompt', 'DoPrompt', 'macro', 'window', 'function', 'end',
        'Structure', 'EndStructure', 'EndMacro', 'Menu', 'SubMenu'
    )
    operations = (
        'Abort', 'AddFIFOData', 'AddFIFOVectData', 'AddMovieAudio', 'AddMovieFrame',
        'AdoptFiles', 'APMath', 'Append', 'AppendImage', 'AppendLayoutObject',
        'AppendMatrixContour', 'AppendText', 'AppendToGizmo', 'AppendToGraph',
        'AppendToLayout', 'AppendToTable', 'AppendXYZContour', 'AutoPositionWindow',
        'BackgroundInfo', 'Beep', 'BoundingBall', 'BoxSmooth', 'BrowseURL', 'BuildMenu',
        'Button', 'cd', 'Chart', 'CheckBox', 'CheckDisplayed', 'ChooseColor', 'Close',
        'CloseHelp', 'CloseMovie', 'CloseProc', 'ColorScale', 'ColorTab2Wave',
        'Concatenate', 'ControlBar', 'ControlInfo', 'ControlUpdate',
        'ConvertGlobalStringTextEncoding', 'ConvexHull', 'Convolve', 'CopyFile',
        'CopyFolder', 'CopyScales', 'Correlate', 'CreateAliasShortcut', 'CreateBrowser',
        'Cross', 'CtrlBackground', 'CtrlFIFO', 'CtrlNamedBackground', 'Cursor',
        'CurveFit', 'CustomControl', 'CWT', 'Debugger', 'DebuggerOptions', 'DefaultFont',
        'DefaultGuiControls', 'DefaultGuiFont', 'DefaultTextEncoding', 'DefineGuide',
        'DelayUpdate', 'DeleteAnnotations', 'DeleteFile', 'DeleteFolder', 'DeletePoints',
        'Differentiate', 'dir', 'Display', 'DisplayHelpTopic', 'DisplayProcedure',
        'DoAlert', 'DoIgorMenu', 'DoUpdate', 'DoWindow', 'DoXOPIdle', 'DPSS',
        'DrawAction', 'DrawArc', 'DrawBezier', 'DrawLine', 'DrawOval', 'DrawPICT',
        'DrawPoly', 'DrawRect', 'DrawRRect', 'DrawText', 'DrawUserShape', 'DSPDetrend',
        'DSPPeriodogram', 'Duplicate', 'DuplicateDataFolder', 'DWT', 'EdgeStats', 'Edit',
        'ErrorBars', 'EstimatePeakSizes', 'Execute', 'ExecuteScriptText',
        'ExperimentModified', 'ExportGizmo', 'Extract', 'FastGaussTransform', 'FastOp',
        'FBinRead', 'FBinWrite', 'FFT', 'FIFOStatus', 'FIFO2Wave', 'FilterFIR',
        'FilterIIR', 'FindAPeak', 'FindContour', 'FindDuplicates', 'FindLevel',
        'FindLevels', 'FindPeak', 'FindPointsInPoly', 'FindRoots', 'FindSequence',
        'FindValue', 'FPClustering', 'fprintf', 'FReadLine', 'FSetPos', 'FStatus',
        'FTPCreateDirectory', 'FTPDelete', 'FTPDownload', 'FTPUpload', 'FuncFit',
        'FuncFitMD', 'GBLoadWave', 'GetAxis', 'GetCamera', 'GetFileFolderInfo',
        'GetGizmo', 'GetLastUserMenuInfo', 'GetMarquee', 'GetMouse', 'GetSelection',
        'GetWindow', 'GPIBReadBinaryWave2', 'GPIBReadBinary2', 'GPIBReadWave2',
        'GPIBRead2', 'GPIBWriteBinaryWave2', 'GPIBWriteBinary2', 'GPIBWriteWave2',
        'GPIBWrite2', 'GPIB2', 'GraphNormal', 'GraphWaveDraw', 'GraphWaveEdit', 'Grep',
        'GroupBox', 'Hanning', 'HDF5CloseFile', 'HDF5CloseGroup', 'HDF5ConvertColors',
        'HDF5CreateFile', 'HDF5CreateGroup', 'HDF5CreateLink', 'HDF5Dump',
        'HDF5DumpErrors', 'HDF5DumpState', 'HDF5ListAttributes', 'HDF5ListGroup',
        'HDF5LoadData', 'HDF5LoadGroup', 'HDF5LoadImage', 'HDF5OpenFile', 'HDF5OpenGroup',
        'HDF5SaveData', 'HDF5SaveGroup', 'HDF5SaveImage', 'HDF5TestOperation',
        'HDF5UnlinkObject', 'HideIgorMenus', 'HideInfo', 'HideProcedures', 'HideTools',
        'HilbertTransform', 'Histogram', 'ICA', 'IFFT', 'ImageAnalyzeParticles',
        'ImageBlend', 'ImageBoundaryToMask', 'ImageEdgeDetection', 'ImageFileInfo',
        'ImageFilter', 'ImageFocus', 'ImageFromXYZ', 'ImageGenerateROIMask', 'ImageGLCM',
        'ImageHistModification', 'ImageHistogram', 'ImageInterpolate', 'ImageLineProfile',
        'ImageLoad', 'ImageMorphology', 'ImageRegistration', 'ImageRemoveBackground',
        'ImageRestore', 'ImageRotate', 'ImageSave', 'ImageSeedFill', 'ImageSkeleton3d',
        'ImageSnake', 'ImageStats', 'ImageThreshold', 'ImageTransform',
        'ImageUnwrapPhase', 'ImageWindow', 'IndexSort', 'InsertPoints', 'Integrate',
        'IntegrateODE', 'Integrate2D', 'Interpolate2', 'Interpolate3D', 'Interp3DPath',
        'JCAMPLoadWave', 'JointHistogram', 'KillBackground', 'KillControl',
        'KillDataFolder', 'KillFIFO', 'KillFreeAxis', 'KillPath', 'KillPICTs',
        'KillStrings', 'KillVariables', 'KillWaves', 'KillWindow', 'KMeans', 'Label',
        'Layout', 'LayoutPageAction', 'LayoutSlideShow', 'Legend',
        'LinearFeedbackShiftRegister', 'ListBox', 'LoadData', 'LoadPackagePreferences',
        'LoadPICT', 'LoadWave', 'Loess', 'LombPeriodogram', 'Make', 'MakeIndex',
        'MarkPerfTestTime', 'MatrixConvolve', 'MatrixCorr', 'MatrixEigenV',
        'MatrixFilter', 'MatrixGaussJ', 'MatrixGLM', 'MatrixInverse', 'MatrixLinearSolve',
        'MatrixLinearSolveTD', 'MatrixLLS', 'MatrixLUBkSub', 'MatrixLUD', 'MatrixLUDTD',
        'MatrixMultiply', 'MatrixOP', 'MatrixSchur', 'MatrixSolve', 'MatrixSVBkSub',
        'MatrixSVD', 'MatrixTranspose', 'MeasureStyledText', 'MLLoadWave', 'Modify',
        'ModifyBrowser', 'ModifyCamera', 'ModifyContour', 'ModifyControl',
        'ModifyControlList', 'ModifyFreeAxis', 'ModifyGizmo', 'ModifyGraph',
        'ModifyImage', 'ModifyLayout', 'ModifyPanel', 'ModifyTable', 'ModifyWaterfall',
        'MoveDataFolder', 'MoveFile', 'MoveFolder', 'MoveString', 'MoveSubwindow',
        'MoveVariable', 'MoveWave', 'MoveWindow', 'MultiTaperPSD',
        'MultiThreadingControl', 'NeuralNetworkRun', 'NeuralNetworkTrain', 'NewCamera',
        'NewDataFolder', 'NewFIFO', 'NewFIFOChan', 'NewFreeAxis', 'NewGizmo', 'NewImage',
        'NewLayout', 'NewMovie', 'NewNotebook', 'NewPanel', 'NewPath', 'NewWaterfall',
        'NI4882', 'Note', 'Notebook', 'NotebookAction', 'Open', 'OpenHelp',
        'OpenNotebook', 'Optimize', 'ParseOperationTemplate', 'PathInfo', 'PauseForUser',
        'PauseUpdate', 'PCA', 'PlayMovie', 'PlayMovieAction', 'PlaySound',
        'PopupContextualMenu', 'PopupMenu', 'Preferences', 'PrimeFactors', 'Print',
        'printf', 'PrintGraphs', 'PrintLayout', 'PrintNotebook', 'PrintSettings',
        'PrintTable', 'Project', 'PulseStats', 'PutScrapText', 'pwd', 'Quit',
        'RatioFromNumber', 'Redimension', 'Remove', 'RemoveContour', 'RemoveFromGizmo',
        'RemoveFromGraph', 'RemoveFromLayout', 'RemoveFromTable', 'RemoveImage',
        'RemoveLayoutObjects', 'RemovePath', 'Rename', 'RenameDataFolder', 'RenamePath',
        'RenamePICT', 'RenameWindow', 'ReorderImages', 'ReorderTraces', 'ReplaceText',
        'ReplaceWave', 'Resample', 'ResumeUpdate', 'Reverse', 'Rotate', 'Save',
        'SaveData', 'SaveExperiment', 'SaveGraphCopy', 'SaveNotebook',
        'SavePackagePreferences', 'SavePICT', 'SaveTableCopy', 'SetActiveSubwindow',
        'SetAxis', 'SetBackground', 'SetDashPattern', 'SetDataFolder', 'SetDimLabel',
        'SetDrawEnv', 'SetDrawLayer', 'SetFileFolderInfo', 'SetFormula', 'SetIgorHook',
        'SetIgorMenuMode', 'SetIgorOption', 'SetMarquee', 'SetProcessSleep',
        'SetRandomSeed', 'SetScale', 'SetVariable', 'SetWaveLock', 'SetWaveTextEncoding',
        'SetWindow', 'ShowIgorMenus', 'ShowInfo', 'ShowTools', 'Silent', 'Sleep',
        'Slider', 'Smooth', 'SmoothCustom', 'Sort', 'SortColumns', 'SoundInRecord',
        'SoundInSet', 'SoundInStartChart', 'SoundInStatus', 'SoundInStopChart',
        'SoundLoadWave', 'SoundSaveWave', 'SphericalInterpolate', 'SphericalTriangulate',
        'SplitString', 'SplitWave', 'sprintf', 'sscanf', 'Stack', 'StackWindows',
        'StatsAngularDistanceTest', 'StatsANOVA1Test', 'StatsANOVA2NRTest',
        'StatsANOVA2RMTest', 'StatsANOVA2Test', 'StatsChiTest',
        'StatsCircularCorrelationTest', 'StatsCircularMeans', 'StatsCircularMoments',
        'StatsCircularTwoSampleTest', 'StatsCochranTest', 'StatsContingencyTable',
        'StatsDIPTest', 'StatsDunnettTest', 'StatsFriedmanTest', 'StatsFTest',
        'StatsHodgesAjneTest', 'StatsJBTest', 'StatsKDE', 'StatsKendallTauTest',
        'StatsKSTest', 'StatsKWTest', 'StatsLinearCorrelationTest',
        'StatsLinearRegression', 'StatsMultiCorrelationTest', 'StatsNPMCTest',
        'StatsNPNominalSRTest', 'StatsQuantiles', 'StatsRankCorrelationTest',
        'StatsResample', 'StatsSample', 'StatsScheffeTest', 'StatsShapiroWilkTest',
        'StatsSignTest', 'StatsSRTest', 'StatsTTest', 'StatsTukeyTest',
        'StatsVariancesTest', 'StatsWatsonUSquaredTest', 'StatsWatsonWilliamsTest',
        'StatsWheelerWatsonTest', 'StatsWilcoxonRankTest', 'StatsWRCorrelationTest',
        'String', 'StructGet', 'StructPut', 'SumDimension', 'SumSeries', 'TabControl',
        'Tag', 'TextBox', 'ThreadGroupPutDF', 'ThreadStart', 'Tile', 'TileWindows',
        'TitleBox', 'ToCommandLine', 'ToolsGrid', 'Triangulate3d', 'Unwrap', 'URLRequest',
        'ValDisplay', 'Variable', 'VDTClosePort2', 'VDTGetPortList2', 'VDTGetStatus2',
        'VDTOpenPort2', 'VDTOperationsPort2', 'VDTReadBinaryWave2', 'VDTReadBinary2',
        'VDTReadHexWave2', 'VDTReadHex2', 'VDTReadWave2', 'VDTRead2', 'VDTTerminalPort2',
        'VDTWriteBinaryWave2', 'VDTWriteBinary2', 'VDTWriteHexWave2', 'VDTWriteHex2',
        'VDTWriteWave2', 'VDTWrite2', 'VDT2', 'WaveMeanStdv', 'WaveStats',
        'WaveTransform', 'wfprintf', 'WignerTransform', 'WindowFunction', 'XLLoadWave'
    )
    functions = (
        'abs', 'acos', 'acosh', 'AddListItem', 'AiryA', 'AiryAD', 'AiryB', 'AiryBD',
        'alog', 'AnnotationInfo', 'AnnotationList', 'area', 'areaXY', 'asin', 'asinh',
        'atan', 'atanh', 'atan2', 'AxisInfo', 'AxisList', 'AxisValFromPixel', 'Besseli',
        'Besselj', 'Besselk', 'Bessely', 'beta', 'betai', 'BinarySearch',
        'BinarySearchInterp', 'binomial', 'binomialln', 'binomialNoise', 'cabs',
        'CaptureHistory', 'CaptureHistoryStart', 'ceil', 'cequal', 'char2num',
        'chebyshev', 'chebyshevU', 'CheckName', 'ChildWindowList', 'CleanupName', 'cmplx',
        'cmpstr', 'conj', 'ContourInfo', 'ContourNameList', 'ContourNameToWaveRef',
        'ContourZ', 'ControlNameList', 'ConvertTextEncoding', 'cos', 'cosh',
        'cosIntegral', 'cot', 'coth', 'CountObjects', 'CountObjectsDFR', 'cpowi',
        'CreationDate', 'csc', 'csch', 'CsrInfo', 'CsrWave', 'CsrWaveRef', 'CsrXWave',
        'CsrXWaveRef', 'CTabList', 'DataFolderDir', 'DataFolderExists',
        'DataFolderRefsEqual', 'DataFolderRefStatus', 'date', 'datetime', 'DateToJulian',
        'date2secs', 'Dawson', 'DDERequestString', 'defined', 'deltax', 'digamma',
        'dilogarithm', 'DimDelta', 'DimOffset', 'DimSize', 'ei', 'enoise', 'equalWaves',
        'erf', 'erfc', 'erfcw', 'exists', 'exp', 'ExpConvExp', 'ExpConvExpFit',
        'ExpConvExpFitBL', 'ExpConvExpFit1Shape', 'ExpConvExpFit1ShapeBL', 'ExpGauss',
        'ExpGaussFit', 'ExpGaussFitBL', 'ExpGaussFit1Shape', 'ExpGaussFit1ShapeBL',
        'expInt', 'expIntegralE1', 'expNoise', 'factorial', 'fakedata', 'faverage',
        'faverageXY', 'FetchURL', 'FindDimLabel', 'FindListItem', 'floor', 'FontList',
        'FontSizeHeight', 'FontSizeStringWidth', 'FresnelCos', 'FresnelSin',
        'FuncRefInfo', 'FunctionInfo', 'FunctionList', 'FunctionPath', 'gamma',
        'gammaEuler', 'gammaInc', 'gammaNoise', 'gammln', 'gammp', 'gammq', 'Gauss',
        'GaussFit', 'GaussFitBL', 'GaussFit1Width', 'GaussFit1WidthBL', 'Gauss1D',
        'Gauss2D', 'gcd', 'GetBrowserLine', 'GetBrowserSelection', 'GetDataFolder',
        'GetDataFolderDFR', 'GetDefaultFont', 'GetDefaultFontSize', 'GetDefaultFontStyle',
        'GetDimLabel', 'GetEnvironmentVariable', 'GetErrMessage', 'GetFormula',
        'GetIndependentModuleName', 'GetIndexedObjName', 'GetIndexedObjNameDFR',
        'GetKeyState', 'GetRTErrMessage', 'GetRTError', 'GetRTLocation', 'GetRTLocInfo',
        'GetRTStackInfo', 'GetScrapText', 'GetUserData', 'GetWavesDataFolder',
        'GetWavesDataFolderDFR', 'GizmoInfo', 'GizmoScale', 'gnoise', 'GrepList',
        'GrepString', 'GuideInfo', 'GuideNameList', 'Hash', 'hcsr', 'HDF5AttributeInfo',
        'HDF5DatasetInfo', 'HDF5LibraryInfo', 'HDF5TypeInfo', 'hermite', 'hermiteGauss',
        'HyperGNoise', 'HyperGPFQ', 'HyperG0F1', 'HyperG1F1', 'HyperG2F1', 'IgorInfo',
        'IgorVersion', 'imag', 'ImageInfo', 'ImageNameList', 'ImageNameToWaveRef',
        'IndependentModuleList', 'IndexedDir', 'IndexedFile', 'Inf', 'Integrate1D',
        'interp', 'Interp2D', 'Interp3D', 'inverseERF', 'inverseERFC', 'ItemsInList',
        'JacobiCn', 'JacobiSn', 'JulianToDate', 'Laguerre', 'LaguerreA', 'LaguerreGauss',
        'LambertW', 'LayoutInfo', 'leftx', 'LegendreA', 'limit', 'ListMatch',
        'ListToTextWave', 'ListToWaveRefWave', 'ln', 'log', 'logNormalNoise',
        'LorentzianFit', 'LorentzianFitBL', 'LorentzianFit1Width',
        'LorentzianFit1WidthBL', 'lorentzianNoise', 'LowerStr', 'MacroList', 'magsqr',
        'MandelbrotPoint', 'MarcumQ', 'MatrixCondition', 'MatrixDet', 'MatrixDot',
        'MatrixRank', 'MatrixTrace', 'max', 'mean', 'median', 'min', 'mod', 'ModDate',
        'MPFXEMGPeak', 'MPFXExpConvExpPeak', 'MPFXGaussPeak', 'MPFXLorenzianPeak',
        'MPFXVoigtPeak', 'NameOfWave', 'NaN', 'NewFreeDataFolder', 'NewFreeWave', 'norm',
        'NormalizeUnicode', 'note', 'NumberByKey', 'numpnts', 'numtype',
        'NumVarOrDefault', 'num2char', 'num2istr', 'num2str', 'NVAR_Exists',
        'OperationList', 'PadString', 'PanelResolution', 'ParamIsDefault',
        'ParseFilePath', 'PathList', 'pcsr', 'Pi', 'PICTInfo', 'PICTList',
        'PixelFromAxisVal', 'pnt2x', 'poissonNoise', 'poly', 'PolygonArea', 'poly2D',
        'PossiblyQuoteName', 'ProcedureText', 'p2rect', 'qcsr', 'real', 'RemoveByKey',
        'RemoveEnding', 'RemoveFromList', 'RemoveListItem', 'ReplaceNumberByKey',
        'ReplaceString', 'ReplaceStringByKey', 'rightx', 'round', 'r2polar', 'sawtooth',
        'scaleToIndex', 'ScreenResolution', 'sec', 'sech', 'Secs2Date', 'Secs2Time',
        'SelectNumber', 'SelectString', 'SetEnvironmentVariable', 'sign', 'sin', 'sinc',
        'sinh', 'sinIntegral', 'SortList', 'SpecialCharacterInfo', 'SpecialCharacterList',
        'SpecialDirPath', 'SphericalBessJ', 'SphericalBessJD', 'SphericalBessY',
        'SphericalBessYD', 'SphericalHarmonics', 'sqrt', 'StartMSTimer', 'StatsBetaCDF',
        'StatsBetaPDF', 'StatsBinomialCDF', 'StatsBinomialPDF', 'StatsCauchyCDF',
        'StatsCauchyPDF', 'StatsChiCDF', 'StatsChiPDF', 'StatsCMSSDCDF',
        'StatsCorrelation', 'StatsDExpCDF', 'StatsDExpPDF', 'StatsErlangCDF',
        'StatsErlangPDF', 'StatsErrorPDF', 'StatsEValueCDF', 'StatsEValuePDF',
        'StatsExpCDF', 'StatsExpPDF', 'StatsFCDF', 'StatsFPDF', 'StatsFriedmanCDF',
        'StatsGammaCDF', 'StatsGammaPDF', 'StatsGeometricCDF', 'StatsGeometricPDF',
        'StatsGEVCDF', 'StatsGEVPDF', 'StatsHyperGCDF', 'StatsHyperGPDF',
        'StatsInvBetaCDF', 'StatsInvBinomialCDF', 'StatsInvCauchyCDF', 'StatsInvChiCDF',
        'StatsInvCMSSDCDF', 'StatsInvDExpCDF', 'StatsInvEValueCDF', 'StatsInvExpCDF',
        'StatsInvFCDF', 'StatsInvFriedmanCDF', 'StatsInvGammaCDF', 'StatsInvGeometricCDF',
        'StatsInvKuiperCDF', 'StatsInvLogisticCDF', 'StatsInvLogNormalCDF',
        'StatsInvMaxwellCDF', 'StatsInvMooreCDF', 'StatsInvNBinomialCDF',
        'StatsInvNCChiCDF', 'StatsInvNCFCDF', 'StatsInvNormalCDF', 'StatsInvParetoCDF',
        'StatsInvPoissonCDF', 'StatsInvPowerCDF', 'StatsInvQCDF', 'StatsInvQpCDF',
        'StatsInvRayleighCDF', 'StatsInvRectangularCDF', 'StatsInvSpearmanCDF',
        'StatsInvStudentCDF', 'StatsInvTopDownCDF', 'StatsInvTriangularCDF',
        'StatsInvUsquaredCDF', 'StatsInvVonMisesCDF', 'StatsInvWeibullCDF',
        'StatsKuiperCDF', 'StatsLogisticCDF', 'StatsLogisticPDF', 'StatsLogNormalCDF',
        'StatsLogNormalPDF', 'StatsMaxwellCDF', 'StatsMaxwellPDF', 'StatsMedian',
        'StatsMooreCDF', 'StatsNBinomialCDF', 'StatsNBinomialPDF', 'StatsNCChiCDF',
        'StatsNCChiPDF', 'StatsNCFCDF', 'StatsNCFPDF', 'StatsNCTCDF', 'StatsNCTPDF',
        'StatsNormalCDF', 'StatsNormalPDF', 'StatsParetoCDF', 'StatsParetoPDF',
        'StatsPermute', 'StatsPoissonCDF', 'StatsPoissonPDF', 'StatsPowerCDF',
        'StatsPowerNoise', 'StatsPowerPDF', 'StatsQCDF', 'StatsQpCDF', 'StatsRayleighCDF',
        'StatsRayleighPDF', 'StatsRectangularCDF', 'StatsRectangularPDF', 'StatsRunsCDF',
        'StatsSpearmanRhoCDF', 'StatsStudentCDF', 'StatsStudentPDF', 'StatsTopDownCDF',
        'StatsTriangularCDF', 'StatsTriangularPDF', 'StatsTrimmedMean',
        'StatsUSquaredCDF', 'StatsVonMisesCDF', 'StatsVonMisesNoise', 'StatsVonMisesPDF',
        'StatsWaldCDF', 'StatsWaldPDF', 'StatsWeibullCDF', 'StatsWeibullPDF',
        'StopMSTimer', 'StringByKey', 'stringCRC', 'StringFromList', 'StringList',
        'stringmatch', 'strlen', 'strsearch', 'StrVarOrDefault', 'str2num', 'StudentA',
        'StudentT', 'sum', 'SVAR_Exists', 'TableInfo', 'TagVal', 'TagWaveRef', 'tan',
        'tanh', 'TextEncodingCode', 'TextEncodingName', 'TextFile', 'ThreadGroupCreate',
        'ThreadGroupGetDF', 'ThreadGroupGetDFR', 'ThreadGroupRelease', 'ThreadGroupWait',
        'ThreadProcessorCount', 'ThreadReturnValue', 'ticks', 'time', 'TraceFromPixel',
        'TraceInfo', 'TraceNameList', 'TraceNameToWaveRef', 'trunc', 'UniqueName',
        'UnPadString', 'UnsetEnvironmentVariable', 'UpperStr', 'URLDecode', 'URLEncode',
        'VariableList', 'Variance', 'vcsr', 'Voigt', 'VoigtFit', 'VoigtFitBL',
        'VoigtFit1Shape', 'VoigtFit1ShapeBL', 'VoigtFit1Shape1Width',
        'VoigtFit1Shape1WidthBL', 'VoigtFunc', 'WaveCRC', 'WaveDims', 'WaveExists',
        'WaveInfo', 'WaveList', 'WaveMax', 'WaveMin', 'WaveName', 'WaveRefIndexed',
        'WaveRefIndexedDFR', 'WaveRefsEqual', 'WaveRefWaveToList', 'WaveTextEncoding',
        'WaveType', 'WaveUnits', 'WhichListItem', 'WinList', 'WinName', 'WinRecreation',
        'WinType', 'WMFindWholeWord', 'WNoise', 'xcsr', 'XWaveName', 'XWaveRefFromTrace',
        'x2pnt', 'zcsr', 'ZernikeR', 'zeta'
    )

    tokens = {
        'root': [
            (r'//.*$', Comment.Single),
            (r'"([^"\\]|\\.)*"', String),
            # Flow Control.
            (words(flowControl, prefix=r'\b', suffix=r'\b'), Keyword),
            # Types.
            (words(types, prefix=r'\b', suffix=r'\b'), Keyword.Type),
            # Keywords.
            (words(keywords, prefix=r'\b', suffix=r'\b'), Keyword.Reserved),
            # Built-in operations.
            (words(operations, prefix=r'\b', suffix=r'\b'), Name.Class),
            # Built-in functions.
            (words(functions, prefix=r'\b', suffix=r'\b'), Name.Function),
            # Compiler directives.
            (r'^#(include|pragma|define|undef|ifdef|ifndef|if|elif|else|endif)',
             Name.Decorator),
            (r'[^a-z"/]+$', Text),
            (r'.', Text),
        ],
    }
