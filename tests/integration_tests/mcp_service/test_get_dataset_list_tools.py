import logging
import sys
import traceback
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_tool(client, tool_name, payload, label, issues):
    logger.info(f"\n---\nCalling {tool_name} {label} with payload: {payload}")
    try:
        result = await client.call_tool(tool_name, payload)
        logger.info(f"Raw result object: {result}")
        logger.info(f"Result type: {type(result.data)}")
        logger.info(f"{tool_name} {label} output (repr): {repr(result.data)}")
        # Pretty-print output
        if hasattr(result.data, "model_dump"):
            as_dict = result.data.model_dump()
            logger.info(f"{tool_name} {label} output (dict): {as_dict}")
            pretty = json.dumps(as_dict, indent=2, default=str)
            logger.info(f"{tool_name} {label} output (pretty):\n{pretty}")
            if as_dict.get('error') or as_dict.get('error_type'):
                issues.append((tool_name, label, f"Error: {as_dict.get('error')} | Type: {as_dict.get('error_type')}"))
        elif isinstance(result.data, dict):
            logger.info(f"{tool_name} {label} output (dict): {result.data}")
            pretty = json.dumps(result.data, indent=2, default=str)
            logger.info(f"{tool_name} {label} output (pretty):\n{pretty}")
            if result.data.get('error') or result.data.get('error_type'):
                issues.append((tool_name, label, f"Error: {result.data.get('error')} | Type: {result.data.get('error_type')}"))
        else:
            msg = f"Output is not a dict or Pydantic model. Type: {type(result.data)}. Value: {result.data}"
            logger.warning(msg)
            issues.append((tool_name, label, msg))
    except Exception as e:
        msg = f"Exception calling {tool_name} {label}: {e}"
        logger.error(msg)
        logger.error(traceback.format_exc())
        issues.append((tool_name, label, msg))

async def main():
    from fastmcp import Client
    logger.info("Starting integration test for list_datasets and list_datasets tools")
    issues = []
    async with Client("http://localhost:5008/mcp") as client:
        # Test list_datasets with default params
        await test_tool(client, "list_datasets", {}, "(default)", issues)
        # Test list_datasets with a filter
        await test_tool(client, "list_datasets", {"filters": {"schema": "public"}}, "(schema=public)", issues)
        # Test list_datasets with pagination
        await test_tool(client, "list_datasets", {"page": 1, "page_size": 2}, "(page=1, page_size=2)", issues)

        # Test list_datasets (advanced) with default params
        await test_tool(client, "list_datasets", {}, "(default)", issues)
        # Test list_datasets with a filter (table_name sw 'ab')
        await test_tool(client, "list_datasets", {"filters": [{"col": "table_name", "opr": "sw", "value": "ab"}]}, "(table_name sw 'ab')", issues)
        # Test list_datasets with pagination
        await test_tool(client, "list_datasets", {"page": 1, "page_size": 2}, "(page=1, page_size=2)", issues)

        # Test get_dataset_info with a likely invalid ID (should return error)
        await test_tool(client, "get_dataset_info", {"dataset_id": 999999}, "(invalid id)", issues)

    # Summary
    logger.info("\n=== SUMMARY ===")
    if issues:
        logger.warning(f"Found issues with the following tool calls:")
        for tool_name, label, msg in issues:
            logger.warning(f"  {tool_name} {label}: {msg}")
    else:
        logger.info("All list_datasets and list_datasets calls returned successfully with no errors or warnings.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 
