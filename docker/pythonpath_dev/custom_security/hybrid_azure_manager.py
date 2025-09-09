# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import json
import jwt
import logging
import traceback
from typing import Any, Dict, List, Optional
from flask import current_app, request, session, g
from flask_appbuilder.security.sqla.models import Role, User
from flask_jwt_extended import decode_token

from superset.security.manager import SupersetSecurityManager
from custom_security.azure_entra_manager import AzureEntraSecurityManager

logger = logging.getLogger(__name__)


class HybridAzureSecurityManager(SupersetSecurityManager):

    def __init__(self, appbuilder):
        super().__init__(appbuilder)
        
        self.azure_manager = AzureEntraSecurityManager(appbuilder)        
        self.auth_user_jwt_username_key = current_app.config.get('JWT_IDENTITY_CLAIM', 'username')
        
        logger.critical("[Hybrid SSO] Hybrid Azure Security Manager initialized")
        logger.critical(f"[Hybrid SSO] JWT username key: {self.auth_user_jwt_username_key}")
        logger.critical(f"[Hybrid SSO] Azure manager: {type(self.azure_manager).__name__}")

    def auth_user_jwt(self, token: str) -> Optional[User]:

        logger.critical("[Hybrid SSO] ========== AUTH_USER_JWT CALLED ==========")
        logger.critical(f"[Hybrid SSO] Token length: {len(token) if token else 0}")
        logger.critical(f"[Hybrid SSO] Token preview: {token[:30] if token else 'None'}...")
        
        if not token:
            logger.critical("[Hybrid SSO] No token provided")
            return None
            
        # Determine token type by examining structure
        token_type = self._identify_token_type(token)
        logger.critical(f"[Hybrid SSO] Detected token type: {token_type}")
        
        if token_type == 'azure_ad':
            logger.critical("[Hybrid SSO] Processing as Azure AD token")
            return self._handle_azure_ad_token(token)
        elif token_type == 'jwt_hs256':
            logger.critical("[Hybrid SSO] Processing as existing JWT token")
            return self._handle_existing_jwt_token(token)
        else:
            logger.critical(f"[Hybrid SSO] Unknown token type: {token_type}")
            return None

    def _identify_token_type(self, token: str) -> str:
        """
        Identify token type by examining header and claims
        """
        try:
            header = jwt.get_unverified_header(token)
            payload = jwt.decode(token, options={"verify_signature": False})
            
            algorithm = header.get('alg', '')
            issuer = payload.get('iss', '')
            audience = payload.get('aud', '')
            
            logger.critical(f"[Hybrid SSO] Token analysis - Alg: {algorithm}, Issuer: {issuer[:50]}..., Aud: {audience}")
            
            # Azure AD tokens have specific characteristics
            if (algorithm == 'RS256' and 
                ('microsoftonline' in issuer or 'sts.windows.net' in issuer) and
                'api://' in str(audience)):
                return 'azure_ad'
            
            # Existing JWT tokens  
            elif algorithm == 'HS256':
                return 'jwt_hs256'
                
            else:
                logger.warning(f"[Hybrid SSO] Unrecognized token format - Alg: {algorithm}")
                return 'unknown'
                
        except Exception as e:
            logger.error(f"[Hybrid SSO] Token type identification failed: {str(e)}")
            return 'unknown'

    def _handle_azure_ad_token(self, token: str) -> Optional[User]:
        try:
            logger.critical("[Hybrid SSO] Validating Azure AD token...")
            
            # Use Azure manager for validation
            token_data = self.azure_manager._validate_azure_token_with_nonce(token)
            if not token_data:
                logger.error("[Hybrid SSO] Azure AD token validation failed")
                return None
                
            # Extract user email
            email = token_data.get('preferred_username') or token_data.get('upn') or token_data.get('email')
            if not email:
                logger.error("[Hybrid SSO] No email found in Azure AD token")
                return None
                
            logger.critical(f"[Hybrid SSO] Azure AD token validated for: {email}")
            
            # Get groups from token
            group_guids = token_data.get('groups', [])
            logger.critical(f"[Hybrid SSO] Found {len(group_guids)} groups in Azure AD token")
            
            # Use Azure manager for group resolution and user creation
            superset_groups = self.azure_manager._resolve_superset_groups_with_fallback(group_guids, email)
            if not superset_groups:
                logger.warning(f"[Hybrid SSO] No Superset access for {email}")
                return None
                
            user = self.azure_manager._find_or_create_user_with_auto_roles(email, token_data, superset_groups)
            if user:
                self.azure_manager._cache_user_session(email, token_data, group_guids, "azure_ad_jwt")
                logger.critical(f"[Hybrid SSO] Azure AD authentication successful for {email}")
                
            return user
            
        except Exception as e:
            logger.error(f"[Hybrid SSO] Azure AD token processing error: {str(e)}")
            logger.error(f"[Hybrid SSO] Azure AD token traceback: {traceback.format_exc()}")
            return None

    def _handle_existing_jwt_token(self, token: str) -> Optional[User]:
        try:
            logger.critical("[Hybrid SSO] Processing existing JWT token...")
            
            decoded_token = decode_token(token, allow_expired=True)
            logger.critical(f"[Hybrid SSO] JWT token decoded successfully")
           
            user_id = decoded_token.get(self.auth_user_jwt_username_key)
            roles_from_jwt = decoded_token.get('roles', [])
            logger.critical(f"[Hybrid SSO] JWT User ID: {user_id}")
            logger.critical(f"[Hybrid SSO] JWT Roles: {roles_from_jwt}")

            if not user_id:
                logger.critical("[Hybrid SSO] No user identifier found in JWT")
                return None

            user = self.find_user(username=user_id)
            if user:
                logger.critical(f"[Hybrid SSO] Existing JWT user found: {user.username}")
            else:
                logger.critical(f"[Hybrid SSO] Creating new user from JWT: {user_id}")
                
                # Extract user details from JWT
                user_name = decoded_token.get('user_name', '')
                email = decoded_token.get('email', user_id)
               
                try:
                    first_name, last_name = user_name.split(" ", 1)
                except (ValueError, AttributeError):
                    first_name = user_id
                    last_name = ""
                    
                # Handle race condition for duplicate user creation
                try:
                    user = self.add_user(
                        username=user_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        role=self.find_role('Public')
                    )
                    logger.critical(f"[Hybrid SSO] JWT user creation successful: {user_id}")
                except Exception as user_create_error:
                    error_msg = str(user_create_error)
                    logger.critical(f"[Hybrid SSO] JWT user creation error: {error_msg}")
                    
                    if 'already exists' in error_msg or 'duplicate key' in error_msg:
                        user = self.find_user(username=user_id)
                        logger.critical(f"[Hybrid SSO] JWT user found after duplicate error: {user_id}")
                    else:
                        return None

            if not user:
                logger.critical("[Hybrid SSO] JWT user is None after creation attempt")
                return None
               
            superset_roles = []
            
            for role_name in roles_from_jwt:
                role = self.find_role(role_name)
                if role:
                    superset_roles.append(role)
                    logger.critical(f"[Hybrid SSO] JWT role found: {role_name}")
                else:
                    logger.critical(f"[Hybrid SSO] JWT role not found, creating: {role_name}")
                    try:
                        new_role = self.add_role(role_name)
                        if new_role:
                            superset_roles.append(new_role)
                            logger.critical(f"[Hybrid SSO] JWT role created: {role_name}")
                    except Exception as role_error:
                        logger.critical(f"[Hybrid SSO] JWT role creation failed: {role_error}")

            public_role = self.find_role('Public')
            if public_role and public_role not in superset_roles:
                superset_roles.append(public_role)

            try:
                user.roles = superset_roles
                self.update_user(user)  
                role_names = [r.name for r in user.roles]
                logger.critical(f"[Hybrid SSO] JWT user roles updated: {role_names}")
            except Exception as role_update_error:
                logger.critical(f"[Hybrid SSO] JWT role update error: {role_update_error}")
            
            # Set user in Flask context
            try:
                g.user = user
                from flask_login import login_user
                login_user(user)
                logger.critical(f"[Hybrid SSO] JWT user logged in: {user.username}")
            except Exception as login_error:
                logger.critical(f"[Hybrid SSO] JWT login error: {login_error}")
            
            return user
            
        except Exception as e:
            logger.critical(f"[Hybrid SSO] JWT token processing error: {str(e)}")
            logger.critical(f"[Hybrid SSO] JWT traceback: {traceback.format_exc()}")
            return None

    def auth_user_oauth(self, userinfo: Dict[str, Any]) -> Optional[User]:
        """
        Handle OAuth authentication - delegate to Azure manager
        """
        logger.critical("[Hybrid SSO] OAuth authentication called")
        return self.azure_manager.auth_user_oauth(userinfo)

    def oauth_user_info(self, provider: str, response: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Extract user info from OAuth response - delegate to Azure manager  
        """
        logger.critical(f"[Hybrid SSO] OAuth user info called for provider: {provider}")
        return self.azure_manager.oauth_user_info(provider, response)

    def handle_invalid_token(self, error_string: str = None) -> None:
        """
        Handle invalid tokens with enhanced logging
        """
        logger.critical(f"[Hybrid SSO] Invalid token detected: {error_string}")
        return None

    def cleanup_expired_cache(self):
        """
        Cleanup caches for both managers
        """
        if hasattr(self.azure_manager, 'cleanup_expired_cache'):
            self.azure_manager.cleanup_expired_cache()
            logger.debug("[Hybrid SSO] Azure manager cache cleaned")