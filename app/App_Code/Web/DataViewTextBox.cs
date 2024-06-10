using System;
using System.Data;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Linq;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;

namespace MyCompany.Web
{
    public class DataViewTextBox : TextBox, IScriptControl
    {

        private string _dataController;

        private string _dataView;

        private string _distinctValueFieldName;

        private int _minimumPrefixLength;

        private int _completionInterval;

        public DataViewTextBox() :
                base()
        {
            _completionInterval = 500;
            _minimumPrefixLength = 1;
        }

        [Category("Auto Complete")]
        public string DataController
        {
            get
            {
                return _dataController;
            }
            set
            {
                _dataController = value;
            }
        }

        [Category("Auto Complete")]
        public string DataView
        {
            get
            {
                return _dataView;
            }
            set
            {
                _dataView = value;
            }
        }

        [Category("Auto Complete")]
        public string DistinctValueFieldName
        {
            get
            {
                return _distinctValueFieldName;
            }
            set
            {
                _distinctValueFieldName = value;
            }
        }

        [Category("Auto Complete")]
        [DefaultValue(1)]
        public int MinimumPrefixLength
        {
            get
            {
                return _minimumPrefixLength;
            }
            set
            {
                _minimumPrefixLength = value;
            }
        }

        [Category("Auto Complete")]
        [DefaultValue(500)]
        public int CompletionInterval
        {
            get
            {
                return _completionInterval;
            }
            set
            {
                _completionInterval = value;
            }
        }

        protected override void OnPreRender(EventArgs e)
        {
            base.OnPreRender(e);
            var sm = ScriptManager.GetCurrent(Page);
            if (sm != null)
            {
                sm.RegisterScriptControl(this);
                sm.RegisterScriptDescriptors(this);
            }
        }

        IEnumerable<ScriptDescriptor> IScriptControl.GetScriptDescriptors()
        {
            var descriptor = new ScriptBehaviorDescriptor("Sys.Extended.UI.AutoCompleteBehavior", ClientID);
            descriptor.AddProperty("id", ClientID);
            descriptor.AddProperty("completionInterval", CompletionInterval);
            descriptor.AddProperty("contextKey", string.Format("{0},{1},{2}", DataController, DataView, DistinctValueFieldName));
            descriptor.AddProperty("delimiterCharacters", ",;");
            descriptor.AddProperty("minimumPrefixLength", MinimumPrefixLength);
            descriptor.AddProperty("serviceMethod", "GetCompletionList");
            descriptor.AddProperty("servicePath", ResolveClientUrl("~/Services/DataControllerService.asmx"));
            descriptor.AddProperty("useContextKey", true);
            return new ScriptBehaviorDescriptor[] {
                    descriptor};
        }

        IEnumerable<ScriptReference> IScriptControl.GetScriptReferences()
        {
            var scripts = new List<ScriptReference>();
            return scripts;
        }
    }
}
