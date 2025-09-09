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

import hashlib
import json
import jwt
import logging
import requests
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlencode

from flask import current_app, request, session, g, redirect
from sqlalchemy import text
from flask_appbuilder.security.sqla.models import Role, User
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from superset.security.manager import SupersetSecurityManager

logger = logging.getLogger(__name__)


class AzureEntraSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder):
        super().__init__(appbuilder)
        self.azure_config = self._get_azure_config()
        
        # Initialize Flask-Caching instance
        from flask_caching import Cache
        self.cache = Cache(current_app)
        
        logger.info("[Azure SSO] Azure Security Manager initialized")
        logger.info(f"[Azure SSO] Using Flask-Caching with Redis backend")
        logger.info(f"[Azure SSO] SQLAlchemy connection pooling enabled")
        
    def _get_azure_config(self) -> Dict[str, Any]:
        """Get Azure AD configuration from app config"""
        config = current_app.config
        tenant_id = config.get('AZURE_TENANT_ID')
        
        return {
            #--------- TODO: Remove hardcoded fall backs once testing is complete ----------------------
            'tenant_id': tenant_id,
            'client_id': config.get('AZURE_CLIENT_ID', '39ad4e02-9a76-4464-810b-eac74dbc0950'),
            'client_secret': config.get('AZURE_CLIENT_SECRET'),
            'authority': f"https://login.microsoftonline.com/{tenant_id}" if tenant_id else None,
            'audience': config.get('AZURE_AUDIENCE', 'api://39ad4e02-9a76-4464-810b-eac74dbc0950'),
            'jwks_uri': f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys" if tenant_id else None,
        }

    def auth_user_oauth(self, userinfo: Dict[str, Any]) -> Optional[User]:
        """
        Handle OAuth authentication - called for direct Superset access
        """
        email = userinfo.get('preferred_username') or userinfo.get('email')
        if not email:
            logger.error("[Azure SSO] No email found in OAuth userinfo")
            return None
            
        logger.info(f"[Azure SSO] Direct OAuth login for: {email}")
        
        # Check session cache first
        session_key = self._generate_secure_session_key(email)
        cached_session = self.cache.get(f"azure_session:{session_key}")
        if cached_session:
            logger.info(f"[Azure SSO] Using cached session for {email}")
            return self.find_user(email=email)
        
        # Get group GUIDs from userinfo
        group_guids = userinfo.get('groups', [])
        if not group_guids:
            logger.warning(f"[Azure SSO] No groups found for {email}")
            
        # filter groups via Azure SQL
        superset_groups = self._resolve_superset_groups_with_fallback(group_guids, email)
        if not superset_groups:
            logger.warning(f"[Azure SSO] User {email} has no Superset access groups")
            return None
            
        # Find or create user with roles
        user = self._find_or_create_user_with_auto_roles(email, userinfo, superset_groups)
        if user:
            self._cache_user_session(email, userinfo, group_guids, "direct_oauth")
            
        return user

    def auth_user_remote_user(self, username: str) -> Optional[User]:
        """
        Handle proof token authentication - called from WordPress iframe
        """
        # Check for proof token parameter
        proof_token = request.args.get('proof') or request.form.get('proof')
        if not proof_token:
            logger.debug("[Azure SSO] No proof token provided")
            return super().auth_user_remote_user(username)
            
        logger.info(f"[Azure SSO] Validating WordPress proof token")
        
        # Validate Azure AD proof token with nonce checking
        token_data = self._validate_azure_token_with_nonce(proof_token)
        if not token_data:
            logger.error("[Azure SSO] Proof token validation failed")
            return None
            
        # Extract user info from token
        email = token_data.get('preferred_username') or token_data.get('upn')
        if not email:
            logger.error("[Azure SSO] No email found in proof token")
            return None
            
        # Check session cache first 
        session_key = self._generate_secure_session_key(email)
        cached_session = self.cache.get(f"azure_session:{session_key}")
        if cached_session:
            logger.info(f"[Azure SSO] Using cached session for WordPress user: {email}")
            return self.find_user(email=email)
        
        # Get group GUIDs from token
        group_guids = token_data.get('groups', [])
        logger.info(f"[Azure SSO] Proof token: {len(group_guids)} groups for {email}")
        
        # filter groups via Azure SQL
        superset_groups = self._resolve_superset_groups_with_fallback(group_guids, email)
        if not superset_groups:
            logger.warning(f"[Azure SSO] WordPress user {email} has no Superset access")
            return None
            
        # Find or create user with roles
        user = self._find_or_create_user_with_auto_roles(email, token_data, superset_groups)
        if user:
            self._cache_user_session(email, token_data, group_guids, "wordpress_proof")
            
        return user

    def _generate_secure_session_key(self, email: str) -> str:
        """Generate cryptographically secure session key with device fingerprinting"""
        device_fingerprint = hashlib.sha256(
            f"{request.headers.get('User-Agent', 'unknown')}"
            f"{request.headers.get('Accept-Language', 'unknown')}"
            f"{request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr or 'unknown')}"
            f"{request.headers.get('Accept-Encoding', 'unknown')}"
        ).hexdigest()[:16]
        
        return f"azure_session:{email}:{device_fingerprint}"

    def _validate_azure_token_with_nonce(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate Azure AD token with nonce
        """
        try:
            # Decode without verification to get nonce
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            
            # Check for replay attacks using nonce
            token_id = unverified_payload.get('jti') or unverified_payload.get('nonce')
            if token_id:
                nonce_key = f"token_nonce:{token_id}"
                if self.cache.get(nonce_key):
                    logger.error(f"[Azure SSO] Token replay attack detected: {token_id}")
                    return None
                # Cache nonce to prevent replay (15 minutes)
                self.cache.set(nonce_key, True, timeout=900)
            
            # Validate token using cached Azure AD public keys
            payload = self._validate_token_signature(token)
            if not payload:
                return None
                
            # Check audience and expiry
            if payload.get('aud') != self.azure_config['audience']:
                logger.error(f"[Azure SSO] Invalid audience: {payload.get('aud')}")
                return None
                
            if payload.get('exp', 0) <= time.time():
                logger.error("[Azure SSO] Token expired")
                return None
                
            logger.info("[Azure SSO] Token validation successful")
            return payload
            
        except Exception as e:
            logger.error(f"[Azure SSO] Token validation error: {str(e)}")
            return None

    def _validate_token_signature(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate JWT signature using cached Azure AD public keys"""
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            # Check cached keys first
            jwks_cache_key = f"azure_jwks:{self.azure_config['tenant_id']}"
            cached_jwks = self.cache.get(jwks_cache_key)
            
            if not cached_jwks:
                # Fetch JWKS from Azure AD with network resilience
                try:
                    jwks_response = requests.get(
                        self.azure_config['jwks_uri'], 
                        timeout=10,
                        headers={'User-Agent': 'Superset-Azure-SSO/1.0'}
                    )
                    jwks_response.raise_for_status()
                    cached_jwks = jwks_response.json()
                    # Cache for 24 hours
                    self.cache.set(jwks_cache_key, cached_jwks, timeout=86400)
                    logger.info(f"[Azure SSO] JWKS keys fetched successfully from {self.azure_config['jwks_uri']}")
                except (requests.RequestException, ValueError, KeyError) as e:
                    logger.error(f"[Azure SSO] JWKS fetch failed: {str(e)}")
                    return None
            
            # Find the correct key
            key = None
            for jwk_key in cached_jwks.get('keys', []):
                if jwk_key.get('kid') == kid:
                    key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk_key))
                    break
                    
            if not key:
                logger.error(f"[Azure SSO] Could not find key {kid} in JWKS")
                return None
                
            # Verify signature
            payload = jwt.decode(
                token, 
                key, 
                algorithms=['RS256'],
                audience=self.azure_config['audience'],
                options={"verify_exp": True}
            )
            
            return payload
            
        except Exception as e:
            logger.error(f"[Azure SSO] Signature validation error: {str(e)}")
            return None

    def _resolve_superset_groups_with_fallback(self, group_guids: List[str], email: str) -> List[Dict[str, Any]]:
        if not group_guids:
            return []
            
        all_group_details = self._get_all_group_details(group_guids)
        
        # Filter to only dashboard, myportal, and betamyportal groups
        filtered_groups = []
        for group in all_group_details:
            display_name = group.get('DisplayName', '').lower()
            normalized_name = group.get('NormalizedGroupName', '').lower()
            
            # Only process groups that:
            # 1. Start with "dashboard"
            # 2. Contain "myportal" 
            # 3. Contain "betamyportal"
            if (display_name.startswith('dashboard') or 
                'myportal' in display_name or 
                'betamyportal' in display_name or
                'myportal' in normalized_name or 
                'betamyportal' in normalized_name):
                filtered_groups.append(group)
                
        logger.info(f"[Azure SSO] Filtered {len(filtered_groups)} relevant groups from {len(group_guids)} total groups for {email}")
        
        if not filtered_groups:
            logger.warning(f"[Azure SSO] No dashboard/myportal groups found for {email} - denying access")
            return []
            
        def primary_lookup():
            filtered_group_guids = [g['GroupId'] for g in filtered_groups]
            return self._query_azure_sql_groups(filtered_group_guids)
            
        try:
            result = primary_lookup()
            return result
        except Exception as e:
            logger.error(f"[Azure SSO] Azure SQL database unavailable - denying access for security")
            logger.error(f"[Azure SSO] Database error: {str(e)}")
            return []

    def _get_all_group_details(self, group_guids: List[str]) -> List[Dict[str, Any]]:
        """
        Get basic group details for filtering (DisplayName, NormalizedGroupName)
        """
        if not group_guids:
            return []
            
        try:
            placeholders = ','.join([f"'{guid}'" for guid in group_guids])
            query = f"""
            SELECT GroupId, DisplayName, NormalizedGroupName
            FROM dbo.ActiveEntraGroups 
            WHERE GroupId IN ({placeholders})
            """
            
            azure_sql_engine = current_app.config.get('AZURE_SQL_ENGINE')
            if not azure_sql_engine:
                raise Exception("AZURE_SQL_ENGINE not configured")
                
            with azure_sql_engine.connect() as conn:
                result = conn.execute(text(query))
                groups = []
                for row in result:
                    groups.append({
                        'GroupId': str(row[0]),
                        'DisplayName': row[1],
                        'NormalizedGroupName': row[2] or ''
                    })
                return groups
                
        except Exception as e:
            logger.error(f"[Azure SSO] Error fetching group details: {str(e)}")
            return [{'GroupId': guid, 'DisplayName': '', 'NormalizedGroupName': ''} for guid in group_guids]

    def _query_azure_sql_groups(self, group_guids: List[str]) -> List[Dict[str, Any]]:
        if not group_guids:
            return []
            
        try:
            placeholders = ','.join([f"'{guid}'" for guid in group_guids])
            query = f"""
            SELECT 
                GroupId, 
                DisplayName, 
                NormalizedGroupName,
                GroupDescription,
                DisplayName as SupersetRole
            FROM dbo.ActiveEntraGroups 
            WHERE GroupId IN ({placeholders})
            ORDER BY DisplayName
            """
            
            # Execute with connection pooling
            azure_sql_engine = current_app.config.get('AZURE_SQL_ENGINE')
            if not azure_sql_engine:
                raise Exception("AZURE_SQL_ENGINE not configured")
                
            with azure_sql_engine.connect() as conn:
                result = conn.execute(text(query))
                rows = result.fetchall()
                
                # Convert to dict format
                groups = []
                for row in rows:
                    groups.append({
                        'GroupId': row[0],
                        'DisplayName': row[1], 
                        'NormalizedGroupName': row[2],
                        'GroupDescription': row[3],
                        'SupersetRole': row[4]
                    })
                
            logger.info(f"[Azure SSO] Found {len(groups)} groups from ActiveEntraGroups view (searched {len(group_guids)} GUIDs)")
            
            if groups:
                sample_group = groups[0]
                logger.debug(f"[Azure SSO] Sample group: {sample_group['DisplayName']} -> {sample_group['SupersetRole']}")
                
            return groups
            
        except SQLAlchemyError as e:
            logger.error(f"[Azure SSO] SQL query error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"[Azure SSO] Group resolution error: {str(e)}")
            raise

    def _find_or_create_user_with_auto_roles(self, email: str, user_data: Dict[str, Any], 
                                           superset_groups: List[Dict[str, Any]]) -> Optional[User]:
        """
        Find or create user and auto-create roles based on group membership
        """
        # Find existing user
        user = self.find_user(email=email)
        
        if not user:
            # Create new user
            first_name = user_data.get('given_name', email.split('@')[0])
            last_name = user_data.get('family_name', '')
            
            user = self.add_user(
                username=email,
                first_name=first_name,
                last_name=last_name,
                email=email,
                role=[]  # Will be set below
            )
            logger.info(f"[Azure SSO] Created new user: {email}")
        
        # Determine and create roles based on groups
        new_role_names = self._determine_roles_from_groups(superset_groups)
        new_roles = []
        
        for role_name in new_role_names:
            role = self._ensure_role_exists_with_permissions(role_name)
            if role:
                new_roles.append(role)
                
        # Update user roles
        if new_roles:
            user.roles = new_roles
            self.get_session.commit()
            
            role_names = [role.name for role in new_roles]
            logger.info(f"[Azure SSO] Assigned roles {role_names} to {email}")
            
            # Audit log
            self._audit_log_role_assignment(email, role_names, superset_groups)
        
        return user

    def _ensure_role_exists_with_permissions(self, role_name: str) -> Optional[Role]:
        """
        Ensure role exists in database, create with appropriate permissions if needed
        """
        role = self.find_role(role_name)
        if role:
            return role
            
        logger.info(f"[Azure SSO] Auto-creating role: {role_name}")
        
        try:
            role = self.add_role(role_name)
            
            # Set permissions based on role type
            if role_name in ['Admin', 'Alpha', 'Gamma', 'Public']:
                # Copy from builtin Superset roles
                self.copy_role(role_name, role_name, merge=False)
            else:
                # Custom group-based role - inherit from Gamma (dashboard viewer)
                self.copy_role('Gamma', role_name, merge=False)
                
            self.get_session.commit()
            logger.info(f"[Azure SSO] Successfully created role: {role_name}")
            return role
            
        except Exception as e:
            logger.error(f"[Azure SSO] Failed to create role {role_name}: {str(e)}")
            return None

    def _determine_roles_from_groups(self, superset_groups: List[Dict[str, Any]]) -> Set[str]:
        """
        Map group display names to Superset roles
        """
        roles = set()
        
        for group in superset_groups:
            superset_role = group.get('SupersetRole')
            if superset_role and superset_role.strip():
                roles.add(superset_role)
            
        return roles

    def _cache_user_session(self, email: str, user_data: Dict[str, Any], 
                           group_guids: List[str], auth_method: str):
        """
        Cache user session
        """
        session_key = self._generate_secure_session_key(email)
        
        cache_data = {
            'user_data': user_data,
            'group_guids': group_guids,
            'auth_method': auth_method,
            'timestamp': time.time(),
            'ip_address': request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', 'unknown')[:100]  # Truncate
        }
        
        # Cache for 1 hour using Flask-Caching
        self.cache.set(f"azure_session:{session_key}", cache_data, timeout=3600)        
        session['azure_user_email'] = email
        session['azure_auth_method'] = auth_method
        session['azure_auth_time'] = time.time()
        
        logger.info(f"[Azure SSO] Cached session for {email} via {auth_method}")

    def _audit_log_role_assignment(self, email: str, role_names: List[str], 
                                  groups: List[Dict[str, Any]]):
        """
        Comprehensive audit logging for compliance
        """
        audit_data = {
            'timestamp': time.time(),
            'user_email': email,
            'assigned_roles': role_names,
            'source_groups': [
                {
                    'guid': group['GroupId'], 
                    'name': group['DisplayName'],
                    'role': group.get('SupersetRole', 'Unknown')
                } 
                for group in groups
            ],
            'ip_address': request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', 'unknown')[:100]
        }
        
        logger.info(f"[Azure SSO Audit] Role assignment: {json.dumps(audit_data)}")

    def oauth_user_info(self, provider: str, response: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Extract user info from OAuth response for direct Azure AD login
        """
        if provider.lower() == 'azure' and response:
            access_token = response.get('access_token')
            if access_token:
                # Get user info and groups from Microsoft Graph
                return self._get_user_info_from_graph(access_token)
                
        return super().oauth_user_info(provider, response)

    def _get_user_info_from_graph(self, access_token: str) -> Dict[str, Any]:
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            
            # Get user profile
            user_response = requests.get(
                'https://graph.microsoft.com/v1.0/me',
                headers=headers,
                timeout=10
            )
            user_response.raise_for_status()
            user_data = user_response.json()
            
            try:
                groups_response = requests.get(
                    'https://graph.microsoft.com/v1.0/me/memberOf?$top=999',  # Limit to 999
                    headers=headers,
                    timeout=15
                )
                groups_response.raise_for_status()
                groups_data = groups_response.json()
                group_guids = [group['id'] for group in groups_data.get('value', [])]
                user_data['groups'] = group_guids
                
                logger.info(f"[Azure SSO] Graph API: {len(group_guids)} groups for {user_data.get('userPrincipalName')}")
                
            except Exception as group_error:
                logger.warning(f"[Azure SSO] Could not fetch groups: {str(group_error)}")
                user_data['groups'] = [] 
            
            return user_data
            
        except Exception as e:
            logger.error(f"[Azure SSO] Graph API error: {str(e)}")
            return {}

    def cleanup_expired_cache(self):
        logger.debug("[Azure SSO] Flask-Caching handles automatic cleanup")