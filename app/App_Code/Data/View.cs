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
using System.IO;

namespace MyCompany.Data
{
    public class View
    {

        private string _id;

        private string _label;

        private string _headerText;

        private string _type;

        private string _group;

        private bool _showInSelector;

        private string _tags;

        public View()
        {
        }

        public View(XPathNavigator view, XPathNavigator mainView, IXmlNamespaceResolver resolver)
        {
            this._id = view.GetAttribute("id", string.Empty);
            this._type = view.GetAttribute("type", string.Empty);
            if (this._id == mainView.GetAttribute("virtualViewId", string.Empty))
                view = mainView;
            this._label = view.GetAttribute("label", string.Empty);
            var headerTextNav = view.SelectSingleNode("c:headerText", resolver);
            if (headerTextNav != null)
                this._headerText = headerTextNav.Value;
            _group = view.GetAttribute("group", string.Empty);
            _tags = view.GetAttribute("tags", string.Empty);
            _showInSelector = !((view.GetAttribute("showInSelector", string.Empty) == "false"));
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

        public string Label
        {
            get
            {
                return _label;
            }
        }

        public string Type
        {
            get
            {
                return _type;
            }
        }

        public string Group
        {
            get
            {
                return _group;
            }
        }

        public bool ShowInSelector
        {
            get
            {
                return _showInSelector;
            }
        }

        public string Tags
        {
            get
            {
                return _tags;
            }
        }

        public string HeaderText()
        {
            return _headerText;
        }
    }
}
