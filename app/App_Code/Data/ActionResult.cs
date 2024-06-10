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
    public class ActionResult
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _tag;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<string> _errors;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<FieldValue> _values;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _canceledSelectedValues;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _canceled;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _navigateUrl;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _clientScript;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _rowsAffected;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _keepSelection;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _clearSelection;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _filter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _sortExpression;

        private bool _rowNotFound;

        public ActionResult()
        {
            this._errors = new List<string>();
            this._values = new List<FieldValue>();
        }

        public string Tag
        {
            get
            {
                return _tag;
            }
            set
            {
                _tag = value;
            }
        }

        public List<string> Errors
        {
            get
            {
                return _errors;
            }
        }

        public List<FieldValue> Values
        {
            get
            {
                return _values;
            }
        }

        public bool CanceledSelectedValues
        {
            get
            {
                return _canceledSelectedValues;
            }
            set
            {
                _canceledSelectedValues = value;
            }
        }

        public bool Canceled
        {
            get
            {
                return _canceled;
            }
            set
            {
                _canceled = value;
            }
        }

        public string NavigateUrl
        {
            get
            {
                return _navigateUrl;
            }
            set
            {
                _navigateUrl = value;
            }
        }

        public string ClientScript
        {
            get
            {
                return _clientScript;
            }
            set
            {
                _clientScript = value;
            }
        }

        public int RowsAffected
        {
            get
            {
                return _rowsAffected;
            }
            set
            {
                _rowsAffected = value;
            }
        }

        public bool KeepSelection
        {
            get
            {
                return _keepSelection;
            }
            set
            {
                _keepSelection = value;
            }
        }

        public bool ClearSelection
        {
            get
            {
                return _clearSelection;
            }
            set
            {
                _clearSelection = value;
            }
        }

        public string[] Filter
        {
            get
            {
                return _filter;
            }
            set
            {
                _filter = value;
            }
        }

        public string SortExpression
        {
            get
            {
                return _sortExpression;
            }
            set
            {
                _sortExpression = value;
            }
        }

        public bool RowNotFound
        {
            get
            {
                return _rowNotFound;
            }
            set
            {
                _rowNotFound = value;
            }
        }

        public void RaiseExceptionIfErrors()
        {
            if (Errors.Count > 0)
            {
                var sb = new StringBuilder();
                foreach (var er in Errors)
                {
                    sb.AppendLine(er);
                    throw new Exception(sb.ToString());
                }
            }
        }

        public T ToObject<T>()

        {
            var objectType = typeof(T);
            var theObject = ((T)(objectType.Assembly.CreateInstance(objectType.FullName)));
            AssignTo(theObject);
            return theObject;
        }

        public void AssignTo(object instance)
        {
            foreach (var v in Values)
                v.AssignTo(instance);
        }

        public void ShowMessage(string format, params System.Object[] args)
        {
            ShowMessage(string.Format(format, args));
        }

        public void ShowMessage(string message)
        {
            ExecuteOnClient("Web.DataView.showMessage(\'{0}\');", BusinessRules.JavaScriptString(message));
        }

        public void ShowViewMessage(string format, params System.Object[] args)
        {
            ShowViewMessage(string.Format(format, args));
        }

        public void ShowViewMessage(string message)
        {
            ExecuteOnClient("this.showViewMessage(\'{0}\');", BusinessRules.JavaScriptString(message));
        }

        public void Focus(string fieldName, string fmt, params System.Object[] args)
        {
            ExecuteOnClient("this._serverFocus(\'{0}\',\'{1}\');", fieldName, BusinessRules.JavaScriptString(string.Format(fmt, args)));
        }

        public void Focus(string fieldName)
        {
            Focus(fieldName, string.Empty);
        }

        public void ExecuteOnClient(string javaScriptFormatString, params System.Object[] args)
        {
            ExecuteOnClient(string.Format(javaScriptFormatString, args));
        }

        public void ExecuteOnClient(string javaScript)
        {
            if (!(string.IsNullOrEmpty(ClientScript)) && !(ClientScript.EndsWith(";")))
                ClientScript = (ClientScript + ";");
            if (!(string.IsNullOrEmpty(javaScript)))
                ClientScript = (ClientScript + javaScript);
        }

        public void ShowLastView()
        {
            ExecuteOnClient("this.goToView(this._lastViewId);");
        }

        public void ShowView(string viewId)
        {
            ExecuteOnClient("this.goToView(\'{0}\');", viewId);
        }

        public void ShowAlert(string message)
        {
            ExecuteOnClient("$app.alert(\'{0}\');", BusinessRules.JavaScriptString(message));
        }

        public void ShowAlert(string fmt, params System.Object[] args)
        {
            ShowAlert(string.Format(fmt, args));
        }

        public void HideModal()
        {
            ExecuteOnClient("this.endModalState(\'Cancel\');");
        }

        public void ShowModal(string controller, string view, string startCommandName, string startCommandArgument)
        {
            ExecuteOnClient("if(this._container&&this.get_controller()==\'{0}\'){{this._savePosition();this._sho" +
                    "wModal({{commandName:\'{2}\',commandArgument:\'{3}\'}});}}else Web.DataView.showModa" +
                    "l(null, \'{0}\', \'{1}\', \'{2}\', \'{3}\');", controller, view, startCommandName, startCommandArgument);
        }

        public void SelectFirstRow()
        {
            ExecuteOnClient("this.set_autoSelectFirstRow(true);this._autoSelect();");
        }

        public void HighlightFirstRow()
        {
            ExecuteOnClient("this.set_autoHighlightFirstRow(true);this._autoSelect();");
        }

        /// <summary>
        /// Refreshes the data view that has caused execution of business rules. Fresh data will be fetched from the server.
        /// </summary>
        public void Refresh()
        {
            Refresh(true);
        }

        /// <summary>
        /// Refreshes the data view that has caused execution of business rules.
        /// </summary>
        /// <param name="fetch">Indicates that the fresh data must be fetched from the server.</param>
        public void Refresh(bool fetch)
        {
            var noFetch = !fetch;
            ExecuteOnClient("this.refresh({0});", noFetch.ToString().ToLower());
        }

        /// <summary>
        /// Refreshes the children of the data view that has caused execution of business rules.
        /// </summary>
        public void RefreshChildren()
        {
            ExecuteOnClient("this.refreshChildren();");
        }

        /// <summary>
        /// Ensures that the action state machine will execute an iteration when the server response is returned to the client library.
        /// </summary>
        public void Continue()
        {
            var script = "this._continueAfterScript=true;";
            if (string.IsNullOrEmpty(ClientScript) || !(ClientScript.Contains(script)))
                ExecuteOnClient(script);
        }

        public void Merge(ViewPage page)
        {
            page.ClientScript = ClientScript;
        }

        public void Merge(ActionResult result)
        {
            foreach (var er in result.Errors)
                Errors.Add(er);
            ClientScript = (ClientScript + result.ClientScript);
            foreach (var v in result.Values)
                Values.Add(v);
        }

        public void EnsureJsonCompatibility()
        {
            if (Values != null)
                foreach (var v in Values)
                    if (v.Modified)
                    {
                        v.DisableConversion();
                        v.NewValue = DataControllerBase.EnsureJsonCompatibility(v.NewValue);
                        v.EnableConversion();
                    }
        }
    }
}
