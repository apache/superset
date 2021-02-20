import superset
from typing import Any, Dict, Hashable, List, NamedTuple, Optional, Tuple, Union
from superset.typing import Metric
from datetime import datetime

def update_template_kwargs(template_kwargs: Dict[str, Any], template_params_dict:Dict[Any, Any]) -> None:
    template_kwargs.update(template_params_dict)