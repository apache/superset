"""
Marshmallow 4.x Compatibility Module for Flask-AppBuilder 5.0.0

This module provides compatibility between Flask-AppBuilder 5.0.0 and
marshmallow 4.x, specifically handling missing auto-generated fields
during schema initialization.
"""

from marshmallow import fields


def patch_marshmallow_for_flask_appbuilder():
    """
    Patches marshmallow Schema._init_fields to handle Flask-AppBuilder 5.0.0
    compatibility with marshmallow 4.x.

    Flask-AppBuilder 5.0.0 automatically generates schema fields that reference
    SQL relationship fields that may not exist in marshmallow 4.x's stricter
    field validation. This patch dynamically adds missing fields as Raw fields
    to prevent KeyError exceptions during schema initialization.
    """
    import marshmallow

    # Store the original method
    original_init_fields = marshmallow.Schema._init_fields

    def patched_init_fields(self):
        """Patched version that handles missing declared fields."""
        max_retries = 10  # Prevent infinite loops in case of unexpected errors
        retries = 0

        while retries < max_retries:
            try:
                return original_init_fields(self)
            except KeyError as e:
                # Extract the missing field name from the KeyError
                missing_field = str(e).strip("'\"")

                # Initialize declared_fields if it doesn't exist
                if not hasattr(self, "declared_fields"):
                    self.declared_fields = {}

                # Only add if it doesn't already exist
                if missing_field not in self.declared_fields:
                    # Use Raw field as a safe fallback for unknown auto-generated fields
                    self.declared_fields[missing_field] = fields.Raw(
                        allow_none=True,
                        dump_only=True,  # Prevent validation issues during serialization
                    )

                    print(
                        f"Marshmallow compatibility: Added missing field "
                        f"'{missing_field}' as Raw field"
                    )

                retries += 1
                # Continue the loop to retry initialization
            except Exception:
                # For any other type of error, just propagate it
                raise

        # If we've exhausted retries, something is seriously wrong
        raise RuntimeError(
            f"Marshmallow field initialization failed after {max_retries} retries"
        )

    # Apply the patch
    marshmallow.Schema._init_fields = patched_init_fields
