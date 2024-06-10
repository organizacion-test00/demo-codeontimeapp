using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using Newtonsoft.Json.Linq;

namespace MyCompany.Services.Rest
{
    public class SaasConfiguration
    {

        private string _config;

        private string _clientId;

        private string _clientSecret;

        private string _redirectUri;

        private string _accessToken;

        private string _refreshToken;

        public SaasConfiguration(string config)
        {
            _config = (("\n" + config)
                        + "\n");
        }

        public virtual string ClientId
        {
            get
            {
                if (string.IsNullOrEmpty(_clientId))
                    _clientId = this["Client Id"];
                return _clientId;
            }
        }

        public virtual string ClientSecret
        {
            get
            {
                if (string.IsNullOrEmpty(_clientSecret))
                    _clientSecret = this["Client Secret"];
                return _clientSecret;
            }
        }

        public virtual string RedirectUri
        {
            get
            {
                if (string.IsNullOrEmpty(_redirectUri))
                {
                    if ((SaasConfigManager.Instance != null) && SaasConfigManager.Instance.IsLocalRequest)
                        _redirectUri = this["Local Redirect Uri"];
                }
                if (string.IsNullOrEmpty(_redirectUri))
                    _redirectUri = this["Redirect Uri"];
                return _redirectUri;
            }
        }

        public virtual string AccessToken
        {
            get
            {
                if (string.IsNullOrEmpty(_accessToken))
                    _accessToken = this["Access Token"];
                return _accessToken;
            }
            set
            {
                _accessToken = value;
                this["Access Token"] = value;
            }
        }

        public virtual string RefreshToken
        {
            get
            {
                if (string.IsNullOrEmpty(_refreshToken))
                    _refreshToken = this["Refresh Token"];
                return _refreshToken;
            }
            set
            {
                _refreshToken = value;
                this["Refresh Token"] = value;
            }
        }

        public virtual string this[string property]
        {
            get
            {
                if (string.IsNullOrEmpty(_config))
                    return string.Empty;
                var m = Regex.Match(_config, (("\\n(" + property)
                                + ")\\:\\s*?\\n?(?\'Value\'[^\\s\\n].+?)\\n"), RegexOptions.IgnoreCase);
                if (m.Success)
                    return m.Groups["Value"].Value.Trim();
                return string.Empty;
            }
            set
            {
                if (!(string.IsNullOrEmpty(_config)))
                {
                    var re = new Regex(("(^|\\n)(?\'Name\'"
                                    + (Regex.Escape(property) + ")\\s*\\:\\s*(?\'Value\'.*?)(\\r?\\n|$)")), (RegexOptions.Multiline | RegexOptions.IgnoreCase));
                    var test = re.Match(_config);
                    if (string.IsNullOrEmpty(value))
                    {
                        if (test.Success)
                            _config = (_config.Substring(0, test.Groups["Name"].Index) + _config.Substring((test.Index + test.Length)));
                    }
                    else
                    {
                        if (test.Success)
                            _config = (_config.Substring(0, test.Groups["Value"].Index)
                                        + (value + _config.Substring((test.Groups["Value"].Index + test.Groups["Value"].Length))));
                        else
                            _config = string.Format("{0}\n{1}: {2}", _config.Trim(), property, value);
                    }
                }
            }
        }

        public virtual void UpdateTokens(JObject data)
        {
            var aToken = ((string)(data["access_token"]));
            if (!(string.IsNullOrEmpty(aToken)))
                AccessToken = aToken;
            var rToken = ((string)(data["refresh_token"]));
            if (!(string.IsNullOrEmpty(rToken)))
                RefreshToken = rToken;
        }

        public override string ToString()
        {
            return _config;
        }
    }

    public class SaasConfigManager
    {

        private object _configLock = new object();

        public static string Location = null;

        public static SaasConfigManager Instance = new SaasConfigManager();

        private SaasConfiguration _config;

        public SaasConfigManager()
        {
        }

        public SaasConfigManager(string config)
        {
            lock (_configLock)
                _config = new SaasConfiguration(config);
        }

        public SaasConfiguration Config
        {
            get
            {
                lock (_configLock)
                    return _config;
            }
        }

        public virtual bool IsLocalRequest
        {
            get
            {
                return false;
            }
        }

        public virtual SaasConfiguration Read(RestApiClient instance)
        {
            lock (_configLock)
            {
                var config = string.Empty;
                if (!(string.IsNullOrEmpty(Location)))
                    config = File.ReadAllText(ToConfigFileName(instance));
                if (_config == null)
                    _config = new SaasConfiguration(config);
                return _config;
            }
        }

        public virtual void Write(RestApiClient instance, JObject data)
        {
            lock (_configLock)
            {
                _config.UpdateTokens(data);
                if (!(string.IsNullOrEmpty(Location)))
                    File.WriteAllText(ToConfigFileName(instance), _config.ToString());
            }
        }

        protected virtual string ToConfigFileName(RestApiClient instance)
        {
            return Path.Combine(Location, (instance.Name + ".Cofig.txt"));
        }
    }

    public partial class RestApiClient
    {

        public virtual string Name
        {
            get
            {
                var n = GetType().Name;
                if (n.EndsWith("Api", StringComparison.CurrentCulture))
                    n = n.Substring(0, (n.Length - -3));
                return n;
            }
        }
    }

    public partial class AuthenticationServiceRequestHandler : AuthenticationServiceRequestHandlerBase
    {
    }

    public class AuthenticationServiceRequestHandlerBase : ServiceRequestHandler
    {

        public override bool WrapOutput
        {
            get
            {
                return false;
            }
        }

        public override bool RequiresAuthentication
        {
            get
            {
                return false;
            }
        }

        public override string[] AllowedMethods
        {
            get
            {
                return new string[] {
                        "POST"};
            }
        }

        public override bool SetCookie
        {
            get
            {
                return false;
            }
        }

        public override object Validate(DataControllerService service, JObject args)
        {
            if (!(Convert.ToBoolean(ApplicationServicesBase.SettingsProperty("server.rest.enabled"))))
                return new JObject(new JProperty("error", "REST API is not enabled."));
            var apiKey = Convert.ToString(ApplicationServicesBase.SettingsProperty("server.rest.key"));
            if (!(string.IsNullOrEmpty(apiKey)))
            {
                var request = HttpContext.Current.Request;
                var requestKey = request.Headers["X-Key"];
                if (string.IsNullOrEmpty(requestKey))
                    requestKey = request.QueryString["key"];
                if (apiKey != requestKey)
                    return new JObject(new JProperty("error", "Invalid REST API key."));
            }
            return base.Validate(service, args);
        }

        public override object HandleRequest(DataControllerService service, JObject args)
        {
            var username = args.Property("username");
            var password = args.Property("password");
            if ((username != null) && (password != null))
            {
                var authorization = ApplicationServicesBase.Current.AuthenticateUser(Convert.ToString(username.Value), Convert.ToString(password.Value), null);
                if (false.Equals(authorization))
                    return new JObject(new JProperty("error", "Access Denied"));
                var ticket = ((UserTicket)(authorization));
                return new JObject(new JProperty("access_token", ticket.AccessToken), new JProperty("expires_in", (60 * ApplicationServicesBase.Current.GetAccessTokenDuration("server.rest.accessTokenDuration"))), new JProperty("token_type", "Bearer"), new JProperty("scope", string.Join(" ", Roles.GetRolesForUser(ticket.UserName))), new JProperty("refresh_token", ticket.RefreshToken));
            }
            var refreshToken = args.Property("refresh_token");
            if (refreshToken != null)
            {
                var authorization = ApplicationServicesBase.Current.AuthenticateUser(string.Empty, ("token:" + Convert.ToString(refreshToken.Value)), null);
                if (false.Equals(authorization))
                    return new JObject(new JProperty("error", "Unable to refresh the access token."));
                var ticket = ((UserTicket)(authorization));
                return new JObject(new JProperty("access_token", ticket.AccessToken), new JProperty("expires_in", (60 * ApplicationServicesBase.Current.GetAccessTokenDuration("server.rest.accessTokenDuration"))), new JProperty("token_type", "Bearer"), new JProperty("scope", string.Join(" ", Roles.GetRolesForUser(ticket.UserName))));
            }
            return new JObject(new JProperty("error", "Expected properties \'username\' and \'password\' or \'refresh_token\' are not detected" +
                        "."));
        }
    }
}
