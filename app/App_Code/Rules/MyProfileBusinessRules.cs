using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Net.Mail;
using System.Web;
using System.Web.Security;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Rules
{
    public class MyProfileBusinessRulesBase : BusinessRules
    {

        public static SortedDictionary<MembershipCreateStatus, string> CreateErrors = new SortedDictionary<MembershipCreateStatus, string>();

        private SiteContentFileList _oauthProviders;

        static MyProfileBusinessRulesBase()
        {
            CreateErrors.Add(MembershipCreateStatus.DuplicateEmail, "Duplicate email address.");
            CreateErrors.Add(MembershipCreateStatus.DuplicateProviderUserKey, "Duplicate provider key.");
            CreateErrors.Add(MembershipCreateStatus.DuplicateUserName, "Duplicate user name.");
            CreateErrors.Add(MembershipCreateStatus.InvalidAnswer, "Invalid password recovery answer.");
            CreateErrors.Add(MembershipCreateStatus.InvalidEmail, "Invalid email address.");
            CreateErrors.Add(MembershipCreateStatus.InvalidPassword, "Invalid password.");
            CreateErrors.Add(MembershipCreateStatus.InvalidProviderUserKey, "Invalid provider user key.");
            CreateErrors.Add(MembershipCreateStatus.InvalidQuestion, "Invalid password recovery question.");
            CreateErrors.Add(MembershipCreateStatus.InvalidUserName, "Invalid user name.");
            CreateErrors.Add(MembershipCreateStatus.ProviderError, "Provider error.");
            CreateErrors.Add(MembershipCreateStatus.UserRejected, "User has been rejected.");
        }

        protected virtual SiteContentFileList OAuthProviders
        {
            get
            {
                if (_oauthProviders == null)
                {
                    if (ApplicationServices.IsSiteContentEnabled)
                        _oauthProviders = ApplicationServices.Current.ReadSiteContent("sys/saas", "%");
                    else
                        _oauthProviders = new SiteContentFileList();
                }
                return _oauthProviders;
            }
        }

        protected virtual void InsertUser(string username, string password, string confirmPassword, string email, string passwordQuestion, string passwordAnswer, bool isApproved, string comment, string roles)
        {
            PreventDefault();
            if (password != confirmPassword)
                throw new Exception(Localize("PasswordAndConfirmationDoNotMatch", "Password and confirmation do not match."));
            // create a user
            MembershipCreateStatus status;
            Membership.CreateUser(username, password, email, passwordQuestion, passwordAnswer, isApproved, out status);
            if (status != MembershipCreateStatus.Success)
                throw new Exception(Localize(status.ToString(), CreateErrors[status]));
            // retrieve the primary key of the new user account
            var newUser = Membership.GetUser(username);
            // update a comment
            if (!(string.IsNullOrEmpty(comment)))
            {
                newUser.Comment = comment;
                Membership.UpdateUser(newUser);
            }
            if (!(string.IsNullOrEmpty(roles)))
                foreach (var role in roles.Split(','))
                    System.Web.Security.Roles.AddUserToRole(username, role);
        }

        [ControllerAction("MyProfile", "signUpForm", "Insert", ActionPhase.Before)]
        protected virtual void SignUpUser(string username, string password, string confirmPassword, string email, string passwordQuestion, string passwordAnswer)
        {
            InsertUser(username, password, confirmPassword, email, passwordQuestion, passwordAnswer, true, Localize("SelfRegisteredUser", "Self-registered user."), "Users");
        }

        [RowBuilder("MyProfile", "passwordRequestForm", RowKind.New)]
        protected virtual void NewPasswordRequestRow()
        {
            UpdateFieldValue("UserName", Context.Session["IdentityConfirmation"]);
        }

        [RowBuilder("MyProfile", "loginForm", RowKind.New)]
        protected virtual void NewLoginFormRow()
        {
            var urlReferrer = Context.Request.UrlReferrer;
            if (urlReferrer != null)
            {
                var url = urlReferrer.ToString();
                if (url.Contains("/_invoke/getidentity"))
                    UpdateFieldValue("DisplayRememberMe", false);
            }
            UpdateFieldValue("RememberMe", true);
            if (OAuthProviders.Count > 0)
                UpdateFieldValue("OAuthEnabled", true);
        }

        [ControllerAction("MyProfile", "passwordRequestForm", "Custom", "RequestPassword", ActionPhase.Execute)]
        protected virtual void PasswordRequest(string userName)
        {
            PreventDefault();
            var user = Membership.GetUser(userName);
            if ((user == null) || (!(string.IsNullOrEmpty(user.Comment)) && Regex.IsMatch(user.Comment, "Source:\\s+\\w+")))
                Result.ShowAlert(Localize("UserNameDoesNotExist", "User name does not exist."), "UserName");
            else
            {
                Context.Session["IdentityConfirmation"] = userName;
                if (!ApplicationServices.IsTouchClient)
                    Result.HideModal();
                Result.ShowModal("MyProfile", "identityConfirmationForm", "Edit", "identityConfirmationForm");
            }
        }

        [RowBuilder("MyProfile", "identityConfirmationForm", RowKind.Existing)]
        protected virtual void PrepareIdentityConfirmationRow()
        {
            var userName = ((string)(Context.Session["IdentityConfirmation"]));
            UpdateFieldValue("UserName", userName);
            UpdateFieldValue("PasswordAnswer", null);
            UpdateFieldValue("PasswordQuestion", Membership.GetUser(userName).PasswordQuestion);
        }

        [ControllerAction("MyProfile", "identityConfirmationForm", "Custom", "ConfirmIdentity", ActionPhase.Execute)]
        protected virtual void IdentityConfirmation(string userName, string passwordAnswer)
        {
            PreventDefault();
            var user = Membership.GetUser(userName);
            if (user != null)
            {
                var newPassword = user.ResetPassword(passwordAnswer);
                // create an email and send it to the user
                var message = new MailMessage();
                message.To.Add(user.Email);
                message.Subject = string.Format(Localize("NewPasswordSubject", "New password for \'{0}\'."), userName);
                message.Body = newPassword;
                try
                {
                    var client = new SmtpClient();
                    client.Send(message);
                    // hide modal popup and display a confirmation
                    Result.ExecuteOnClient("$app.alert(\'{0}\', function () {{ window.history.go(-2); }})", Localize("NewPasswordAlert", "A new password has been emailed to the address on file."));
                }
                catch (Exception error)
                {
                    Result.ShowAlert(error.Message);
                }
            }
        }

        [RowBuilder("MyProfile", "myAccountForm", RowKind.Existing)]
        protected virtual void PrepareCurrentUserRow()
        {
            UpdateFieldValue("UserName", UserName);
            UpdateFieldValue("Email", UserEmail);
            UpdateFieldValue("PasswordQuestion", Membership.GetUser().PasswordQuestion);
        }

        [ControllerAction("MyProfile", "identityConfirmationForm", "Custom", "BackToRequestPassword", ActionPhase.Execute)]
        protected virtual void BackToRequestPassword()
        {
            PreventDefault();
            Result.HideModal();
            if (!ApplicationServices.IsTouchClient)
                Result.ShowModal("MyProfile", "passwordRequestForm", "New", "passwordRequestForm");
        }

        [ControllerAction("MyProfile", "myAccountForm", "Update", ActionPhase.Before)]
        protected virtual void UpdateMyAccount(string userName, string oldPassword, string password, string confirmPassword, string email, string passwordQuestion, string passwordAnswer)
        {
            PreventDefault();
            var user = Membership.GetUser(userName);
            if (user != null)
            {
                if (string.IsNullOrEmpty(oldPassword))
                {
                    Result.ShowAlert(Localize("EnterCurrentPassword", "Please enter your current password."), "OldPassword");
                    return;
                }
                if (!(Membership.ValidateUser(userName, oldPassword)))
                {
                    Result.ShowAlert(Localize("PasswordDoesNotMatchRecords", "Your password does not match our records."), "OldPassword");
                    return;
                }
                if (!(string.IsNullOrEmpty(password)) || !(string.IsNullOrEmpty(confirmPassword)))
                {
                    if (password != confirmPassword)
                    {
                        Result.ShowAlert(Localize("NewPasswordAndConfirmatinDoNotMatch", "New password and confirmation do not match."), "Password");
                        return;
                    }
                    if (!(user.ChangePassword(oldPassword, password)))
                    {
                        Result.ShowAlert(Localize("NewPasswordInvalid", "Your new password is invalid."), "Password");
                        return;
                    }
                }
                if (email != user.Email)
                {
                    user.Email = email;
                    Membership.UpdateUser(user);
                }
                if (user.PasswordQuestion != passwordQuestion && string.IsNullOrEmpty(passwordAnswer))
                {
                    Result.ShowAlert(Localize("EnterPasswordAnswer", "Please enter a password answer."), "PasswordAnswer");
                    return;
                }
                if (!(string.IsNullOrEmpty(passwordAnswer)))
                {
                    user.ChangePasswordQuestionAndAnswer(oldPassword, passwordQuestion, passwordAnswer);
                    Membership.UpdateUser(user);
                }
                Result.HideModal();
            }
            else
                Result.ShowAlert(Localize("UserNotFound", "User not found."));
        }

        [ControllerAction("MyProfile", "Select", ActionPhase.Before)]
        public virtual void AccessControlValidation()
        {
            if (Context.User.Identity.IsAuthenticated)
                return;
            if (!((((Request.View == "signUpForm") || (Request.View == "passwordRequestForm")) || ((Request.View == "identityConfirmationForm") || (Request.View == "loginForm")))))
                throw new Exception("Not authorized");
        }

        public override bool SupportsVirtualization(string controllerName)
        {
            return true;
        }

        protected override void VirtualizeController(string controllerName)
        {
            base.VirtualizeController(controllerName);
            NodeSet().SelectViews().SetTag("odp-enabled-none");
            if (OAuthProviders.Count > 0)
            {
                // customize login form when OAuth providers are detected in Site Content
                NodeSet().SelectCustomAction("SignUp").WhenClientScript("$row.OAuthProvider== \'other\'").SelectCustomAction("ForgotPassword").WhenClientScript("$row.OAuthProvider== \'other\'").SelectViews("loginForm").SelectDataFields("UserName", "Password", "RememberMe").VisibleWhen("$row.OAuthProvider==\'other\'").SelectDataField("UserName").SetTag("focus-auto").SelectDataFields("OAuthProvider").SetHidden(false).VisibleWhen("$row.OAuthEnabled");
                // customize OAuth provider items
                var items = NodeSet().SelectField("OAuthProvider").SelectItems().Nodes;
                if (items.Count > 0)
                {
                    var supportedProviders = new List<string>();
                    foreach (var file in OAuthProviders)
                        supportedProviders.Add(file.Name);
                    foreach (var item in items)
                    {
                        var provider = item.GetAttribute("value", string.Empty);
                        if (provider == "other")
                        {
                            var otherItemText = item.SelectSingleNode("@text");
                            if ((otherItemText != null) && (otherItemText.Value == "Other"))
                                otherItemText.SetValue(ApplicationServicesBase.Current.DisplayName);
                        }
                        else
                        {
                            if (!(supportedProviders.Contains(provider)))
                                item.DeleteSelf();
                        }
                    }
                }
            }
        }
    }
}
