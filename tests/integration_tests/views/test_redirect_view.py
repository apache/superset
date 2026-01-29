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

from urllib.parse import quote

from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags


class TestRedirectView(SupersetTestCase):
    """Test the redirect view functionality"""

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_warning_external_url(self):
        """Test that external URLs show the warning page (React SPA)"""
        external_url = "https://evil.com/phishing"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should return 200 and serve the React SPA
        assert response.status_code == 200
        # The SPA shell should be returned (contains the app div)
        assert b'id="app"' in response.data

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_warning_multiple_external_urls(self):
        """Test various external URLs return the SPA"""
        external_urls = [
            "https://google.com",
            "http://example.org/page",
            "https://github.com/apache/superset",
        ]

        for url in external_urls:
            encoded_url = quote(url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should serve the React SPA for all external URLs
            assert response.status_code == 200

    @with_feature_flags(ALERT_REPORTS=True)
    @with_config({"WEBDRIVER_BASEURL": "http://localhost:8088/"})
    def test_redirect_internal_url_direct_redirect(self):
        """Test that internal URLs redirect directly without warning"""
        internal_url = "http://localhost:8088/dashboard/1"
        encoded_url = quote(internal_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should redirect directly to the internal URL
        assert response.status_code in (301, 302, 303, 307, 308)
        assert response.location == internal_url

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_no_url_parameter(self):
        """Test redirect endpoint without URL parameter"""
        response = self.client.get("/redirect/")

        # Should return 400 Bad Request
        assert response.status_code == 400

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_empty_url_parameter(self):
        """Test redirect endpoint with empty URL parameter"""
        response = self.client.get("/redirect/?url=")

        # Should return 400 Bad Request
        assert response.status_code == 400

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_malformed_url(self):
        """Test redirect with malformed URL encoding"""
        # Send a malformed percent-encoded URL
        response = self.client.get("/redirect/?url=%ZZ%XX%YY")

        # Should handle gracefully
        assert response.status_code in (200, 400)

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_accessible_without_authentication(self):
        """Test that redirect endpoint is accessible without authentication"""
        # Without login - should still work (no redirect to login)
        external_url = "https://external-site.com"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should return 200 (SPA) not redirect to login
        assert response.status_code == 200

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_blocks_dangerous_schemes(self):
        """Test that dangerous URL schemes are blocked"""
        dangerous_urls = [
            "javascript:alert('XSS')",
            "data:text/html,<script>alert('XSS')</script>",
            "vbscript:msgbox('XSS')",
            "file:///etc/passwd",
        ]

        for dangerous_url in dangerous_urls:
            encoded_url = quote(dangerous_url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should return 400 for dangerous schemes
            assert response.status_code == 400

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_whitespace_url_parameter(self):
        """Test redirect endpoint with whitespace-only URL parameter"""
        response = self.client.get("/redirect/?url=   ")

        # Should return 400 Bad Request
        assert response.status_code == 400

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_case_insensitive_dangerous_schemes(self):
        """Test that scheme detection is case-insensitive"""
        dangerous_urls = [
            "JAVASCRIPT:alert('XSS')",
            "Data:text/html,<script>alert('XSS')</script>",
            "VBScript:msgbox('XSS')",
            "FILE:///etc/passwd",
        ]

        for dangerous_url in dangerous_urls:
            encoded_url = quote(dangerous_url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should return 400 for dangerous schemes regardless of case
            assert response.status_code == 400

    @with_feature_flags(ALERT_REPORTS=False)
    def test_redirect_feature_flag_disabled(self):
        """Test that redirect endpoint returns 404 when ALERT_REPORTS is disabled"""
        external_url = "https://external.com"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should return 404 when feature is disabled
        assert response.status_code == 404

    @with_feature_flags(ALERT_REPORTS=True)
    @with_config({"WEBDRIVER_BASEURL": "https://superset.company.com/"})
    def test_redirect_with_configured_base_url(self):
        """Test redirect with a configured base URL"""
        # Test internal URL with configured base
        internal_url = "https://superset.company.com/dashboard/list"
        encoded_url = quote(internal_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should redirect directly (internal)
        assert response.status_code in (301, 302, 303, 307, 308)

        # Test external URL
        external_url = "https://other.company.com/page"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should show warning page (external) - returns SPA
        assert response.status_code == 200

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_preserves_url_parameters(self):
        """Test that URL parameters are preserved"""
        url_with_params = "https://external.com/search?q=superset&page=1"
        encoded_url = quote(url_with_params, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should return successfully
        assert response.status_code == 200

    @with_feature_flags(ALERT_REPORTS=True)
    def test_redirect_handles_url_fragments(self):
        """Test that URL fragments (anchors) are handled"""
        url_with_fragment = "https://docs.example.com/guide#section-3"
        encoded_url = quote(url_with_fragment, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should return successfully
        assert response.status_code == 200
