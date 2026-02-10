"""
Script to create a Pandas semantic layer and Sales semantic view in Superset.

Run this inside the superset_app container:
    python /app/superset/create_pandas_semantic_layer.py
"""

from __future__ import annotations

import logging
import sys
from typing import TYPE_CHECKING

# Add the Superset application directory to the Python path
sys.path.insert(0, "/app")

from superset.app import create_app
from superset.extensions import db
from superset.utils import json

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticLayer, SemanticView

app = create_app()
app.app_context().push()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def create_pandas_semantic_layer() -> SemanticLayer:
    """Create a Pandas semantic layer with minimal configuration."""
    from superset.semantic_layers.models import SemanticLayer

    logger.info("Creating Pandas semantic layer...")

    configuration = {
        "dataset": "sales",
    }

    semantic_layer = SemanticLayer(
        name="Pandas Semantic Layer",
        description="In-memory semantic layer backed by a Pandas DataFrame",
        type="pandas",
        configuration=json.dumps(configuration),
        cache_timeout=3600,
    )

    db.session.add(semantic_layer)
    db.session.commit()

    logger.info("Created semantic layer:")
    logger.info("  Name: %s", semantic_layer.name)
    logger.info("  UUID: %s", semantic_layer.uuid)
    logger.info("  Type: %s", semantic_layer.type)

    return semantic_layer


def create_sales_semantic_view(semantic_layer: SemanticLayer) -> SemanticView:
    """Create the Sales semantic view."""
    from superset.semantic_layers.models import SemanticView

    logger.info("Creating Sales semantic view...")

    semantic_view = SemanticView(
        name="sales",
        configuration="{}",
        cache_timeout=1800,
        semantic_layer_uuid=semantic_layer.uuid,
    )

    db.session.add(semantic_view)
    db.session.commit()

    logger.info("Created semantic view:")
    logger.info("  Name: %s", semantic_view.name)
    logger.info("  UUID: %s", semantic_view.uuid)
    logger.info("  Semantic Layer UUID: %s", semantic_view.semantic_layer_uuid)

    return semantic_view


def main() -> None:
    """Main script execution."""
    logger.info("=" * 60)
    logger.info("Creating Pandas Semantic Layer and Sales Semantic View")
    logger.info("=" * 60)

    semantic_layer = create_pandas_semantic_layer()
    create_sales_semantic_view(semantic_layer)


if __name__ == "__main__":
    main()
