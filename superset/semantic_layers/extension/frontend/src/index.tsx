import React from "react";
import { views } from "@apache-superset/core";

const viewDisposable = views.registerView(
  { id: "dataset.semantic-layer", name: "Dataset Semantic Layer" },
  "sqllab.panels",
  () => <p>Dataset Semantic Layer</p>
);

export const activate = () => {
  console.log("Dataset Semantic Layer extension activated");
};

export const deactivate = () => {
  viewDisposable.dispose();
  console.log("Dataset Semantic Layer extension deactivated");
};
