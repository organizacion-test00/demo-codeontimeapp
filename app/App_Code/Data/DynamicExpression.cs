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
    public enum DynamicExpressionScope
    {

        Field,

        ViewRowStyle,

        CategoryVisibility,

        DataFieldVisibility,

        DefaultValues,

        ReadOnly,

        Rule,
    }

    public enum DynamicExpressionType
    {

        RegularExpression,

        ClientScript,
    }

    public class DynamicExpression
    {

        private DynamicExpressionScope _scope;

        private string _target;

        private DynamicExpressionType _type;

        private string _test;

        private string _result;

        private string _viewId;

        public DynamicExpression()
        {
        }

        public DynamicExpression(XPathNavigator expression, XmlNamespaceManager nm)
        {
            var scope = expression.SelectSingleNode("parent::c:*", nm);
            var target = expression.SelectSingleNode("parent::c:*/parent::c:*", nm);
            if (scope.LocalName == "validate")
            {
                _scope = DynamicExpressionScope.Field;
                _target = target.GetAttribute("name", string.Empty);
            }
            else
            {
                if (scope.LocalName == "styles")
                {
                    _scope = DynamicExpressionScope.ViewRowStyle;
                    _target = target.GetAttribute("id", string.Empty);
                }
                else
                {
                    if (scope.LocalName == "visibility")
                    {
                        // determine the scope and target of visibility
                        if (target.LocalName == "field")
                        {
                            _scope = DynamicExpressionScope.DataFieldVisibility;
                            _target = target.GetAttribute("name", string.Empty);
                        }
                        else
                        {
                            if (target.LocalName == "dataField")
                            {
                                _scope = DynamicExpressionScope.DataFieldVisibility;
                                _target = target.GetAttribute("fieldName", string.Empty);
                            }
                            else
                            {
                                if (target.LocalName == "category")
                                {
                                    _scope = DynamicExpressionScope.CategoryVisibility;
                                    _target = target.GetAttribute("id", string.Empty);
                                }
                            }
                        }
                    }
                    else
                    {
                        if (scope.LocalName == "defaultValues")
                        {
                            // determine the scope and target of default values
                            if (target.LocalName == "field")
                            {
                                _scope = DynamicExpressionScope.DataFieldVisibility;
                                _target = target.GetAttribute("name", string.Empty);
                            }
                            else
                            {
                                if (target.LocalName == "dataField")
                                {
                                    _scope = DynamicExpressionScope.DataFieldVisibility;
                                    _target = target.GetAttribute("fieldName", string.Empty);
                                }
                            }
                        }
                        else
                        {
                            if (scope.LocalName == "readOnly")
                            {
                                // determine the scope and target of read-only expression
                                if (target.LocalName == "field")
                                {
                                    _scope = DynamicExpressionScope.ReadOnly;
                                    _target = target.GetAttribute("name", string.Empty);
                                }
                                else
                                {
                                    if (target.LocalName == "dataField")
                                    {
                                        _scope = DynamicExpressionScope.ReadOnly;
                                        _target = target.GetAttribute("fieldName", string.Empty);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            var expressionType = expression.GetAttribute("type", string.Empty);
            if (string.IsNullOrEmpty(expressionType))
                expressionType = "ClientScript";
            _type = ((DynamicExpressionType)(TypeDescriptor.GetConverter(typeof(DynamicExpressionType)).ConvertFromString(expressionType)));
            _test = expression.GetAttribute("test", string.Empty);
            _result = expression.GetAttribute("result", string.Empty);
            if (_result == string.Empty)
                _result = null;
            _viewId = ((string)(expression.Evaluate("string(ancestor::c:view/@id)", nm)));
        }

        public DynamicExpressionScope Scope
        {
            get
            {
                return _scope;
            }
            set
            {
                _scope = value;
            }
        }

        public string Target
        {
            get
            {
                return _target;
            }
            set
            {
                _target = value;
            }
        }

        public DynamicExpressionType Type
        {
            get
            {
                return _type;
            }
            set
            {
                _type = value;
            }
        }

        public string Test
        {
            get
            {
                return _test;
            }
            set
            {
                _test = value;
            }
        }

        public string Result
        {
            get
            {
                return _result;
            }
            set
            {
                _result = value;
            }
        }

        public string ViewId
        {
            get
            {
                return _viewId;
            }
            set
            {
                _viewId = value;
            }
        }

        public bool AllowedInView(string view)
        {
            return (string.IsNullOrEmpty(_viewId) || (_viewId == view));
        }
    }
}
