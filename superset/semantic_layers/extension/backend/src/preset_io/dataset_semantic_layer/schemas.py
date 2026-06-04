from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DatasetConfiguration(BaseModel):
    """
    Configuration for the dataset semantic layer.

    The layer wraps Superset datasets directly, so it does not need any
    configuration beyond what Superset already knows about each dataset.
    """

    model_config = ConfigDict(title="Dataset semantic layer", extra="ignore")
