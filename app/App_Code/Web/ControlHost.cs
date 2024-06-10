using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;

namespace MyCompany.Web
{
    public class ControlHost : System.Web.UI.Page
    {

        public override string Theme
        {
            get
            {
                return base.Theme;
            }
            set
            {
                // Themes are not supported in editors.
            }
        }

        protected override void OnInit(EventArgs e)
        {
            Controls.Add(new LiteralControl("\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.or" +
                        "g/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xh" +
                        "tml\" style=\"overflow: hidden\">\n"));
            var head = new HtmlHead();
            Controls.Add(head);
            head.Controls.Add(new LiteralControl(@"
    <script type=""text/javascript"">
        function pageLoad() {
            var m = location.href.match(/(\?|&)id=(.+?)(&|$)/);
            if (!(parent && parent.window.Web) || !m) return;
            var elem = parent.window.$get(m[2]);
            if (!elem) return;
            if (typeof (FieldEditor_SetValue) !== ""undefined"")
                FieldEditor_SetValue(elem.value);
            else
                alert('The field editor does not implement ""FieldEditor_SetValue"" function.');
            if (typeof (FieldEditor_GetValue) !== ""undefined"")
                parent.window.Web.DataView.Editors[elem.id] = { 'GetValue': FieldEditor_GetValue, 'SetValue': FieldEditor_SetValue };
            else
                alert('The field editor does not implement ""FieldEditor_GetValue"" function.');
        }
    </script>
"));
            head.Controls.Add(new LiteralControl("\n    <style type=\"text/css\">\n        .ajax__htmleditor_editor_container\n        {" +
                        "\n            border-width:0px!important;\n        }\n\n        .ajax__htmleditor_ed" +
                        "itor_bottomtoolbar\n        {\n            padding-top:2px!important;\n        }\n  " +
                        "  </style>"));
            Controls.Add(new LiteralControl("\n<body style=\"margin: 0px; padding: 0px; background-color: #fff;\">\n"));
            var form = new HtmlForm();
            Controls.Add(form);
            var sm = new ScriptManager()
            {
                ScriptMode = ScriptMode.Release
            };
            form.Controls.Add(sm);
            var controlName = Request.Params["control"];
            Control c = null;
            if (!(string.IsNullOrEmpty(controlName)))
            {
                try
                {
                    c = LoadControl(string.Format("~/Controls/{0}.ascx", controlName));
                }
                catch (Exception)
                {
                }
                if (c != null)
                {
                    var editorAttributes = c.GetType().GetCustomAttributes(typeof(AquariumFieldEditorAttribute), true);
                    if (editorAttributes.Length == 0)
                        c = null;
                }
                else
                {
                    if (controlName == "RichEditor")
                    {
                    }
                }
            }
            if (c == null)
                throw new HttpException(404, string.Empty);
            else
            {
                form.Controls.Add(c);
                if (!((c is System.Web.UI.UserControl)))
                    this.ClientScript.RegisterClientScriptBlock(GetType(), "ClientScripts", string.Format("function FieldEditor_GetValue(){{return $find(\'{0}\').get_content();}}\nfunction Fi" +
                                "eldEditor_SetValue(value) {{$find(\'{0}\').set_content(value);}}", c.ClientID), true);
            }
            Controls.Add(new LiteralControl("\n\n</body>\n</html>"));
            base.OnInit(e);
            EnableViewState = false;
        }
    }
}
