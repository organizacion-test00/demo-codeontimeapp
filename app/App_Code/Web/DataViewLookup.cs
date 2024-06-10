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
using System.Web.UI.WebControls.WebParts;
using MyCompany.Data;

namespace MyCompany.Web
{
    [DefaultProperty("SelectedValue")]
    [ControlValueProperty("SelectedValue")]
    [DefaultEvent("SelectedValueChanged")]
    public class DataViewLookup : System.Web.UI.Control, INamingContainer
    {

        private bool _autoPostBack;

        private bool _allowCreateItems = true;

        private string _dataController;

        private string _dataView;

        private string _dataValueField;

        private string _dataTextField;

        private HtmlGenericControl _span;

        private DataViewExtender _extender;

        public DataViewLookup()
        {
        }

        [System.ComponentModel.Category("Behavior")]
        [System.ComponentModel.DefaultValue(false)]
        public bool AutoPostBack
        {
            get
            {
                return _autoPostBack;
            }
            set
            {
                _autoPostBack = value;
            }
        }

        [System.ComponentModel.DefaultValue(true)]
        public bool AllowCreateItems
        {
            get
            {
                return _allowCreateItems;
            }
            set
            {
                _allowCreateItems = value;
            }
        }

        [System.ComponentModel.Browsable(false)]
        public string SelectedValue
        {
            get
            {
                var v = ((string)(ViewState["SelectedValue"]));
                if (v == null)
                    v = string.Empty;
                return v;
            }
            set
            {
                ViewState["SelectedValue"] = value;
            }
        }

        [System.ComponentModel.Category("Data")]
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

        [System.ComponentModel.Category("Data")]
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

        [System.ComponentModel.Category("Data")]
        public string DataValueField
        {
            get
            {
                return _dataValueField;
            }
            set
            {
                _dataValueField = value;
            }
        }

        [System.ComponentModel.Category("Data")]
        public string DataTextField
        {
            get
            {
                return _dataTextField;
            }
            set
            {
                _dataTextField = value;
            }
        }

        protected string LookupText
        {
            get
            {
                var text = ((string)(ViewState["LookupText"]));
                if (string.IsNullOrEmpty(text) && !(string.IsNullOrEmpty(SelectedValue)))
                {
                    text = Controller.LookupText(DataController, string.Format("{0}:={1}", DataValueField, SelectedValue), DataTextField);
                    ViewState["LookupText"] = text;
                }
                if (string.IsNullOrEmpty(text))
                    text = "(select)";
                return text;
            }
            set
            {
                ViewState["LookupText"] = value;
            }
        }

        [System.ComponentModel.Category("Behavior")]
        [System.ComponentModel.DefaultValue(true)]
        public bool Enabled
        {
            get
            {
                var v = ViewState["Enabled"];
                if (v == null)
                    return true;
                return ((bool)(v));
            }
            set
            {
                ViewState["Enabled"] = value;
            }
        }

        [System.ComponentModel.Category("Accessibility")]
        [System.ComponentModel.DefaultValue(0)]
        public int TabIndex
        {
            get
            {
                var v = ViewState["TabIndex"];
                if (v == null)
                    return 0;
                return ((int)(v));
            }
            set
            {
                ViewState["TabIndex"] = value;
            }
        }

        public event EventHandler<EventArgs> SelectedValueChanged;

        protected virtual void OnSelectedValueChanged(EventArgs e)
        {
            if (this.SelectedValueChanged != null)
                this.SelectedValueChanged(this, e);
        }

        protected override void OnInit(EventArgs e)
        {
            base.OnInit(e);
            if (!DesignMode)
            {
                _span = new HtmlGenericControl("span")
                {
                    ID = "s"
                };
                Controls.Add(_span);
                _extender = new DataViewExtender()
                {
                    ID = "e",
                    TargetControlID = _span.ID
                };
                Controls.Add(_extender);
            }
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            if (Page.IsPostBack)
            {
                var valueKey = (_extender.ClientID + "_Item0");
                if (Page.Request.Form.AllKeys.Contains(valueKey))
                {
                    SelectedValue = Page.Request.Form[valueKey];
                    LookupText = Page.Request.Form[(_extender.ClientID + "_Text0")];
                    OnSelectedValueChanged(EventArgs.Empty);
                }
            }
        }

        protected override void OnPreRender(EventArgs e)
        {
            base.OnPreRender(e);
            _span.InnerHtml = string.Format("<table cellpadding=\"0\" cellspacing=\"0\" class=\"DataViewLookup\"><tr><td>{0}</td></t" +
                    "r></table>", HttpUtility.HtmlEncode(LookupText));
            _extender.Controller = DataController;
            _extender.View = DataView;
            _extender.LookupValue = SelectedValue;
            _extender.LookupText = LookupText;
            _extender.AllowCreateLookupItems = AllowCreateItems;
            _extender.Enabled = Enabled;
            _extender.TabIndex = TabIndex;
            if (AutoPostBack)
                _extender.LookupPostBackExpression = Page.ClientScript.GetPostBackEventReference(this, null);
        }

        protected override void Render(HtmlTextWriter writer)
        {
            if (Site != null)
            {
                writer.RenderBeginTag(HtmlTextWriterTag.Span);
                writer.Write("DataViewLookup (");
                writer.Write(DataValueField);
                writer.Write("=>");
                writer.Write(DataController);
                if (!(string.IsNullOrEmpty("DataView")))
                {
                    writer.Write(", ");
                    writer.Write(DataView);
                }
                writer.Write(")");
                writer.RenderEndTag();
            }
            else
                base.Render(writer);
            // add a hidden field to support UpdatePanel with partial rendering
            writer.AddAttribute(HtmlTextWriterAttribute.Type, "hidden");
            writer.AddAttribute(HtmlTextWriterAttribute.Id, ClientID);
            writer.RenderBeginTag(HtmlTextWriterTag.Input);
            writer.RenderEndTag();
        }

        public void Clear()
        {
            SelectedValue = null;
            LookupText = null;
        }
    }
}
