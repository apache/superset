ace.define("ace/mode/apache_conf_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var ApacheConfHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 
            [ 'punctuation.definition.comment.apacheconf',
              'comment.line.hash.ini',
              'comment.line.hash.ini' ],
           regex: '^((?:\\s)*)(#)(.*$)' },
         { token: 
            [ 'punctuation.definition.tag.apacheconf',
              'entity.tag.apacheconf',
              'text',
              'string.value.apacheconf',
              'punctuation.definition.tag.apacheconf' ],
           regex: '(<)(Proxy|ProxyMatch|IfVersion|Directory|DirectoryMatch|Files|FilesMatch|IfDefine|IfModule|Limit|LimitExcept|Location|LocationMatch|VirtualHost)(?:(\\s)(.+?))?(>)' },
         { token: 
            [ 'punctuation.definition.tag.apacheconf',
              'entity.tag.apacheconf',
              'punctuation.definition.tag.apacheconf' ],
           regex: '(</)(Proxy|ProxyMatch|IfVersion|Directory|DirectoryMatch|Files|FilesMatch|IfDefine|IfModule|Limit|LimitExcept|Location|LocationMatch|VirtualHost)(>)' },
         { token: 
            [ 'keyword.alias.apacheconf', 'text',
              'string.regexp.apacheconf', 'text',
              'string.replacement.apacheconf', 'text' ],
           regex: '(Rewrite(?:Rule|Cond))(\\s+)(.+?)(\\s+)(.+?)($|\\s)' },
         { token: 
            [ 'keyword.alias.apacheconf', 'text',
              'entity.status.apacheconf', 'text',
              'string.regexp.apacheconf', 'text',
              'string.path.apacheconf', 'text' ],
           regex: '(RedirectMatch)(?:(\\s+)(\\d\\d\\d|permanent|temp|seeother|gone))?(\\s+)(.+?)(\\s+)(?:(.+?)($|\\s))?' },
         { token: 
            [ 'keyword.alias.apacheconf', 'text', 
              'entity.status.apacheconf', 'text',
              'string.path.apacheconf', 'text',
              'string.path.apacheconf', 'text' ],
           regex: '(Redirect)(?:(\\s+)(\\d\\d\\d|permanent|temp|seeother|gone))?(\\s+)(.+?)(\\s+)(?:(.+?)($|\\s))?' },
         { token: 
            [ 'keyword.alias.apacheconf', 'text',
              'string.regexp.apacheconf', 'text',
              'string.path.apacheconf', 'text' ],
           regex: '(ScriptAliasMatch|AliasMatch)(\\s+)(.+?)(\\s+)(?:(.+?)(\\s))?' },
         { token: 
            [ 'keyword.alias.apacheconf', 'text',
              'string.path.apacheconf', 'text',
              'string.path.apacheconf', 'text' ],
           regex: '(RedirectPermanent|RedirectTemp|ScriptAlias|Alias)(\\s+)(.+?)(\\s+)(?:(.+?)($|\\s))?' },
         { token: 'keyword.core.apacheconf',
           regex: '\\b(?:AcceptPathInfo|AccessFileName|AddDefaultCharset|AddOutputFilterByType|AllowEncodedSlashes|AllowOverride|AuthName|AuthType|CGIMapExtension|ContentDigest|DefaultType|DocumentRoot|EnableMMAP|EnableSendfile|ErrorDocument|ErrorLog|FileETag|ForceType|HostnameLookups|IdentityCheck|Include|KeepAlive|KeepAliveTimeout|LimitInternalRecursion|LimitRequestBody|LimitRequestFields|LimitRequestFieldSize|LimitRequestLine|LimitXMLRequestBody|LogLevel|MaxKeepAliveRequests|NameVirtualHost|Options|Require|RLimitCPU|RLimitMEM|RLimitNPROC|Satisfy|ScriptInterpreterSource|ServerAdmin|ServerAlias|ServerName|ServerPath|ServerRoot|ServerSignature|ServerTokens|SetHandler|SetInputFilter|SetOutputFilter|TimeOut|TraceEnable|UseCanonicalName)\\b' },
         { token: 'keyword.mpm.apacheconf',
           regex: '\\b(?:AcceptMutex|AssignUserID|BS2000Account|ChildPerUserID|CoreDumpDirectory|EnableExceptionHook|Group|Listen|ListenBacklog|LockFile|MaxClients|MaxMemFree|MaxRequestsPerChild|MaxRequestsPerThread|MaxSpareServers|MaxSpareThreads|MaxThreads|MaxThreadsPerChild|MinSpareServers|MinSpareThreads|NumServers|PidFile|ReceiveBufferSize|ScoreBoardFile|SendBufferSize|ServerLimit|StartServers|StartThreads|ThreadLimit|ThreadsPerChild|ThreadStackSize|User|Win32DisableAcceptEx)\\b' },
         { token: 'keyword.access.apacheconf',
           regex: '\\b(?:Allow|Deny|Order)\\b' },
         { token: 'keyword.actions.apacheconf',
           regex: '\\b(?:Action|Script)\\b' },
         { token: 'keyword.alias.apacheconf',
           regex: '\\b(?:Alias|AliasMatch|Redirect|RedirectMatch|RedirectPermanent|RedirectTemp|ScriptAlias|ScriptAliasMatch)\\b' },
         { token: 'keyword.auth.apacheconf',
           regex: '\\b(?:AuthAuthoritative|AuthGroupFile|AuthUserFile)\\b' },
         { token: 'keyword.auth_anon.apacheconf',
           regex: '\\b(?:Anonymous|Anonymous_Authoritative|Anonymous_LogEmail|Anonymous_MustGiveEmail|Anonymous_NoUserID|Anonymous_VerifyEmail)\\b' },
         { token: 'keyword.auth_dbm.apacheconf',
           regex: '\\b(?:AuthDBMAuthoritative|AuthDBMGroupFile|AuthDBMType|AuthDBMUserFile)\\b' },
         { token: 'keyword.auth_digest.apacheconf',
           regex: '\\b(?:AuthDigestAlgorithm|AuthDigestDomain|AuthDigestFile|AuthDigestGroupFile|AuthDigestNcCheck|AuthDigestNonceFormat|AuthDigestNonceLifetime|AuthDigestQop|AuthDigestShmemSize)\\b' },
         { token: 'keyword.auth_ldap.apacheconf',
           regex: '\\b(?:AuthLDAPAuthoritative|AuthLDAPBindDN|AuthLDAPBindPassword|AuthLDAPCharsetConfig|AuthLDAPCompareDNOnServer|AuthLDAPDereferenceAliases|AuthLDAPEnabled|AuthLDAPFrontPageHack|AuthLDAPGroupAttribute|AuthLDAPGroupAttributeIsDN|AuthLDAPRemoteUserIsDN|AuthLDAPUrl)\\b' },
         { token: 'keyword.autoindex.apacheconf',
           regex: '\\b(?:AddAlt|AddAltByEncoding|AddAltByType|AddDescription|AddIcon|AddIconByEncoding|AddIconByType|DefaultIcon|HeaderName|IndexIgnore|IndexOptions|IndexOrderDefault|ReadmeName)\\b' },
         { token: 'keyword.cache.apacheconf',
           regex: '\\b(?:CacheDefaultExpire|CacheDisable|CacheEnable|CacheForceCompletion|CacheIgnoreCacheControl|CacheIgnoreHeaders|CacheIgnoreNoLastMod|CacheLastModifiedFactor|CacheMaxExpire)\\b' },
         { token: 'keyword.cern_meta.apacheconf',
           regex: '\\b(?:MetaDir|MetaFiles|MetaSuffix)\\b' },
         { token: 'keyword.cgi.apacheconf',
           regex: '\\b(?:ScriptLog|ScriptLogBuffer|ScriptLogLength)\\b' },
         { token: 'keyword.cgid.apacheconf',
           regex: '\\b(?:ScriptLog|ScriptLogBuffer|ScriptLogLength|ScriptSock)\\b' },
         { token: 'keyword.charset_lite.apacheconf',
           regex: '\\b(?:CharsetDefault|CharsetOptions|CharsetSourceEnc)\\b' },
         { token: 'keyword.dav.apacheconf',
           regex: '\\b(?:Dav|DavDepthInfinity|DavMinTimeout|DavLockDB)\\b' },
         { token: 'keyword.deflate.apacheconf',
           regex: '\\b(?:DeflateBufferSize|DeflateCompressionLevel|DeflateFilterNote|DeflateMemLevel|DeflateWindowSize)\\b' },
         { token: 'keyword.dir.apacheconf',
           regex: '\\b(?:DirectoryIndex|DirectorySlash)\\b' },
         { token: 'keyword.disk_cache.apacheconf',
           regex: '\\b(?:CacheDirLength|CacheDirLevels|CacheExpiryCheck|CacheGcClean|CacheGcDaily|CacheGcInterval|CacheGcMemUsage|CacheGcUnused|CacheMaxFileSize|CacheMinFileSize|CacheRoot|CacheSize|CacheTimeMargin)\\b' },
         { token: 'keyword.dumpio.apacheconf',
           regex: '\\b(?:DumpIOInput|DumpIOOutput)\\b' },
         { token: 'keyword.env.apacheconf',
           regex: '\\b(?:PassEnv|SetEnv|UnsetEnv)\\b' },
         { token: 'keyword.expires.apacheconf',
           regex: '\\b(?:ExpiresActive|ExpiresByType|ExpiresDefault)\\b' },
         { token: 'keyword.ext_filter.apacheconf',
           regex: '\\b(?:ExtFilterDefine|ExtFilterOptions)\\b' },
         { token: 'keyword.file_cache.apacheconf',
           regex: '\\b(?:CacheFile|MMapFile)\\b' },
         { token: 'keyword.headers.apacheconf',
           regex: '\\b(?:Header|RequestHeader)\\b' },
         { token: 'keyword.imap.apacheconf',
           regex: '\\b(?:ImapBase|ImapDefault|ImapMenu)\\b' },
         { token: 'keyword.include.apacheconf',
           regex: '\\b(?:SSIEndTag|SSIErrorMsg|SSIStartTag|SSITimeFormat|SSIUndefinedEcho|XBitHack)\\b' },
         { token: 'keyword.isapi.apacheconf',
           regex: '\\b(?:ISAPIAppendLogToErrors|ISAPIAppendLogToQuery|ISAPICacheFile|ISAPIFakeAsync|ISAPILogNotSupported|ISAPIReadAheadBuffer)\\b' },
         { token: 'keyword.ldap.apacheconf',
           regex: '\\b(?:LDAPCacheEntries|LDAPCacheTTL|LDAPConnectionTimeout|LDAPOpCacheEntries|LDAPOpCacheTTL|LDAPSharedCacheFile|LDAPSharedCacheSize|LDAPTrustedCA|LDAPTrustedCAType)\\b' },
         { token: 'keyword.log.apacheconf',
           regex: '\\b(?:BufferedLogs|CookieLog|CustomLog|LogFormat|TransferLog|ForensicLog)\\b' },
         { token: 'keyword.mem_cache.apacheconf',
           regex: '\\b(?:MCacheMaxObjectCount|MCacheMaxObjectSize|MCacheMaxStreamingBuffer|MCacheMinObjectSize|MCacheRemovalAlgorithm|MCacheSize)\\b' },
         { token: 'keyword.mime.apacheconf',
           regex: '\\b(?:AddCharset|AddEncoding|AddHandler|AddInputFilter|AddLanguage|AddOutputFilter|AddType|DefaultLanguage|ModMimeUsePathInfo|MultiviewsMatch|RemoveCharset|RemoveEncoding|RemoveHandler|RemoveInputFilter|RemoveLanguage|RemoveOutputFilter|RemoveType|TypesConfig)\\b' },
         { token: 'keyword.misc.apacheconf',
           regex: '\\b(?:ProtocolEcho|Example|AddModuleInfo|MimeMagicFile|CheckSpelling|ExtendedStatus|SuexecUserGroup|UserDir)\\b' },
         { token: 'keyword.negotiation.apacheconf',
           regex: '\\b(?:CacheNegotiatedDocs|ForceLanguagePriority|LanguagePriority)\\b' },
         { token: 'keyword.nw_ssl.apacheconf',
           regex: '\\b(?:NWSSLTrustedCerts|NWSSLUpgradeable|SecureListen)\\b' },
         { token: 'keyword.proxy.apacheconf',
           regex: '\\b(?:AllowCONNECT|NoProxy|ProxyBadHeader|ProxyBlock|ProxyDomain|ProxyErrorOverride|ProxyFtpDirCharset|ProxyIOBufferSize|ProxyMaxForwards|ProxyPass|ProxyPassReverse|ProxyPreserveHost|ProxyReceiveBufferSize|ProxyRemote|ProxyRemoteMatch|ProxyRequests|ProxyTimeout|ProxyVia)\\b' },
         { token: 'keyword.rewrite.apacheconf',
           regex: '\\b(?:RewriteBase|RewriteCond|RewriteEngine|RewriteLock|RewriteLog|RewriteLogLevel|RewriteMap|RewriteOptions|RewriteRule)\\b' },
         { token: 'keyword.setenvif.apacheconf',
           regex: '\\b(?:BrowserMatch|BrowserMatchNoCase|SetEnvIf|SetEnvIfNoCase)\\b' },
         { token: 'keyword.so.apacheconf',
           regex: '\\b(?:LoadFile|LoadModule)\\b' },
         { token: 'keyword.ssl.apacheconf',
           regex: '\\b(?:SSLCACertificateFile|SSLCACertificatePath|SSLCARevocationFile|SSLCARevocationPath|SSLCertificateChainFile|SSLCertificateFile|SSLCertificateKeyFile|SSLCipherSuite|SSLEngine|SSLMutex|SSLOptions|SSLPassPhraseDialog|SSLProtocol|SSLProxyCACertificateFile|SSLProxyCACertificatePath|SSLProxyCARevocationFile|SSLProxyCARevocationPath|SSLProxyCipherSuite|SSLProxyEngine|SSLProxyMachineCertificateFile|SSLProxyMachineCertificatePath|SSLProxyProtocol|SSLProxyVerify|SSLProxyVerifyDepth|SSLRandomSeed|SSLRequire|SSLRequireSSL|SSLSessionCache|SSLSessionCacheTimeout|SSLUserName|SSLVerifyClient|SSLVerifyDepth)\\b' },
         { token: 'keyword.usertrack.apacheconf',
           regex: '\\b(?:CookieDomain|CookieExpires|CookieName|CookieStyle|CookieTracking)\\b' },
         { token: 'keyword.vhost_alias.apacheconf',
           regex: '\\b(?:VirtualDocumentRoot|VirtualDocumentRootIP|VirtualScriptAlias|VirtualScriptAliasIP)\\b' },
         { token: 
            [ 'keyword.php.apacheconf',
              'text',
              'entity.property.apacheconf',
              'text',
              'string.value.apacheconf',
              'text' ],
           regex: '\\b(php_value|php_flag)\\b(?:(\\s+)(.+?)(?:(\\s+)(.+?))?)?(\\s)' },
         { token: 
            [ 'punctuation.variable.apacheconf',
              'variable.env.apacheconf',
              'variable.misc.apacheconf',
              'punctuation.variable.apacheconf' ],
           regex: '(%\\{)(?:(HTTP_USER_AGENT|HTTP_REFERER|HTTP_COOKIE|HTTP_FORWARDED|HTTP_HOST|HTTP_PROXY_CONNECTION|HTTP_ACCEPT|REMOTE_ADDR|REMOTE_HOST|REMOTE_PORT|REMOTE_USER|REMOTE_IDENT|REQUEST_METHOD|SCRIPT_FILENAME|PATH_INFO|QUERY_STRING|AUTH_TYPE|DOCUMENT_ROOT|SERVER_ADMIN|SERVER_NAME|SERVER_ADDR|SERVER_PORT|SERVER_PROTOCOL|SERVER_SOFTWARE|TIME_YEAR|TIME_MON|TIME_DAY|TIME_HOUR|TIME_MIN|TIME_SEC|TIME_WDAY|TIME|API_VERSION|THE_REQUEST|REQUEST_URI|REQUEST_FILENAME|IS_SUBREQ|HTTPS)|(.*?))(\\})' },
         { token: [ 'entity.mime-type.apacheconf', 'text' ],
           regex: '\\b((?:text|image|application|video|audio)/.+?)(\\s)' },
         { token: 'entity.helper.apacheconf',
           regex: '\\b(?:from|unset|set|on|off)\\b',
           caseInsensitive: true },
         { token: 'constant.integer.apacheconf', regex: '\\b\\d+\\b' },
         { token: 
            [ 'text',
              'punctuation.definition.flag.apacheconf',
              'string.flag.apacheconf',
              'punctuation.definition.flag.apacheconf',
              'text' ],
           regex: '(\\s)(\\[)(.*?)(\\])(\\s)' } ] };
    
    this.normalizeRules();
};

ApacheConfHighlightRules.metaData = { fileTypes: 
       [ 'conf',
         'CONF',
         'htaccess',
         'HTACCESS',
         'htgroups',
         'HTGROUPS',
         'htpasswd',
         'HTPASSWD',
         '.htaccess',
         '.HTACCESS',
         '.htgroups',
         '.HTGROUPS',
         '.htpasswd',
         '.HTPASSWD' ],
      name: 'Apache Conf',
      scopeName: 'source.apacheconf' };


oop.inherits(ApacheConfHighlightRules, TextHighlightRules);

exports.ApacheConfHighlightRules = ApacheConfHighlightRules;
});

ace.define("ace/mode/folding/cstyle",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var Range = acequire("../../range").Range;
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(commentRegex) {
    if (commentRegex) {
        this.foldingStartMarker = new RegExp(
            this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
        );
        this.foldingStopMarker = new RegExp(
            this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
        );
    }
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
    
    this.foldingStartMarker = /([\{\[\(])[^\}\]\)]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{\(]*([\}\]\)])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
    this._getFoldWidgetBase = this.getFoldWidget;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
    
        if (this.singleLineBlockCommentRe.test(line)) {
            if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                return "";
        }
    
        var fw = this._getFoldWidgetBase(session, foldStyle, row);
    
        if (!fw && this.startRegionRe.test(line))
            return "start"; // lineCommentRegionStart
    
        return fw;
    };

    this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var line = session.getLine(row);
        
        if (this.startRegionRe.test(line))
            return this.getCommentRegionBlock(session, line, row);
        
        var match = line.match(this.foldingStartMarker);
        if (match) {
            var i = match.index;

            if (match[1])
                return this.openingBracketBlock(session, match[1], row, i);
                
            var range = session.getCommentFoldRange(row, i + match[0].length, 1);
            
            if (range && !range.isMultiLine()) {
                if (forceMultiline) {
                    range = this.getSectionRange(session, row);
                } else if (foldStyle != "all")
                    range = null;
            }
            
            return range;
        }

        if (foldStyle === "markbegin")
            return;

        var match = line.match(this.foldingStopMarker);
        if (match) {
            var i = match.index + match[0].length;

            if (match[1])
                return this.closingBracketBlock(session, match[1], row, i);

            return session.getCommentFoldRange(row, i, -1);
        }
    };
    
    this.getSectionRange = function(session, row) {
        var line = session.getLine(row);
        var startIndent = line.search(/\S/);
        var startRow = row;
        var startColumn = line.length;
        row = row + 1;
        var endRow = row;
        var maxRow = session.getLength();
        while (++row < maxRow) {
            line = session.getLine(row);
            var indent = line.search(/\S/);
            if (indent === -1)
                continue;
            if  (startIndent > indent)
                break;
            var subRange = this.getFoldWidgetRange(session, "all", row);
            
            if (subRange) {
                if (subRange.start.row <= startRow) {
                    break;
                } else if (subRange.isMultiLine()) {
                    row = subRange.end.row;
                } else if (startIndent == indent) {
                    break;
                }
            }
            endRow = row;
        }
        
        return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
    };
    this.getCommentRegionBlock = function(session, line, row) {
        var startColumn = line.search(/\s*$/);
        var maxRow = session.getLength();
        var startRow = row;
        
        var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
        var depth = 1;
        while (++row < maxRow) {
            line = session.getLine(row);
            var m = re.exec(line);
            if (!m) continue;
            if (m[1]) depth--;
            else depth++;

            if (!depth) break;
        }

        var endRow = row;
        if (endRow > startRow) {
            return new Range(startRow, startColumn, endRow, line.length);
        }
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/apache_conf",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/apache_conf_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var ApacheConfHighlightRules = acequire("./apache_conf_highlight_rules").ApacheConfHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = ApacheConfHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "#";
    this.$id = "ace/mode/apache_conf";
}).call(Mode.prototype);

exports.Mode = Mode;
});
