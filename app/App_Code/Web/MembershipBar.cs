using System;
using System.Data;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.Text;
using System.Configuration;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using System.Web.UI.WebControls.WebParts;
using MyCompany.Data;

namespace MyCompany.Web
{
    public partial class MembershipBar : MembershipBarBase
    {
    }

    public class MembershipBarBase : Control, INamingContainer
    {

        private string _servicePath;

        private string _welcome;

        private bool _displayRememberMe;

        private bool _displayLogin;

        private bool _rememberMeSet;

        private bool _displayPasswordRecovery;

        private bool _displaySignUp;

        private bool _displayMyAccount;

        private bool _displayHelp;

        private bool _enableHistory;

        private bool _enablePermalinks;

        private int _idleUserTimeout;

        public MembershipBarBase()
        {
            _displayLogin = true;
            _displaySignUp = true;
            _displayPasswordRecovery = true;
            _displayRememberMe = true;
            _displayMyAccount = true;
            _displayHelp = true;
            _displayLogin = true;
        }

        [System.ComponentModel.Description("A path to a data controller web service.")]
        [System.ComponentModel.DefaultValue("~/_invoke")]
        public string ServicePath
        {
            get
            {
                if (string.IsNullOrEmpty(_servicePath))
                    return "~/_invoke";
                return _servicePath;
            }
            set
            {
                _servicePath = value;
            }
        }

        [System.ComponentModel.Description("Specifies a welcome message for an authenticated user. Example: Welcome <b>{0}</b" +
            ">, Today is {1:D}")]
        public string Welcome
        {
            get
            {
                return _welcome;
            }
            set
            {
                _welcome = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Controls display of \'Remember me\' check box in a login window.")]
        public bool DisplayRememberMe
        {
            get
            {
                return _displayRememberMe;
            }
            set
            {
                _displayRememberMe = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Specifies if a fly-over login dialog is displayed on the memberhhip bar.")]
        public bool DisplayLogin
        {
            get
            {
                return _displayLogin;
            }
            set
            {
                _displayLogin = value;
            }
        }

        [System.ComponentModel.DefaultValue(false)]
        [System.ComponentModel.Description("Specifies if \'Remember me\' check box in a login window is selected by default.")]
        public bool RememberMeSet
        {
            get
            {
                return _rememberMeSet;
            }
            set
            {
                _rememberMeSet = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Controls display of a password recovery link in a login window.")]
        public bool DisplayPasswordRecovery
        {
            get
            {
                return _displayPasswordRecovery;
            }
            set
            {
                _displayPasswordRecovery = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Controls display of a anonymous user account sign up link in a login window.")]
        public bool DisplaySignUp
        {
            get
            {
                return _displaySignUp;
            }
            set
            {
                _displaySignUp = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Controls display of \'My Account\' link for authenticated users on a membership bar" +
            ".")]
        public bool DisplayMyAccount
        {
            get
            {
                return _displayMyAccount;
            }
            set
            {
                _displayMyAccount = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        [System.ComponentModel.Description("Controls display of a \'Help\' link on a membership bar.")]
        public bool DisplayHelp
        {
            get
            {
                return _displayHelp;
            }
            set
            {
                _displayHelp = value;
            }
        }

        [System.ComponentModel.DefaultValue(false)]
        [System.ComponentModel.Description("Enables interactive history of most recent used data objects.")]
        public bool EnableHistory
        {
            get
            {
                return _enableHistory;
            }
            set
            {
                _enableHistory = value;
            }
        }

        [System.ComponentModel.DefaultValue(false)]
        [System.ComponentModel.Description("Enables bookmarking of selected master records by end users.")]
        public bool EnablePermalinks
        {
            get
            {
                return _enablePermalinks;
            }
            set
            {
                _enablePermalinks = value;
            }
        }

        [System.ComponentModel.DefaultValue(0)]
        [System.ComponentModel.Description("The idle user detection timeout in minutes.")]
        public int IdleUserTimeout
        {
            get
            {
                return _idleUserTimeout;
            }
            set
            {
                _idleUserTimeout = value;
            }
        }

        protected override void CreateChildControls()
        {
            base.CreateChildControls();
            var div = new HtmlGenericControl("div")
            {
                ID = "d"
            };
            div.Style.Add(HtmlTextWriterStyle.Display, "none");
            Controls.Add(div);
            var bar = new MembershipBarExtender()
            {
                ID = "b",
                TargetControlID = div.ID,
                ServicePath = ServicePath
            };
            bar.Properties.Add("DisplaySignUp", DisplaySignUp);
            bar.Properties.Add("DisplayLogin", DisplayLogin);
            bar.Properties.Add("DisplayRememberMe", DisplayRememberMe);
            bar.Properties.Add("DisplayPasswordRecovery", DisplayPasswordRecovery);
            bar.Properties.Add("RememberMeSet", RememberMeSet);
            bar.Properties.Add("DisplayMyAccount", DisplayMyAccount);
            bar.Properties.Add("DisplayHelp", DisplayHelp);
            bar.Properties.Add("EnablePermalinks", EnablePermalinks);
            bar.Properties.Add("EnableHistory", EnableHistory);
            bar.Properties.Add("User", Page.User.Identity.Name);
            bar.Properties.Add("Welcome", _welcome);
            var sb = new StringBuilder();
            foreach (var c in CultureManager.SupportedCultures)
            {
                var ci = new CultureInfo(c.Split(',')[1]);
                sb.AppendFormat("{0}|{1}|{2};", c, ci.NativeName, ci.Equals(System.Threading.Thread.CurrentThread.CurrentUICulture));
            }
            bar.Properties.Add("Cultures", sb.ToString());
            if (IdleUserTimeout > 0)
                bar.Properties.Add("IdleUserTimeout", (IdleUserTimeout * 60000));
            Controls.Add(bar);
        }
    }
}
