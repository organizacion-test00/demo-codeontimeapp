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
    public class Category
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _id;

        private int _index;

        private string _headerText;

        private string _description;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _flow;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool? _wrap;

        private string _tab;

        private string _wizard;

        private string _template;

        private bool _floating;

        private bool _collapsed;

        public Category()
        {
        }

        public Category(XPathNavigator category, IXmlNamespaceResolver resolver)
        {
            this.Id = category.GetAttribute("id", string.Empty);
            this._index = Convert.ToInt32(category.Evaluate("count(preceding-sibling::c:category)", resolver));
            this._headerText = ((string)(category.GetAttribute("headerText", string.Empty)));
            var descriptionNav = category.SelectSingleNode("c:description", resolver);
            if (descriptionNav != null)
                this._description = descriptionNav.Value;
            _tab = category.GetAttribute("tab", string.Empty);
            _wizard = category.GetAttribute("wizard", string.Empty);
            _flow = category.GetAttribute("flow", string.Empty);
            var doWrap = category.GetAttribute("wrap", string.Empty);
            if (!(string.IsNullOrEmpty(doWrap)))
                _wrap = (doWrap == "true");
            var templateNav = category.SelectSingleNode("c:template", resolver);
            if (templateNav != null)
                this._template = templateNav.Value;
            _floating = (category.GetAttribute("floating", string.Empty) == "true");
            _collapsed = (category.GetAttribute("collapsed", string.Empty) == "true");
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

        public int Index
        {
            get
            {
                return _index;
            }
        }

        public string HeaderText
        {
            get
            {
                return _headerText;
            }
        }

        public string Description
        {
            get
            {
                return _description;
            }
        }

        public string Flow
        {
            get
            {
                return _flow;
            }
            set
            {
                _flow = value;
            }
        }

        public bool? Wrap
        {
            get
            {
                return _wrap;
            }
            set
            {
                _wrap = value;
            }
        }

        public string Tab
        {
            get
            {
                return _tab;
            }
            set
            {
                _tab = value;
            }
        }

        public string Wizard
        {
            get
            {
                return _wizard;
            }
            set
            {
                _wizard = value;
            }
        }

        public string Template
        {
            get
            {
                return _template;
            }
            set
            {
                _template = value;
            }
        }

        public bool Floating
        {
            get
            {
                return _floating;
            }
            set
            {
                _floating = value;
            }
        }

        public bool Collapsed
        {
            get
            {
                return _collapsed;
            }
            set
            {
                _collapsed = value;
            }
        }
    }
}
