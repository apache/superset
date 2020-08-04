"use strict";

exports.availableDocumentFeatures = [
  "FetchExternalResources",
  "ProcessExternalResources",
  "SkipExternalResources"
];

exports.defaultDocumentFeatures = {
  FetchExternalResources: ["script", "link"], // omitted by default: "frame"
  ProcessExternalResources: ["script"], // omitted by default: "frame", "iframe"
  SkipExternalResources: false
};

exports.applyDocumentFeatures = (documentImpl, features) => {
  features = features || {};

  for (let i = 0; i < exports.availableDocumentFeatures.length; ++i) {
    const featureName = exports.availableDocumentFeatures[i];
    let featureSource;

    if (features[featureName] !== undefined) {
      featureSource = features[featureName];
      // We have to check the lowercase version also because the Document feature
      // methods convert everything to lowercase.
    } else if (typeof features[featureName.toLowerCase()] !== "undefined") {
      featureSource = features[featureName.toLowerCase()];
    } else if (exports.defaultDocumentFeatures[featureName]) {
      featureSource = exports.defaultDocumentFeatures[featureName];
    } else {
      continue;
    }

    const implImpl = documentImpl._implementation;
    implImpl._removeFeature(featureName);

    if (featureSource !== undefined) {
      if (Array.isArray(featureSource)) {
        for (let j = 0; j < featureSource.length; ++j) {
          implImpl._addFeature(featureName, featureSource[j]);
        }
      } else {
        implImpl._addFeature(featureName, featureSource);
      }
    }
  }
};
