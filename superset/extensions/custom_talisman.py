import logging
from copy import deepcopy
from typing import Any, Dict

from flask import current_app
from flask_talisman import Talisman

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class CustomTalisman(Talisman):
    def _get_local_options(self) -> Dict[str, Any]:
        view_options = super()._get_local_options()
        view_options = deepcopy(view_options)
        csp = view_options.get("content_security_policy", {})
        overrides = current_app.config.get("TALISMAN_OVERRIDES", {})
        print(overrides, "overrides")

        csp_frame_src = csp.get("frame-src", [])
        override_csp = overrides.get("content_security_policy", {})
        override_frame_src = override_csp.get("frame-src", [])
        print("csp frame src", csp_frame_src, "override frame src", override_frame_src)

        merged_frame_src = list(set(csp_frame_src + override_frame_src))

        csp["frame-src"] = merged_frame_src
        view_options["content_security_policy"] = csp

        return view_options
