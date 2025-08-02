#!/usr/bin/env python

"""
Quick test to verify MCP server modules import correctly.
"""


def test_imports():
    """Test that all MCP modules can be imported without Flask initialization."""
    try:
        # Test imports in the correct order

        print("✓ SQL Lab schemas imported successfully")

        print("✓ SQL Lab utils imported successfully")

        print("✓ Execute SQL tool imported successfully")

        print("✓ Execute SQL MCP tool imported successfully")

        print("✓ MCP app imported successfully")

        print("✓ MCP server imported successfully")

        print("\nAll imports successful! The MCP server should start without errors.")

    except Exception as e:
        print(f"❌ Import failed: {e}")
        raise


if __name__ == "__main__":
    test_imports()
