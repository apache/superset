This document details changes that aren't fully backwards compatible.
This doc is here to inform of change of behavior as well as
to explain actions that may be required to take while upgrading.

# 0.19.0
* We introduced `superset.security_manager.SupersetSecurityManager`,
that derives `flask_appbuilder.security.sqla.manager.SecurityManager`.
This derivation of FAB's SecurityManager was necessary in order to
introduce new attributes to `SupersetUser` like the `image_url` surfaced
in the profile page as well as in the new dashboard stats footer.

Knowing that the authentication in FAB is implemented by deriving their
`SecurityManager`, if you have your own auth setup in that way, you'll now
have to derive `SupersetSecurityManager` instead.


