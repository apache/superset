from superset import SupersetSecurityManager
from superset.dvt_auth.login import DVTAuthDBView


class DVTSecurityManager(SupersetSecurityManager):
    authdbview = DVTAuthDBView
