import hashlib
import json


def md5_sha_from_str(s: str):
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def md5_sha_from_dict(d: dict):
    json_data = json.dumps(cache_dict, sort_keys=True)
    return md5_sha_from_str(json_data)
