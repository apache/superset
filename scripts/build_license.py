from collections import defaultdict
import json
from pprint import pprint
import subprocess

LICENSE_MAP = {
    '(BSD-2-Clause OR MIT OR Apache-2.0)': 'MIT',
    '(BSD-2-Clause OR MIT)': 'MIT',
    '(GPL-2.0 OR MIT)': 'MIT',
    '(MIT AND BSD-3-Clause)': '(MIT AND BSD-3-Clause)',
    '(MIT AND CC-BY-3.0)': '(MIT AND CC-BY-3.0)',
    '(MIT AND Zlib)': '(MIT AND Zlib)',
    '(MIT OR Apache-2.0)': 'MIT',
    '(WTFPL OR MIT)': 'MIT',
    'AFLv2.1': 'AFLv2.1',
    'Apache License, Version 2.0': 'Apache License, Version 2.0',
    'Apache*': 'Apache*',
    'Apache-2.0': 'Apache-2.0',
    'Artistic-2.0': 'Artistic-2.0',
    'BSD': 'BSD',
    'BSD*': 'BSD*',
    'BSD-2-Clause': 'BSD-2-Clause',
    'BSD-3-Clause OR MIT': 'BSD-3-Clause OR MIT',
    'BSD-3-Clause': 'BSD-3-Clause',
    'CC-BY-3.0': 'CC-BY-3.0',
    'CC-BY-4.0': 'CC-BY-4.0',
    'CC0-1.0': 'CC0-1.0',
    'Custom: http://badges.github.io/stability-badges/dist/stable.svg':
        'Custom: http://badges.github.io/stability-badges/dist/stable.svg',
    'Custom: http://i.imgur.com/goJdO.png': 'Custom: http://i.imgur.com/goJdO.png',
    'Custom: https://github.com/tmcw/jsonlint':
        'Custom: https://github.com/tmcw/jsonlint',
    'Custom: https://ppl.family': 'Custom: https://ppl.family',
    'GNU Library General Public License': 'GNU Library General Public License',
    'ISC': 'ISC',
    'MIT OR GPL-2.0': 'MIT',
    'MIT': 'MIT',
    'MIT*': 'MIT*',
    'MPL-2.0 OR Apache-2.0': 'Apache-2.0',
    'Public Domain': 'Public Domain',
    'The MIT License': 'The MIT License',
    'UNKNOWN': 'UNKNOWN',
    'Unlicense': 'Unlicense',
    'WTFPL': 'WTFPL',
    'Zlib': 'Zlib',
}

COMPATIBLE_LICENSES = {
    'Apache-2.0',
    'BSD',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    'MIT',
    'Zlib',
}
LIB_WHITELIST = {
    # AFL or BSD 3-Clause: https://github.com/kriszyp/json-schema
    'json-schema',
}


def build_license():
    result = subprocess.run(
        ['license-checker', '--json', '--production'],
        stdout=subprocess.PIPE,
    )
    packages = json.loads(result.stdout)
    license_dict = defaultdict(set)
    for npm_short, package_details in packages.items():
        if '@' in npm_short:
            npm_short = npm_short.split('@')[0]
        licenses = package_details.get('licenses')
        if not isinstance(licenses, list):
            licenses = [licenses]
        for lic in licenses:
            lic = LICENSE_MAP.get(lic) or lic or 'UNKNOWN'
            license_dict[lic].add(npm_short)

    incompatible_dict = {
        k: [lib for lib in v if lib not in LIB_WHITELIST]
        for k, v in license_dict.items()
        if k not in COMPATIBLE_LICENSES
    }
    print(json.dumps(incompatible_dict, indent=2))


if __name__ == '__main__':
    build_license()
