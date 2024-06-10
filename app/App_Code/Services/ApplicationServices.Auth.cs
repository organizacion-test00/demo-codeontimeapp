using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Data;
using System.Data.Common;
using System.Configuration;
using System.IO;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Threading;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Caching;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.Security;
using System.Web.SessionState;
using System.Web.Configuration;
using System.IO.Compression;
using System.Xml.XPath;
using System.Web.Routing;
using System.Drawing;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Handlers;
using MyCompany.Services.Rest;
using MyCompany.Web;

namespace MyCompany.Services
{
    public class UserTicket
    {

        [JsonProperty("name")]
        public string UserName;

        [JsonProperty("email")]
        public string Email;

        [JsonProperty("access_token")]
        public string AccessToken;

        [JsonProperty("refresh_token")]
        public string RefreshToken;

        [JsonProperty("picture")]
        public string Picture;

        [JsonProperty("claims")]
        public Dictionary<string, string> Claims = new Dictionary<string, string>();

        public UserTicket()
        {
        }

        public UserTicket(MembershipUser user)
        {
            UserName = user.UserName;
            Email = user.Email;
            Picture = ApplicationServices.Create().UserPictureString(user);
        }

        public UserTicket(MembershipUser user, string accessToken, string refreshToken) :
                this(user)
        {
            this.AccessToken = accessToken;
            this.RefreshToken = refreshToken;
        }
    }

    public partial class ApplicationServicesBase
    {

        public virtual int GetAccessTokenDuration(string fromSettings)
        {
            // 15 minutes
            var accessDuration = 15;
            JToken jTimeout = null;
            if (!(string.IsNullOrEmpty(fromSettings)))
            {
                jTimeout = TryGetJsonProperty(DefaultSettings, fromSettings);
                if (jTimeout != null)
                    accessDuration = ((int)(jTimeout));
            }
            return accessDuration;
        }

        public virtual int GetRefreshTokenDuration(string fromSettings)
        {
            // 60 minutes x 24 hours x 7 days = 10080 minutes
            var refreshDuration = ((60 * 24)
                        * 7);
            JToken jTimeout = null;
            if (!(string.IsNullOrEmpty(fromSettings)))
            {
                jTimeout = TryGetJsonProperty(DefaultSettings, fromSettings);
                if (jTimeout != null)
                    refreshDuration = ((int)(jTimeout));
            }
            return refreshDuration;
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken)
        {
            return CreateTicket(user, refreshToken, "membership.accountManager.accessTokenDuration", "membership.accountManager.refreshTokenDuration");
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken, string accessTokenDuration, string refreshTokenDuration)
        {
            return CreateTicket(user, refreshToken, GetAccessTokenDuration(accessTokenDuration), GetRefreshTokenDuration(refreshTokenDuration));
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken, int accessTokenDuration, int refreshTokenDuration)
        {
            var userData = string.Empty;
            var handler = OAuthHandlerFactory.GetActiveHandler();
            if (handler != null)
                userData = ("OAUTH:" + handler.GetHandlerName());
            var accessTicket = new FormsAuthenticationTicket(1, user.UserName, DateTime.Now, DateTime.Now.AddMinutes(accessTokenDuration), false, userData);
            if (string.IsNullOrEmpty(refreshToken))
            {
                var refreshTicket = new FormsAuthenticationTicket(1, user.UserName, DateTime.Now, DateTime.Now.AddMinutes(refreshTokenDuration), false, "REFRESHONLY");
                refreshToken = FormsAuthentication.Encrypt(refreshTicket);
            }
            return new UserTicket(user, FormsAuthentication.Encrypt(accessTicket), refreshToken);
        }

        public virtual bool ValidateTicket(FormsAuthenticationTicket ticket)
        {
            return !(((ticket == null) || (ticket.Expired || string.IsNullOrEmpty(ticket.Name))));
        }

        public virtual void InvalidateTicket(FormsAuthenticationTicket ticket)
        {
        }

        public virtual bool ValidateToken(string accessToken)
        {
            try
            {
                var ticket = FormsAuthentication.Decrypt(accessToken);
                if (ticket.UserData == "REFRESHONLY")
                    return false;
                if (ValidateTicket(ticket))
                {
                    HttpContext.Current.User = new RolePrincipal(new FormsIdentity(new FormsAuthenticationTicket(ticket.Name, false, 10)));
                    return true;
                }
            }
            catch (Exception)
            {
            }
            return false;
        }

        public virtual bool UserLogin(string username, string password, bool createPersistentCookie)
        {
            if (Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)) && Convert.ToBoolean(SettingsProperty("server.2FA.disableLoginPassword", false)))
            {
                var user = Membership.GetUser(username);
                if ((user == null) || user.IsLockedOut)
                    return false;
                var userAuthData = UserAuthenticationData(username);
                if (((userAuthData == null) || (userAuthData["2FA"] == null)) && !((Convert.ToString(SettingsProperty("server.2FA.setup.mode")) == "auto")))
                    return false;
                return true;
            }
            else
            {
                if (Membership.ValidateUser(username, password))
                    return true;
                else
                    return false;
            }
        }

        protected virtual int OtpAuthenticationDurationOfTrust()
        {
            return Convert.ToInt32(SettingsProperty("server.2FA.trustThisDevice", 180));
        }

        public virtual void UserLogout()
        {
            FormsAuthentication.SignOut();
            if (ApplicationServices.IsSiteContentEnabled)
            {
                var handler = OAuthHandlerFactory.GetActiveHandler();
                if (handler != null)
                    handler.SignOut();
            }
        }

        public virtual string[] UserRoles()
        {
            return Roles.GetRolesForUser();
        }

        public virtual object AuthenticateUser(string username, string password, System.Boolean? createPersistentCookie)
        {
            var response = HttpContext.Current.Response;
            if (password.StartsWith("token:"))
            {
                // validate token login
                try
                {
                    var key = password.Substring(6);
                    var ticket = FormsAuthentication.Decrypt(key);
                    if (ValidateTicket(ticket) && (!(string.IsNullOrEmpty(ticket.UserData)) && Regex.IsMatch(ticket.UserData, "^(REFRESHONLY$|OAUTH:)")))
                    {
                        var user = Membership.GetUser(ticket.Name);
                        if ((user != null) && (user.IsApproved && !user.IsLockedOut))
                        {
                            InvalidateTicket(ticket);
                            var cookie = new HttpCookie(".PROVIDER", string.Empty);
                            if (!(string.IsNullOrEmpty(ticket.UserData)) && ticket.UserData.StartsWith("OAUTH:"))
                            {
                                var handler = OAuthHandlerFactoryBase.Create(ticket.UserData.Substring(6));
                                if (handler != null)
                                {
                                    cookie.Value = handler.GetHandlerName();
                                    if (!(handler.ValidateRefreshToken(user, key)))
                                        return false;
                                }
                            }
                            if (createPersistentCookie.HasValue)
                            {
                                ApplicationServices.SetCookie(cookie);
                                FormsAuthentication.SetAuthCookie(user.UserName, createPersistentCookie.Value);
                            }
                            if (createPersistentCookie.HasValue)
                                return CreateTicket(user, key);
                            else
                                return CreateTicket(user, key, "server.rest.accessTokenDuration", "server.rest.refreshTokenDuration");
                        }
                    }
                }
                catch (Exception)
                {
                }
            }
            else
            {
                if (Regex.IsMatch(password, ";otpauth\\:\\w+;exec\\:\\w+\\;"))
                    return OtpAuth(username, password);
                else
                {
                    // login user
                    if (UserLogin(username, password, createPersistentCookie.Equals(true)))
                    {
                        var successResponse = CreateUserLoginResponse(username, true);
                        if ((successResponse != null) && AllowUserLoginResponse(username, successResponse))
                            return successResponse;
                        if (createPersistentCookie.HasValue)
                            FormsAuthentication.SetAuthCookie(username, createPersistentCookie.Value);
                        var user = Membership.GetUser(username);
                        if (user != null)
                        {
                            if (createPersistentCookie.HasValue)
                                return CreateTicket(user, null);
                            else
                                return CreateTicket(user, null, "server.rest.accessTokenDuration", "server.rest.refreshTokenDuration");
                        }
                    }
                    else
                    {
                        var failureResponse = CreateUserLoginResponse(username, false);
                        if (failureResponse != null)
                            return failureResponse;
                    }
                }
            }
            return false;
        }

        protected virtual void SkipUserLoginResponse()
        {
            HttpContext.Current.Items["ApplicationServices_SkipUserLoginResponse"] = true;
        }

        protected virtual object OtpAuth(string username, string password)
        {
            var totpSize = Convert.ToInt32(SettingsProperty("server.2FA.code.length", 6));
            var totpPeriod = Convert.ToInt32(SettingsProperty("server.2FA.code.period", 30));
            var backupCodeLength = Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.length", 8));
            var backupCodeCount = Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.count", 10));
            // prepare the otpauth arguments
            var args = new JObject(new JProperty("username", username));
            password = ("password:" + password);
            foreach (var vp in password.Split(';'))
            {
                var p = Regex.Match(vp, "^(\\w+)\\:(.+)$");
                if (p.Success)
                {
                    var v = p.Groups[2].Value;
                    object o = v;
                    if (v == "null")
                        o = null;
                    else
                    {
                        if ((v == "true") || (v == "false"))
                            o = Convert.ToBoolean(v);
                    }
                    var propName = p.Groups[1].Value;
                    args.Remove(propName);
                    args.Add(new JProperty(propName, o));
                }
            }
            password = Convert.ToString(args["password"]);
            var validationKey = ApplicationServices.ValidationKey;
            // execute the otpauth method
            var exec = Convert.ToString(args["exec"]);
            var result = new JObject();
            // ***** send verification code to the user *****
            if (exec == "send")
            {
                result["event"] = "otpauthtotpsetup_verificationcodesent.app";
                var method = Convert.ToString(args["method"]);
                var type = Convert.ToString(args["type"]);
                try
                {
                    var authData = OtpAuthenticationData(username, Convert.ToString(args["url"]));
                    var contacts = authData["verify"][type];
                    if (!((contacts is JArray)))
                        contacts = new JArray(contacts);
                    foreach (var c in contacts)
                    {
                        var contact = Convert.ToString(c);
                        if (TextUtility.Hash(contact) == method)
                        {
                            var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                            var code = new Totp(TextUtility.FromBase32String(secret), totpPeriod).Compute(DateTime.UtcNow.AddSeconds(totpPeriod), totpSize);
                            var message = string.Format(Regex.Replace(Convert.ToString(args["template"]), "\\d{5,}", "{0}"), code);
                            var confirmation = Convert.ToString(args["confirmation"]);
                            result["notify"] = OtpAuthenticationSendVerificationCode(code, type, contact, message, confirmation);
                            break;
                        }
                    }
                }
                catch (Exception ex)
                {
                    result["notify"] = ex.Message;
                }
            }
            // ***** validate the verification code *****
            if (exec == "login")
            {
                var authData = OtpAuthenticationData(username, Convert.ToString(args["url"]));
                var otpauthUrl = authData["otpauth"];
                var passcode = Convert.ToString(args["passcode"]);
                if ((otpauthUrl != null) && !(string.IsNullOrEmpty(passcode)))
                {
                    var secret = OtpAuthenticationSecretFrom(otpauthUrl);
                    var user = Membership.GetUser(username);
                    if (!(string.IsNullOrEmpty(secret)) && ((user != null) && !user.IsLockedOut))
                    {
                        var d = DateTime.UtcNow;
                        var maxDate = d.AddSeconds(120);
                        d = d.AddSeconds(((-1 * Math.Max(totpPeriod, Convert.ToInt32(SettingsProperty("server.2FA.code.window", 180))))
                                        - totpPeriod));
                        var authenticated = false;
                        while (d < maxDate)
                        {
                            var code = new Totp(TextUtility.FromBase32String(secret), totpPeriod).Compute(d, totpSize);
                            if (code == passcode)
                            {
                                authenticated = true;
                                break;
                            }
                            d = d.AddSeconds(totpPeriod);
                        }
                        if (!authenticated)
                        {
                            var backupCodes = new List<string>(Regex.Split(Convert.ToString(authData["backupCodes"]), "\\s*,\\s*"));
                            if (backupCodes.Contains(passcode))
                            {
                                authenticated = true;
                                backupCodes.Remove(passcode);
                                var newBackupCodes = string.Join(", ", backupCodes.ToArray());
                                if (string.IsNullOrEmpty(newBackupCodes))
                                    newBackupCodes = null;
                                UserAuthenticationData(username, new JObject(new JProperty("Backup Codes", newBackupCodes)));
                            }
                        }
                        if (authenticated)
                        {
                            // internal verification has been completed successfully
                            if (string.IsNullOrEmpty(password) && (HttpContext.Current.User.Identity.Name == username))
                                return true;
                            if (Convert.ToBoolean(args["trustThisDevice"]))
                                OtpAuthenticationTrustThisDevice(username, authData);
                            // return the user ticket to the client
                            SkipUserLoginResponse();
                            return AuthenticateUser(username, Convert.ToString(args["password"]), Convert.ToBoolean(args["createPersistentCookie"]));
                        }
                        else
                            Membership.ValidateUser(username, new Guid().ToString());
                    }
                }
                return false;
            }
            // ***** generate the new backup codes *****
            if (exec == "generate")
            {
                var secret = OtpAuthenticationSecretFrom(args["url"]);
                if (secret != null)
                {
                    result["event"] = "otpauthtotpsetup_backupcodesgeneratedone.app";
                    var backupCodes = new List<string>();
                    result.Add(new JProperty("newBackupCodes", new Totp(secret, totpPeriod).Compute(backupCodeLength, backupCodeCount)));
                }
                else
                    return false;
            }
            // ***** setup the 2-Factor Authentication *****
            if (exec == "setup")
            {
                var passcode = Convert.ToString(args["passcode"]);
                if (!(string.IsNullOrEmpty(password)))
                {
                    // new 2FA setup
                    var userAuthData = UserAuthenticationData(username);
                    if ((userAuthData != null) && (userAuthData["2FA"] != null))
                        return false;
                    SkipUserLoginResponse();
                    if ((password == validationKey) || UserLogin(username, password, false))
                    {
                        result["event"] = "otpauthtotpsetup.app";
                        result["otpauth"] = "totp";
                        result["username"] = username;
                        var secret = TextUtility.ToBase32String(TextUtility.GetUniqueKey(Convert.ToInt32(SettingsProperty("server.2FA.secret.length", 10))));
                        result["secret"] = secret;
                        result["url"] = string.Format("otpauth://totp/{0}?secret={1}&issuer={2}&algorithm=SHA1&digits={3}&period={4}", HttpUtility.UrlPathEncode(username), secret, HttpUtility.UrlEncode(Convert.ToString(SettingsProperty("appName", Name))), totpSize, totpPeriod);
                        result.Add(new JProperty("backupCodes", new Totp(TextUtility.ToBase32String(secret), totpPeriod).Compute(backupCodeLength, backupCodeCount)));
                    }
                    else
                        return false;
                }
                else
                {
                    if (!(string.IsNullOrEmpty(passcode)))
                    {
                        // existing or new 2FA setup
                        var newUrl = Convert.ToString(args["url"]);
                        var newBackupCodes = Convert.ToString(args["backupCodes"]);
                        object authenticated = (passcode == validationKey);
                        if (!(true.Equals(authenticated)))
                            authenticated = OtpAuth(username, string.Format("null;exec:login;passcode:{0};url:{1};backupCodes:{2}", passcode, newUrl, newBackupCodes));
                        if (true.Equals(authenticated))
                        {
                            if (!(string.IsNullOrEmpty(newUrl)))
                            {
                                // save the new or change the existing 2FA setup
                                string existingUrl = null;
                                var userAuthData = UserAuthenticationData(username);
                                if (userAuthData != null)
                                    existingUrl = Convert.ToString(userAuthData["2FA"]);
                                var setupType = "new";
                                // if there is an existing 2FA setup then it must match the new setup
                                if (!(string.IsNullOrEmpty(existingUrl)))
                                {
                                    if (newUrl != existingUrl)
                                        return false;
                                    setupType = "existing";
                                }
                                // save the setup to the database
                                var newUserAuthData = new JObject();
                                newUserAuthData["2FA"] = newUrl;
                                if (!(string.IsNullOrEmpty(newBackupCodes)))
                                    newUserAuthData["Backup Codes"] = newBackupCodes;
                                newUserAuthData["Methods"] = args["methods"];
                                UserAuthenticationData(username, newUserAuthData);
                                // inform the user about successful setup
                                result["event"] = "otpauthtotpsetup_complete.app";
                                result["setupType"] = setupType;
                            }
                            else
                            {
                                // existing 2FA setup
                                var userAuthData = UserAuthenticationData(username);
                                var secret = OtpAuthenticationSecretFrom(userAuthData["2FA"]);
                                if (secret != null)
                                {
                                    result["event"] = "otpauthtotpsetup.app";
                                    result["otpauth"] = "totp";
                                    result["username"] = username;
                                    result.Add(new JProperty("url", userAuthData["2FA"]));
                                    result.Add(new JProperty("secret", secret));
                                    result.Add(new JProperty("backupCodes", Regex.Split(Convert.ToString(userAuthData["Backup Codes"]), "\\s*,\\s*")));
                                    var methods = Convert.ToString(userAuthData["Methods"]);
                                    if (string.IsNullOrEmpty(methods))
                                        methods = "app,email";
                                    methods = Regex.Replace(methods.ToLower(), "\\s+", string.Empty);
                                    result.Add(new JProperty("methods", methods));
                                    result.Add(new JProperty("status", "ready"));
                                }
                                else
                                    return false;
                            }
                        }
                        else
                            return false;
                    }
                }
                if (result["event"] == null)
                {
                    result["event"] = "otpauthtotpsetup_confirm.app";
                    JObject userAuthData = null;
                    var newUrl = Convert.ToString(args["url"]);
                    var newBackupCodes = Convert.ToString(args["backupCodes"]);
                    var newMethods = Convert.ToString(args["methods"]);
                    if (!(string.IsNullOrEmpty(newUrl)))
                    {
                        userAuthData = new JObject();
                        userAuthData["2FA"] = newUrl;
                        userAuthData["Backup Codes"] = newBackupCodes;
                        userAuthData["Methods"] = newMethods;
                    }
                    var authData = CreateUserLoginResponse(username, true, userAuthData);
                    // options "url" and "backupCodes" are provided by the setup when Enable/Save is pressed
                    if (authData == null)
                        authData = new JObject(new JProperty("otpauth", newUrl));
                    var otpauthUrl = Convert.ToString(authData["otpauth"]);
                    if (!((Convert.ToString(args["consent"]) == "Enable")) && !(string.IsNullOrEmpty(newUrl)))
                    {
                        // do not remove 2FA if the client URL does not match the 2FA option in the User Authorization Data
                        userAuthData = UserAuthenticationData(username);
                        if ((userAuthData != null) && !((newUrl == Convert.ToString(userAuthData["2FA"]))))
                            return false;
                        // remove 2FA setup
                        UserAuthenticationData(username, new JObject(new JProperty("2FA", null), new JProperty("Backup Codes", null), new JProperty("Methods", null)));
                        result["event"] = "otpauthtotpsetup_complete.app";
                        result["setupType"] = "none";
                    }
                    else
                    {
                        if (!(string.IsNullOrEmpty(otpauthUrl)))
                        {
                            // ask the user to provide the verification code
                            result["confirm"] = "verification_code";
                            authData["canTrustThisDevice"] = false;
                            if (!(string.IsNullOrEmpty(newUrl)))
                            {
                                authData["url"] = newUrl;
                                authData["canEnterBackupCode"] = false;
                            }
                            if (!(string.IsNullOrEmpty(newBackupCodes)))
                                authData["backupCodes"] = newBackupCodes;
                            if (!(string.IsNullOrEmpty(newMethods)))
                                authData["methods"] = newMethods;
                        }
                        else
                        {
                            result["confirm"] = "password";
                            authData["otpauth"] = "totp";
                            authData["username"] = username;
                        }
                        authData["exec"] = "setup";
                        authData["verifyVia"] = SettingsProperty("server.2FA.verify", new JObject(new JProperty("app", true), new JProperty("email", true)));
                        var setup = SettingsProperty("server.2FA.setup");
                        if (setup != null)
                            authData["setup"] = setup;
                        result["options"] = authData;
                        authData["confirm"] = result["confirm"];
                    }
                }
            }
            return result;
        }

        protected virtual string OtpAuthenticationSendVerificationCode(string code, string type, string contact, string message, string confirmation)
        {
            if (type == "email")
            {
                var mail = new MailMessage()
                {
                    Subject = message,
                    Body = code
                };
                mail.To.Add(new MailAddress(contact));
                var client = new SmtpClient();
                client.Send(mail);
            }
            return confirmation;
        }

        protected virtual bool OtpAuthenticationTrustThisDevice(string username, JObject authData)
        {
            var result = false;
            try
            {
                var userTrust = new SortedDictionary<string, string>();
                var cookie = HttpContext.Current.Request.Cookies[".trustThis"];
                if (cookie != null)
                {
                    // Sample: 05343490152021-09-16T08:22:44.0435998Zadmin
                    // enumerate existing trusts
                    var s = StringEncryptor.FromBase64String(cookie.Value);
                    var iterator = Regex.Match(s, "(?\'Passcode\'\\d{10})(?\'Date\'\\d{4}-\\d{2}-\\d{2}T\\d{2}\\:\\d{2}\\:\\d{2}\\.\\d{7}Z)(?\'UserN" +
                            "ame\'.+?)(\\s|$)");
                    while (iterator.Success)
                    {
                        userTrust[iterator.Groups["UserName"].Value] = (iterator.Groups["Passcode"].Value + iterator.Groups["Date"].Value);
                        iterator = iterator.NextMatch();
                    }
                }
                if (authData == null)
                {
                    string trustInfo = null;
                    authData = OtpAuthenticationData(username);
                    if ((authData != null) && userTrust.TryGetValue(username, out trustInfo))
                    {
                        var passcode = trustInfo.Substring(0, 10);
                        var d = DateTime.Parse(trustInfo.Substring(10));
                        var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                        var expectedPasscode = new Totp(TextUtility.FromBase32String(secret), 30).Compute(d.ToUniversalTime(), 10);
                        if (passcode == expectedPasscode)
                            result = true;
                        else
                            userTrust.Remove(username);
                    }
                }
                else
                {
                    // create a trust entry
                    var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                    if (!(string.IsNullOrEmpty(secret)))
                    {
                        var d = DateTime.UtcNow;
                        var passcode = new Totp(TextUtility.FromBase32String(secret), 30).Compute(d, 10);
                        userTrust[username] = string.Format("{0}{1:o}", passcode, d);
                    }
                }
                // set the .trustThis cookie
                if (userTrust.Count > 0)
                {
                    var list = new List<string>();
                    foreach (string name in userTrust.Keys)
                        list.Add((userTrust[name] + name));
                    var newTrust = StringEncryptor.ToBase64String(string.Join("\\n", list.ToArray()));
                    if ((cookie == null) || cookie.Value != newTrust)
                    {
                        cookie = new HttpCookie(".trustThis", newTrust)
                        {
                            Expires = DateTime.Now.AddDays(OtpAuthenticationDurationOfTrust())
                        };
                        ApplicationServices.SetCookie(cookie);
                    }
                }
                else
                {
                    if (cookie != null)
                    {
                        cookie.Expires = DateTime.Now.AddDays(-10);
                        cookie.Value = null;
                        ApplicationServices.SetCookie(cookie);
                    }
                }
            }
            catch (Exception)
            {
                // ignore all exceptions
            }
            return result;
        }

        protected virtual string OtpAuthenticationSecretFrom(JToken url)
        {
            return OtpAuthenticationSecretFrom(Convert.ToString(url));
        }

        protected virtual string OtpAuthenticationSecretFrom(string url)
        {
            var secretParam = Regex.Match(Convert.ToString(url), "(\\?|&)secret=(?\'Secret\'.+?)(&|$)");
            if (secretParam.Success)
                return secretParam.Groups["Secret"].Value;
            return null;
        }

        protected virtual JObject CreateUserLoginResponse(string username, bool success)
        {
            return CreateUserLoginResponse(username, success, null);
        }

        protected virtual JObject CreateUserLoginResponse(string username, bool success, JObject userAuthData)
        {
            if (success)
            {
                if (HttpContext.Current.Items.Contains("ApplicationServices_SkipUserLoginResponse"))
                    HttpContext.Current.Items.Remove("ApplicationServices_SkipUserLoginResponse");
                else
                {
                    if (userAuthData == null)
                        OtpAuthenticationActivate(username);
                    var authData = OtpAuthenticationData(username, userAuthData);
                    if (authData["otpauth"] != null)
                    {
                        authData["event"] = "otpauth.app";
                        authData["username"] = username;
                        authData["success"] = success;
                        authData["otpauth"] = authData["type"];
                        authData["confirm"] = "verification_code";
                        var verify = authData["verify"];
                        if (verify != null)
                        {
                            var callMe = verify["call"];
                            if (callMe != null)
                                verify["call"] = EncodeContactInformation(callMe, "call");
                            var smsMe = verify["sms"];
                            if (smsMe != null)
                                verify["sms"] = EncodeContactInformation(smsMe, "sms");
                            var emailMe = verify["email"];
                            if (emailMe != null)
                                verify["email"] = EncodeContactInformation(emailMe, "email");
                            var dialTo = verify["dial"];
                            if (dialTo != null)
                                verify["dial"] = EncodeContactInformation(dialTo, "dial");
                        }
                        if (OtpAuthenticationDurationOfTrust() == 0)
                            authData["canTrustThisDevice"] = false;
                        // remove sensitive data
                        authData.Remove("type");
                        authData.Remove("backupCodes");
                        return authData;
                    }
                }
            }
            return null;
        }

        protected virtual void OtpAuthenticationActivate(string username)
        {
            if (Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)) && (Convert.ToString(SettingsProperty("server.2FA.setup.mode", "user")) == "auto"))
                try
                {
                    var userAuthData = UserAuthenticationData(username);
                    if ((userAuthData == null) || ((userAuthData["Source"] == null) && (userAuthData["2FA"] == null)))
                    {
                        // get the 2FA setup data
                        var setupObject = OtpAuth(username, string.Format("null;otpauth:totp;exec:setup;password:{0};", ApplicationServices.ValidationKey));
                        if ((setupObject != null) && (setupObject is JObject))
                        {
                            // enumerate the verification methods
                            var setupMethods = SettingsProperty("server.2FA.setup.methods");
                            var methods = new List<string>();
                            if (setupMethods != null)
                                foreach (JProperty p in setupMethods)
                                    if (((p.Type == JTokenType.Property) && (p.Value.Type == JTokenType.Boolean)) && Convert.ToBoolean(p.Value))
                                        methods.Add(p.Name);
                            if (methods.Count == 0)
                                methods.Add("email");
                            // save the 2FA setup data
                            var setupData = ((JObject)(setupObject));
                            var backupCodes = ((JArray)(setupData["backupCodes"]));
                            if (backupCodes == null)
                                backupCodes = new JArray();
                            OtpAuth(username, string.Format("null;otpauth:totp;exec:setup;passcode:{0};trustThisDevice:false;url:{1};backupCod" +
                                        "es:{2};methods:{3};", ApplicationServices.ValidationKey, setupData["url"], string.Join(", ", backupCodes), string.Join(",", methods.ToArray())));
                        }
                    }
                }
                catch (Exception)
                {
                    // ignore all errors
                }
        }

        protected virtual bool AllowUserLoginResponse(string username, JObject response)
        {
            if (Convert.ToString(response["event"]) == "otpauth.app")
            {
                if (OtpAuthenticationTrustThisDevice(username, null))
                    return false;
            }
            return true;
        }

        public static JToken EncodeContactInformation(JToken contacts, string type)
        {
            if (!((contacts is JArray)))
                contacts = new JArray(contacts);
            for (var i = 0; (i < contacts.Count()); i++)
            {
                var text = Convert.ToString(contacts[i]);
                var encodedContact = new JObject(new JProperty("value", TextUtility.Hash(text)), new JProperty("type", type));
                contacts[i] = encodedContact;
                if ((type == "call") || (type == "sms"))
                {
                    var phone = Regex.Match(text, "^(.+?)(.{4})$");
                    if (phone.Success)
                        text = (Regex.Replace(phone.Groups[1].Value, "\\d", "x") + phone.Groups[2].Value);
                }
                else
                {
                    if (type == "email")
                    {
                        var email = Regex.Match(text, "^(.)(.+?)(.@.+)$");
                        if (email.Success)
                            text = ((email.Groups[1].Value + "...")
                                        + email.Groups[3].Value);
                    }
                }
                encodedContact.Add(new JProperty("text", text));
            }
            return contacts;
        }

        protected virtual JObject UserAuthenticationData(string username)
        {
            return UserAuthenticationData(username, null);
        }

        protected virtual JObject UserAuthenticationData(string username, JObject newData)
        {
            JObject data = null;
            var user = Membership.GetUser(username);
            if (user != null)
            {
                data = TextUtility.ParseYamlOrJson(ReadUserAuthenticationData(user));
                if (newData != null)
                {
                    if (data == null)
                        data = newData;
                    else
                        foreach (JProperty p in newData.Properties())
                            if (p.Value.Type != JTokenType.Null)
                                data[p.Name] = Convert.ToString(p.Value);
                            else
                                data.Remove(p.Name);
                    data.Remove("error");
                    WriteUserAuthenticationData(user, TextUtility.ToYamlString(data));
                }
            }
            return data;
        }

        protected virtual string ReadUserAuthenticationData(MembershipUser user)
        {
            return user.Comment;
        }

        protected virtual void WriteUserAuthenticationData(MembershipUser user, string data)
        {
            user.Comment = data;
            Membership.UpdateUser(user);
        }

        protected virtual JObject OtpAuthenticationData(string username)
        {
            return OtpAuthenticationData(username, ((JObject)(null)));
        }

        protected virtual JObject OtpAuthenticationData(string username, string otpauthUrl)
        {
            JObject userAuthData = null;
            if (!(string.IsNullOrEmpty(otpauthUrl)))
            {
                userAuthData = new JObject();
                userAuthData["2FA"] = otpauthUrl;
            }
            return OtpAuthenticationData(username, userAuthData);
        }

        protected virtual JObject OtpAuthenticationData(string username, JObject userAuthData)
        {
            var otpData = new JObject();
            if (userAuthData == null)
                userAuthData = UserAuthenticationData(username);
            if ((userAuthData != null) && Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)))
            {
                var otpauth = Convert.ToString(userAuthData["2FA"]);
                if (!(string.IsNullOrEmpty(otpauth)))
                {
                    var otpAuthType = Regex.Match(otpauth, "(^|\\n)otpauth://(\\w+)/");
                    if (otpAuthType.Success)
                    {
                        otpData["otpauth"] = otpauth;
                        otpData["codeLength"] = SettingsProperty("server.2FA.code.length", 6);
                        if (Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.count", 10)) > 0)
                        {
                            var backupCodes = Convert.ToString(userAuthData["Backup Codes"]);
                            otpData["backupCodes"] = backupCodes;
                        }
                        otpData["type"] = otpAuthType.Groups[2].Value;
                        // Verification methods must be enabled in the app and selected by the user during the setup.
                        var verify = new JObject();
                        otpData["verify"] = verify;
                        OtpVerificationData(username, verify);
                        var allowedMethods = new List<string>();
                        var methodsToRemove = new List<string>();
                        // application-approved methods
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.app", true)))
                            allowedMethods.Add("app");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.email", true)))
                            allowedMethods.Add("email");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.call", false)))
                            allowedMethods.Add("call");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.sms", false)))
                            allowedMethods.Add("sms");
                        // user-approved methods
                        var methods = Convert.ToString(userAuthData["Methods"]);
                        if (!(string.IsNullOrEmpty(methods)))
                        {
                            var userApprovedMethods = Regex.Split(methods, "\\s*,\\s*");
                            foreach (var m in allowedMethods)
                                if (!(userApprovedMethods.Contains(m)))
                                    methodsToRemove.Add(m);
                            if (allowedMethods.Count > methodsToRemove.Count)
                                foreach (var m in methodsToRemove)
                                    allowedMethods.Remove(m);
                        }
                        // keep the allowed verification methods
                        methodsToRemove.Clear();
                        foreach (var p in verify.Properties())
                            if (!(allowedMethods.Contains(p.Name)))
                                methodsToRemove.Add(p.Name);
                        foreach (var m in methodsToRemove)
                            verify.Remove(m);
                        // add "dial" method of verification unconditionally
                        var dial = SettingsProperty("server.2FA.verify.dial");
                        if (dial != null)
                            verify["dial"] = dial;
                    }
                }
            }
            return otpData;
        }

        protected virtual void OtpVerificationData(string username, JObject verify)
        {
            verify["app"] = true;
            var user = Membership.GetUser(username);
            if ((user != null) && !(string.IsNullOrEmpty(user.Email)))
                verify["email"] = user.Email;
        }
    }

    public abstract class OAuthHandler
    {

        public string StartPage;

        private bool _refreshedToken = false;

        private string _clientUri;

        private SaasConfiguration _config = null;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private JObject _tokens;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _storeToken;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _appState;

        public virtual string ClientUri
        {
            get
            {
                if (string.IsNullOrEmpty(_clientUri) && ApplicationServices.IsSiteContentEnabled)
                {
                    _clientUri = Config["Client Uri"];
                    if (!(_clientUri.StartsWith("http")))
                        _clientUri = ("https://" + _clientUri);
                }
                return _clientUri;
            }
        }

        public virtual SaasConfiguration Config
        {
            get
            {
                return _config;
            }
        }

        protected virtual JObject Tokens
        {
            get
            {
                return _tokens;
            }
            set
            {
                _tokens = value;
            }
        }

        protected virtual bool StoreToken
        {
            get
            {
                return _storeToken;
            }
            set
            {
                _storeToken = value;
            }
        }

        protected virtual string Scope
        {
            get
            {
                return string.Empty;
            }
        }

        public string AppState
        {
            get
            {
                return _appState;
            }
            set
            {
                _appState = value;
            }
        }

        public virtual void ProcessRequest(HttpContext context)
        {
            try
            {
                var services = ApplicationServices.Create();
                StartPage = context.Request.QueryString["start"];
                if (string.IsNullOrEmpty(StartPage))
                    StartPage = services.UserHomePageUrl();
                var state = context.Request.QueryString["state"];
                if (!(string.IsNullOrEmpty(state)))
                    SetState(state);
                RestoreSession(context);
                if (Config == null)
                    throw new Exception("Provider not found.");
                else
                {
                    var code = GetAuthCode(context.Request);
                    if (string.IsNullOrEmpty(code))
                    {
                        var er = context.Request.QueryString["error"];
                        if (!(string.IsNullOrEmpty(er)))
                            HandleError(context);
                        else
                            context.Response.Redirect(GetAuthorizationUrl());
                    }
                    else
                    {
                        if (!(GetAccessTokens(code, false)))
                            context.Response.StatusCode = 401;
                        else
                        {
                            StoreTokens(Tokens, StoreToken);
                            SetSession(context);
                            RedirectToStartPage(context);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                HandleException(context, ex);
            }
        }

        protected virtual string GetSiteContentBasePath()
        {
            return "sys/saas";
        }

        public virtual void SetSession(HttpContext context)
        {
            if (!StoreToken)
            {
                var user = SyncUser();
                if (user == null)
                    throw new Exception("No user found.");
                var services = ApplicationServices.Current;
                // logout current user
                var auth = context.Request.Cookies[FormsAuthentication.FormsCookieName];
                if (auth != null)
                {
                    var oldTicket = FormsAuthentication.Decrypt(auth.Value);
                    if (oldTicket.Name != user.UserName)
                        services.UserLogout();
                }
                var ticket = new FormsAuthenticationTicket(0, user.UserName, DateTime.Now, DateTime.Now.AddHours(12), false, ("OAUTH:" + GetHandlerName()));
                var encrypted = FormsAuthentication.Encrypt(ticket);
                var accountManagerEnabled = ApplicationServicesBase.TryGetJsonProperty(services.DefaultSettings, "membership.accountManager.enabled");
                if ((accountManagerEnabled == null) || accountManagerEnabled.Value<bool>())
                {
                    // client token login
                    var cookie = new HttpCookie(".TOKEN", encrypted)
                    {
                        Expires = System.DateTime.Now.AddMinutes(5)
                    };
                    context.Response.SetCookie(cookie);
                }
                else
                {
                    // server login
                    services.AuthenticateUser(user.UserName, ("token:" + encrypted), false);
                }
                context.Response.Cookies.Set(new HttpCookie(".PROVIDER", GetHandlerName()));
            }
        }

        public virtual void RestoreSession(HttpContext context)
        {
            if (context.Request.QueryString["storeToken"] == "true")
                StoreToken = true;
        }

        protected virtual bool GetAccessTokens(string code, bool refresh)
        {
            var request = GetAccessTokenRequest(code, refresh);
            var response = request.GetResponse();
            var json = string.Empty;
            using (var sr = new StreamReader(response.GetResponseStream()))
                json = sr.ReadToEnd();
            if (!HttpContext.Current.IsCustomErrorEnabled && (string.IsNullOrEmpty(json) || !((json[0] == '{'))))
                throw new Exception(("Error fetching access tokens. Response: " + json));
            var responseObj = JObject.Parse(json);
            var er = ((string)(responseObj["error"]));
            if (!(string.IsNullOrEmpty(er)))
                throw new Exception(er);
            Tokens = responseObj;
            return (responseObj["access_token"] != null);
        }

        public virtual void StoreTokens(JObject tokens, bool storeSystem)
        {
        }

        public virtual bool LoadTokens(string userName)
        {
            return false;
        }

        protected virtual string GetAuthCode(HttpRequest request)
        {
            return request.QueryString["code"];
        }

        public virtual JObject Query(string method, bool useSystemToken)
        {
            JObject result = null;
            try
            {
                var token = ((string)(Tokens["access_token"]));
                if (useSystemToken)
                    token = Config.AccessToken;
                if (string.IsNullOrEmpty(token))
                    throw new Exception("No token for request.");
                var request = GetQueryRequest(method, token);
                var response = request.GetResponse();
                using (var sr = new StreamReader(response.GetResponseStream()))
                {
                    result = JObject.Parse(sr.ReadToEnd());
                    ApplicationServicesBase.Create().OAuthSetUserObject(result);
                }
            }
            catch (WebException ex)
            {
                if (ex.Status == WebExceptionStatus.ProtocolError)
                {
                    var response = ((HttpWebResponse)(ex.Response));
                    if ((response.StatusCode == HttpStatusCode.Unauthorized) && !_refreshedToken)
                    {
                        _refreshedToken = true;
                        if (!(RefreshTokens(useSystemToken)))
                            throw new Exception("Token expired.");
                        else
                            result = Query(method, useSystemToken);
                    }
                    else
                    {
                        if (response.StatusCode == HttpStatusCode.Forbidden)
                            throw new Exception("Insufficient permissions.");
                    }
                }
            }
            return result;
        }

        protected virtual bool RefreshTokens(bool useSystemToken)
        {
            var refresh = ((string)(Tokens["refresh_token"]));
            if (useSystemToken)
                refresh = Config.RefreshToken;
            if (!(string.IsNullOrEmpty(refresh)))
            {
                if (GetAccessTokens(refresh, true))
                {
                    if (useSystemToken)
                        StoreTokens(Tokens, true);
                    return true;
                }
            }
            return false;
        }

        public virtual MembershipUser SyncUser()
        {
            var username = GetUserName();
            var email = GetUserEmail();
            var user = Membership.GetUser(username);
            if (user == null)
            {
                var userNameOfEmailOwner = Membership.GetUserNameByEmail(username);
                if (!(string.IsNullOrEmpty(userNameOfEmailOwner)))
                    user = Membership.GetUser(userNameOfEmailOwner);
            }
            if ((user == null) && (Config["Sync User"] == "true"))
            {
                // create user
                var comment = ("Source: " + GetHandlerName());
                MembershipCreateStatus status;
                if (string.IsNullOrEmpty(email))
                    email = username;
                user = Membership.CreateUser(username, Guid.NewGuid().ToString(), email, comment, Guid.NewGuid().ToString(), true, out status);
                if (status != MembershipCreateStatus.Success)
                    throw new Exception(status.ToString());
                user.Comment = comment;
                Membership.UpdateUser(user);
                Roles.AddUserToRoles(user.UserName, GetDefaultUserRoles(user));
            }
            if (user != null)
            {
                if (!(string.IsNullOrEmpty(email)) && email != user.Email)
                {
                    user.Email = email;
                    Membership.UpdateUser(user);
                }
                SetUserAvatar(user);
                if (Config["Sync Roles"] == "true")
                {
                    // verify roles
                    var roleList = GetUserRoles(user);
                    foreach (var role in roleList)
                        if (!(Roles.IsUserInRole(user.UserName, role)))
                        {
                            if (!(Roles.RoleExists(role)))
                                Roles.CreateRole(role);
                            Roles.AddUserToRole(user.UserName, role);
                        }
                    var existingRoles = new List<string>(Roles.GetRolesForUser(user.UserName));
                    foreach (var oldRole in existingRoles)
                        if (!(roleList.Contains(oldRole)))
                            Roles.RemoveUserFromRole(user.UserName, oldRole);
                }
            }
            ApplicationServicesBase.Create().OAuthSyncUser(user);
            return user;
        }

        public abstract string GetUserName();

        public virtual string GetUserEmail()
        {
            return string.Empty;
        }

        public virtual void SetUserAvatar(MembershipUser user)
        {
        }

        public virtual string GetUserImageUrl(MembershipUser user)
        {
            return null;
        }

        public virtual string[] GetDefaultUserRoles(MembershipUser user)
        {
            return new string[] {
                    "Users"};
        }

        public virtual List<string> GetUserRoles(MembershipUser user)
        {
            var roleList = new List<string>();
            roleList.Add("Users");
            return roleList;
        }

        public virtual string GetUserProfile()
        {
            return "logout";
        }

        public virtual string GetState()
        {
            var state = ("start=" + StartPage);
            if (StoreToken)
                state = (state + "|storeToken=true");
            if (!(string.IsNullOrEmpty(AppState)))
                state = (state
                            + ("|" + AppState));
            return state;
        }

        public virtual void SetState(string state)
        {
            foreach (var part in state.Split('|'))
                if (!(string.IsNullOrEmpty(part)))
                {
                    var ps = part.Split('=');
                    if (ps[0] == "start")
                        StartPage = ps[1];
                    else
                    {
                        if (ps[0] == "storeToken")
                            StoreToken = ((ps[1] == "true") && ApplicationServicesBase.IsSuperUser);
                        else
                            ApplicationServicesBase.Create().OAuthSetState(ps[0], ps[1]);
                    }
                }
        }

        public virtual void RedirectToLoginPage()
        {
            string redirectUrl = null;
            if (Config == null)
                redirectUrl = ApplicationServices.Create().UserHomePageUrl();
            else
                redirectUrl = GetAuthorizationUrl();
            HttpContext.Current.Response.Redirect(redirectUrl);
        }

        public virtual void RedirectToStartPage(HttpContext context)
        {
            if (context.User.Identity.IsAuthenticated)
                context.Response.Redirect(StartPage);
            else
                context.Response.Redirect(((ApplicationServices.Current.UserHomePageUrl() + "?ReturnUrl=")
                                + HttpUtility.UrlEncode(ApplicationServices.ResolveClientUrl(StartPage))));
        }

        public virtual bool ValidateRefreshToken(MembershipUser user, string token)
        {
            return true;
        }

        public virtual void SignOut()
        {
        }

        protected virtual void HandleError(HttpContext context)
        {
            var desc = context.Request.QueryString["error_description"];
            if (string.IsNullOrEmpty(desc))
                desc = context.Request.QueryString["error"];
            throw new Exception(desc);
        }

        protected virtual void HandleException(HttpContext context, Exception ex)
        {
            while (ex.InnerException != null)
                ex = ex.InnerException;
            var er = new ServiceRequestError()
            {
                Message = ex.Message,
                ExceptionType = ex.GetType().ToString()
            };
            if (!context.IsCustomErrorEnabled)
                er.StackTrace = ex.StackTrace;
            context.Server.ClearError();
            context.Response.TrySkipIisCustomErrors = true;
            context.Response.ContentType = "application/json";
            context.Response.Clear();
            context.Response.Write(JsonConvert.SerializeObject(er));
        }

        public abstract string GetHandlerName();

        public abstract string GetAuthorizationUrl();

        protected abstract WebRequest GetAccessTokenRequest(string code, bool refresh);

        protected abstract WebRequest GetQueryRequest(string method, string token);
    }

    public partial class OAuthHandlerFactory : OAuthHandlerFactoryBase
    {
    }

    public class OAuthHandlerFactoryBase
    {

        public static SortedDictionary<string, Type> Handlers = new SortedDictionary<string, Type>();

        public static OAuthHandler Create(string service)
        {
            return new OAuthHandlerFactory().GetHandler(service);
        }

        public static OAuthHandler GetActiveHandler()
        {
            var saas = HttpContext.Current.Request.Cookies[".PROVIDER"];
            if ((saas != null) && (saas.Value != null))
                return OAuthHandlerFactory.Create(saas.Value);
            return null;
        }

        public virtual OAuthHandler GetHandler(string service)
        {
            Type t = null;
            if (Handlers.TryGetValue(service.ToLower(), out t))
                return ((OAuthHandler)(Activator.CreateInstance(t)));
            return null;
        }

        public static OAuthHandler CreateAutoLogin()
        {
            return new OAuthHandlerFactory().GetAutoLoginHandler();
        }

        public virtual OAuthHandler GetAutoLoginHandler()
        {
            return null;
        }
    }

    public partial class CloudIdentityOAuthHandler : CloudIdentityOAuthHandlerBase
    {
    }

    public partial class CloudIdentityOAuthHandlerBase : OAuthHandler
    {

        private JObject _userObj;

        protected override string Scope
        {
            get
            {
                var scopes = Config["Scope"];
                if (string.IsNullOrEmpty(scopes))
                    scopes = "profile email";
                return scopes;
            }
        }

        public override string GetHandlerName()
        {
            return "CloudIdentity";
        }

        public override string GetAuthorizationUrl()
        {
            return string.Format("{0}/oauth/auth?response_type=code&client_id={1}&redirect_uri={2}&scope={3}&state=" +
                    "{4}", ClientUri, Config.ClientId, Uri.EscapeDataString(Config.RedirectUri), Uri.EscapeDataString(Scope), Uri.EscapeDataString(GetState()));
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create((ClientUri + "/oauth/token"));
            request.Method = "POST";
            var codeType = "code";
            if (refresh)
                codeType = "access_token";
            var body = string.Format("{0}={1}&client_id={2}&client_secret={3}&redirect_uri={4}&grant_type=authorization" +
                    "_code", codeType, code, Config.ClientId, Config.ClientSecret, Config.RedirectUri);
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create((ClientUri
                            + ("/oauth/" + method)));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override string GetUserName()
        {
            _userObj = Query("user", false);
            return ((string)(_userObj["name"]));
        }
    }

    public partial class DnnOAuthHandler : DnnOAuthHandlerBase
    {
    }

    public partial class DnnOAuthHandlerBase : OAuthHandler
    {

        private string _showNavigation;

        private JObject _userInfo;

        protected override string Scope
        {
            get
            {
                var sc = Config["Scope"];
                var tokens = Config["Tokens"];
                if (!(string.IsNullOrEmpty(tokens)))
                    sc = (sc
                                + (" token:" + string.Join(" token:", tokens.Split(' '))));
                return sc;
            }
        }

        public override string GetHandlerName()
        {
            return "DNN";
        }

        public override string GetAuthorizationUrl()
        {
            var authUrl = string.Format("{0}?response_type=code&client_id={1}&redirect_uri={2}&state={3}", ClientUri, Config.ClientId, Config.RedirectUri, Uri.EscapeDataString(GetState()));
            if (!(string.IsNullOrEmpty(Scope)))
                authUrl = (authUrl
                            + ("&scope=" + Uri.EscapeDataString(Scope)));
            var username = HttpContext.Current.Request.QueryString["username"];
            if (!(string.IsNullOrEmpty(username)))
                authUrl = (authUrl
                            + ("&username=" + username));
            return authUrl;
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create(ClientUri);
            request.Method = "POST";
            var codeType = "code";
            if (refresh)
                codeType = "access_token";
            var body = string.Format("{0}={1}&client_id={2}&client_secret={3}&redirect_uri={4}&grant_type=authorization" +
                    "_code", codeType, code, Config.ClientId, Config.ClientSecret, Uri.EscapeDataString(Config.RedirectUri));
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create((ClientUri
                            + ("?method=" + method)));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override string GetState()
        {
            return (base.GetState()
                        + ("|showNavigation=" + HttpContext.Current.Request.QueryString["showNavigation"]));
        }

        public override void SetState(string state)
        {
            base.SetState(state);
            foreach (var part in state.Split('|'))
            {
                var ps = part.Split('=');
                if (ps[0] == "showNavigation")
                    _showNavigation = ps[1];
            }
        }

        public override void RestoreSession(HttpContext context)
        {
            if (string.IsNullOrEmpty(_showNavigation))
                _showNavigation = context.Request.QueryString["showNavigation"];
            var session = context.Request.QueryString["session"];
            if (!(string.IsNullOrEmpty(session)) && (session == "new"))
                ApplicationServices.Current.UserLogout();
            else
            {
                base.RestoreSession(context);
                if (!StoreToken && context.User.Identity.IsAuthenticated)
                    RedirectToStartPage(context);
            }
        }

        public override void RedirectToStartPage(HttpContext context)
        {
            var connector = "?";
            if (StartPage.Contains("?"))
                connector = "&";
            StartPage = (StartPage
                        + (connector
                        + ("_showNavigation=" + _showNavigation)));
            base.RedirectToStartPage(context);
        }

        public override string GetUserName()
        {
            return ((string)(_userInfo["UserName"]));
        }

        public override string GetUserEmail()
        {
            return ((string)(_userInfo["UserEmail"]));
        }

        public override List<string> GetUserRoles(MembershipUser user)
        {
            var roles = base.GetUserRoles(user);
            foreach (var r in _userInfo.Value<JArray>("Roles"))
                roles.Add(r.ToString());
            return roles;
        }

        public override MembershipUser SyncUser()
        {
            _userInfo = Query("me", false);
            var user = base.SyncUser();
            SiteContentFile.WriteJson(string.Format("sys/users/{0}.json", user.UserName), ((JObject)(_userInfo["Tokens"])));
            return user;
        }

        public override string GetUserImageUrl(MembershipUser user)
        {
            return string.Format("{0}/DnnImageHandler.ashx?mode=profilepic&userId={1}&h=80&w=80", ClientUri, Convert.ToInt32(_userInfo["UserID"]));
        }

        public override void SignOut()
        {
            var url = ApplicationServices.ResolveClientUrl(ApplicationServices.Current.UserHomePageUrl());
            ServiceRequestHandler.Redirect(string.Format("{0}?_logout=true&client_id={1}&redirect_uri={2}", ClientUri, Config.ClientId, url));
        }
    }
}
