using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.XPath;
using System.Web;
using System.Web.Caching;
using System.Web.Configuration;
using System.Web.Security;

namespace MyCompany.Data
{
    public class Action
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _id;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _commandName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _commandArgument;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _headerText;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _description;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _cssClass;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _confirmation;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _notify;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenLastCommandName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenLastCommandArgument;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _whenKeySelected;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenClientScript;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _causesValidation;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenTag;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenHRef;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _whenView;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _key;

        public Action()
        {
        }

        public Action(XPathNavigator action, IXmlNamespaceResolver resolver)
        {
            this._id = action.GetAttribute("id", string.Empty);
            this._commandName = action.GetAttribute("commandName", string.Empty);
            this._commandArgument = action.GetAttribute("commandArgument", string.Empty);
            this._headerText = action.GetAttribute("headerText", string.Empty);
            this._description = action.GetAttribute("description", string.Empty);
            this._cssClass = action.GetAttribute("cssClass", string.Empty);
            this._confirmation = action.GetAttribute("confirmation", string.Empty);
            this._notify = action.GetAttribute("notify", string.Empty);
            this._whenLastCommandName = action.GetAttribute("whenLastCommandName", string.Empty);
            this._whenLastCommandArgument = action.GetAttribute("whenLastCommandArgument", string.Empty);
            this._causesValidation = !((action.GetAttribute("causesValidation", string.Empty) == "false"));
            this._whenKeySelected = (action.GetAttribute("whenKeySelected", string.Empty) == "true");
            this._whenTag = action.GetAttribute("whenTag", string.Empty);
            this._whenHRef = action.GetAttribute("whenHRef", string.Empty);
            this._whenView = action.GetAttribute("whenView", string.Empty);
            this._whenClientScript = action.GetAttribute("whenClientScript", string.Empty);
            this._key = action.GetAttribute("key", string.Empty);
        }

        public string Id
        {
            get
            {
                return _id;
            }
            set
            {
                _id = value;
            }
        }

        public string CommandName
        {
            get
            {
                return _commandName;
            }
            set
            {
                _commandName = value;
            }
        }

        public string CommandArgument
        {
            get
            {
                return _commandArgument;
            }
            set
            {
                _commandArgument = value;
            }
        }

        public string HeaderText
        {
            get
            {
                return _headerText;
            }
            set
            {
                _headerText = value;
            }
        }

        public string Description
        {
            get
            {
                return _description;
            }
            set
            {
                _description = value;
            }
        }

        public string CssClass
        {
            get
            {
                return _cssClass;
            }
            set
            {
                _cssClass = value;
            }
        }

        public string Confirmation
        {
            get
            {
                return _confirmation;
            }
            set
            {
                _confirmation = value;
            }
        }

        public string Notify
        {
            get
            {
                return _notify;
            }
            set
            {
                _notify = value;
            }
        }

        public string WhenLastCommandName
        {
            get
            {
                return _whenLastCommandName;
            }
            set
            {
                _whenLastCommandName = value;
            }
        }

        public string WhenLastCommandArgument
        {
            get
            {
                return _whenLastCommandArgument;
            }
            set
            {
                _whenLastCommandArgument = value;
            }
        }

        public bool WhenKeySelected
        {
            get
            {
                return _whenKeySelected;
            }
            set
            {
                _whenKeySelected = value;
            }
        }

        public string WhenClientScript
        {
            get
            {
                return _whenClientScript;
            }
            set
            {
                _whenClientScript = value;
            }
        }

        public bool CausesValidation
        {
            get
            {
                return _causesValidation;
            }
            set
            {
                _causesValidation = value;
            }
        }

        public string WhenTag
        {
            get
            {
                return _whenTag;
            }
            set
            {
                _whenTag = value;
            }
        }

        public string WhenHRef
        {
            get
            {
                return _whenHRef;
            }
            set
            {
                _whenHRef = value;
            }
        }

        public string WhenView
        {
            get
            {
                return _whenView;
            }
            set
            {
                _whenView = value;
            }
        }

        public string Key
        {
            get
            {
                return _key;
            }
            set
            {
                _key = value;
            }
        }
    }
}
