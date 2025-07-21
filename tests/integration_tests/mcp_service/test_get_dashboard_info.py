import json
import logging
import traceback

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def main():
    from fastmcp import Client

    logger.info(
        "Starting get_dashboard_info integration test for dashboard IDs 1 through 10"
    )
    issues = []  # Collect (dashboard_id, message) for any warnings/errors
    async with Client("http://localhost:5008/mcp") as client:
        for dashboard_id in range(1, 11):
            logger.info(
                f"\n---\nCalling get_dashboard_info with dashboard_id={dashboard_id}"
            )
            try:
                logger.info(f"Sending request: {{'dashboard_id': {dashboard_id}}}")
                result = await client.call_tool(
                    "get_dashboard_info", {"dashboard_id": dashboard_id}
                )
                logger.info(f"Raw result object: {result}")
                logger.info(f"Result type: {type(result.data)}")
                logger.info(
                    f"get_dashboard_info output for id={dashboard_id} (repr): "
                    f"{repr(result.data)}"
                )
                # Pretty-print output
                if hasattr(result.data, "model_dump"):
                    as_dict = result.data.model_dump()
                    logger.info(
                        f"get_dashboard_info output for id={dashboard_id} (dict): "
                        f"{as_dict}"
                    )
                    pretty = json.dumps(as_dict, indent=2, default=str)
                    logger.info(
                        f"get_dashboard_info output for id={dashboard_id} ("
                        f"pretty):\n{pretty}"
                    )
                    # Detect error/warning fields
                    if as_dict.get("error") or as_dict.get("error_type"):
                        issues.append(
                            (
                                dashboard_id,
                                f"Error: {as_dict.get('error')} | Type: "
                                f"{as_dict.get('error_type')}",
                            )
                        )
                elif isinstance(result.data, dict):
                    logger.info(
                        f"get_dashboard_info output for id={dashboard_id} (dict): "
                        f"{result.data}"
                    )
                    pretty = json.dumps(result.data, indent=2, default=str)
                    logger.info(
                        f"get_dashboard_info output for id={dashboard_id} ("
                        f"pretty):\n{pretty}"
                    )
                    if result.data.get("error") or result.data.get("error_type"):
                        issues.append(
                            (
                                dashboard_id,
                                f"Error: {result.data.get('error')} | Type: "
                                f"{result.data.get('error_type')}",
                            )
                        )
                else:
                    msg = (
                        f"Output for id={dashboard_id} is not a dict or Pydantic "
                        f"model. Type: {type(result.data)}. Value: {result.data}"
                    )
                    logger.warning(msg)
                    issues.append((dashboard_id, msg))
            except Exception as e:
                msg = (
                    f"Exception calling get_dashboard_info with id={dashboard_id}: {e}"
                )
                logger.error(msg)
                logger.error(traceback.format_exc())
                issues.append((dashboard_id, msg))
    # Summary
    logger.info("\n=== SUMMARY ===")
    if issues:
        logger.warning("Found issues with the following dashboards:")
        for dashboard_id, msg in issues:
            logger.warning(f"  Dashboard {dashboard_id}: {msg}")
    else:
        logger.info(
            "All dashboards 1-10 returned successfully with no errors or warnings."
        )


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
