export const getSheetText = (sheet) => {
    let allRules = '';
    for (let i = 0; i < sheet.cssRules.length; i ++) {
        allRules += sheet.cssRules[i].cssText + ' ';
    }
    return allRules;
};
