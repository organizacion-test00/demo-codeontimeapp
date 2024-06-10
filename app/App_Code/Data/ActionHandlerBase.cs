using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.XPath;

namespace MyCompany.Data
{
    /// <summary>
    /// Links a data controller business rule to a method with its implementation.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple=true, Inherited=true)]
    public class RuleAttribute : Attribute
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _id;

        /// <summary>
        /// Links the method to the business rule by its Id.
        /// </summary>
        /// <param name="id">The Id of the data controller business rule.</param>
        public RuleAttribute(string id)
        {
            this.Id = id;
        }

        /// <summary>
        /// The Id of the data controller business rule.
        /// </summary>
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
    }

    public class ActionHandlerBase : MyCompany.Data.IActionHandler
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ActionArgs _arguments;

        private ActionResult _result;

        private List<string> _whitelist;

        private List<string> _blacklist;

        public ActionArgs Arguments
        {
            get
            {
                return _arguments;
            }
            set
            {
                _arguments = value;
            }
        }

        public ActionResult Result
        {
            get
            {
                if (_result == null)
                    _result = new ActionResult();
                return _result;
            }
            set
            {
                _result = value;
            }
        }

        public string Whitelist
        {
            get
            {
                if (_whitelist == null)
                    return string.Empty;
                return string.Join(",", _whitelist.ToArray());
            }
            set
            {
                _whitelist = new List<string>(value.Split(',', ';'));
            }
        }

        public string Blacklist
        {
            get
            {
                if (_blacklist == null)
                    return string.Empty;
                return string.Join(",", _blacklist.ToArray());
            }
            set
            {
                _blacklist = new List<string>(value.Split(',', ';'));
            }
        }

        public void PreventDefault()
        {
            PreventDefault(false);
        }

        public void PreventDefault(bool cancelSelectedValues)
        {
            if (_result != null)
            {
                _result.Canceled = true;
                if (cancelSelectedValues)
                    _result.CanceledSelectedValues = true;
            }
        }

        public void ClearBlackAndWhiteLists()
        {
            if (_whitelist != null)
                _whitelist.Clear();
            if (_blacklist != null)
                _blacklist.Clear();
        }

        protected void AddToWhitelist(string rule)
        {
            if (_whitelist == null)
                _whitelist = new List<string>();
            if (!(_whitelist.Contains(rule)))
                _whitelist.Add(rule);
        }

        protected void RemoveFromWhitelist(string rule)
        {
            if (_whitelist != null)
                _whitelist.Remove(rule);
        }

        public bool RuleInWhitelist(string rule)
        {
            return ((_whitelist == null) || ((_whitelist.Count == 0) || _whitelist.Contains(rule)));
        }

        protected void AddToBlacklist(string rule)
        {
            if (_blacklist == null)
                _blacklist = new List<string>();
            if (!(_blacklist.Contains(rule)))
                _blacklist.Add(rule);
        }

        protected void RemoveFromBlacklist(string rule)
        {
            if (_blacklist != null)
                _blacklist.Remove(rule);
        }

        public bool RuleInBlacklist(string rule)
        {
            return ((_blacklist != null) && _blacklist.Contains(rule));
        }

        [System.Diagnostics.DebuggerStepThrough()]
        protected virtual void ExecuteMethod(ActionArgs args, ActionResult result, ActionPhase phase)
        {
            var match = InternalExecuteMethod(args, result, phase, true, true);
            if (!match)
                match = InternalExecuteMethod(args, result, phase, true, false);
            if (!match)
                match = InternalExecuteMethod(args, result, phase, false, true);
            if (!match)
                InternalExecuteMethod(args, result, phase, false, false);
        }

        private bool InternalExecuteMethod(ActionArgs args, ActionResult result, ActionPhase phase, bool viewMatch, bool argumentMatch)
        {
            _arguments = args;
            _result = result;
            var success = false;
            var methods = GetType().GetMethods((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance)));
            foreach (var method in methods)
            {
                var filters = method.GetCustomAttributes(typeof(ControllerActionAttribute), true);
                foreach (ControllerActionAttribute action in filters)
                    if (((action.Controller == args.Controller) || (!(string.IsNullOrEmpty(args.Controller)) && Regex.IsMatch(args.Controller, action.Controller))) && ((!viewMatch && string.IsNullOrEmpty(action.View)) || (action.View == args.View)))
                    {
                        if ((action.CommandName == args.CommandName) && ((!argumentMatch && string.IsNullOrEmpty(action.CommandArgument)) || (action.CommandArgument == args.CommandArgument)))
                        {
                            if (action.Phase == phase)
                            {
                                var parameters = method.GetParameters();
                                if ((parameters.Length == 2) && ((parameters[0].ParameterType == typeof(ActionArgs)) && (parameters[1].ParameterType == typeof(ActionResult))))
                                    method.Invoke(this, new object[] {
                                                args,
                                                result});
                                else
                                {
                                    var arguments = new object[parameters.Length];
                                    for (var i = 0; (i < parameters.Length); i++)
                                    {
                                        var p = parameters[i];
                                        var v = SelectFieldValueObject(p.Name);
                                        if (v != null)
                                        {
                                            if (p.ParameterType.Equals(typeof(FieldValue)))
                                                arguments[i] = v;
                                            else
                                                try
                                                {
                                                    arguments[i] = DataControllerBase.ConvertToType(p.ParameterType, v.Value);
                                                }
                                                catch (Exception)
                                                {
                                                }
                                        }
                                    }
                                    method.Invoke(this, arguments);
                                    success = true;
                                }
                            }
                        }
                    }
            }
            return success;
        }

        protected virtual void BeforeSqlAction(ActionArgs args, ActionResult result)
        {
        }

        protected virtual void AfterSqlAction(ActionArgs args, ActionResult result)
        {
        }

        protected virtual void ExecuteAction(ActionArgs args, ActionResult result)
        {
        }

        void IActionHandler.BeforeSqlAction(ActionArgs args, ActionResult result)
        {
            ExecuteMethod(args, result, ActionPhase.Before);
            BeforeSqlAction(args, result);
        }

        void IActionHandler.AfterSqlAction(ActionArgs args, ActionResult result)
        {
            ExecuteMethod(args, result, ActionPhase.After);
            AfterSqlAction(args, result);
        }

        void IActionHandler.ExecuteAction(ActionArgs args, ActionResult result)
        {
            ExecuteMethod(args, result, ActionPhase.Execute);
            ExecuteAction(args, result);
        }

        public virtual FieldValue SelectFieldValueObject(string name)
        {
            return null;
        }

        protected virtual bool BuildingDataRows()
        {
            return false;
        }

        protected virtual void ExecuteRule(XPathNavigator rule)
        {
            ExecuteRule(rule.GetAttribute("id", string.Empty));
        }

        protected virtual void BlockRule(string id)
        {
            if (!(BuildingDataRows()))
                AddToBlacklist(id);
        }

        protected virtual void ExecuteRule(string ruleId)
        {
            var methods = GetType().GetMethods((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance)));
            foreach (var method in methods)
            {
                var ruleBindings = method.GetCustomAttributes(typeof(RuleAttribute), true);
                foreach (RuleAttribute ra in ruleBindings)
                    if (ra.Id == ruleId)
                    {
                        BlockRule(ruleId);
                        var parameters = method.GetParameters();
                        var arguments = new object[parameters.Length];
                        for (var i = 0; (i < parameters.Length); i++)
                        {
                            var p = parameters[i];
                            if (p.ParameterType.IsSubclassOf(typeof(BusinessRulesObjectModel)))
                            {
                                var self = p.ParameterType.Assembly.CreateInstance(p.ParameterType.FullName, true, BindingFlags.CreateInstance, null, new object[] {
                                            this}, System.Globalization.CultureInfo.CurrentCulture, null);
                                var fields = self.GetType().GetFields((BindingFlags.Instance | BindingFlags.NonPublic));
                                foreach (var fi in fields)
                                {
                                    var index = (fi.Name.IndexOf("_") + 1);
                                    var fieldName = fi.Name.Substring(index);
                                    if (fieldName.Length == 1)
                                        fieldName = fieldName.ToUpper();
                                    else
                                        fieldName = (char.ToUpperInvariant(fieldName[0]) + fieldName.Substring(1));
                                    var v = SelectFieldValueObject(fieldName);
                                    if (v != null)
                                        try
                                        {
                                            self.GetType().InvokeMember(fi.Name, (BindingFlags.SetField | (BindingFlags.Instance | BindingFlags.NonPublic)), null, self, new object[] {
                                                        DataControllerBase.ConvertToType(fi.FieldType, v.Value)});
                                        }
                                        finally
                                        {
                                            // release resources here
                                        }
                                }
                                arguments[i] = self;
                            }
                            else
                            {
                                var v = SelectFieldValueObject(p.Name);
                                if (v != null)
                                {
                                    if (p.ParameterType.Equals(typeof(FieldValue)))
                                        arguments[i] = v;
                                    else
                                        try
                                        {
                                            arguments[i] = DataControllerBase.ConvertToType(p.ParameterType, v.Value);
                                        }
                                        catch (Exception)
                                        {
                                        }
                                }
                            }
                        }
                        method.Invoke(this, arguments);
                    }
            }
        }

        /// <summary>
        /// Returns True if there are no field values with errors.
        /// </summary>
        /// <returns>True if all field values have a blank 'Error' property.</returns>
        protected bool ValidateInput()
        {
            if (Arguments != null)
                foreach (var v in Arguments.Values)
                    if (!(string.IsNullOrEmpty(v.Error)))
                        return false;
            return true;
        }
    }

    public class BusinessRulesObjectModel
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private BusinessRules _rules;

        public BusinessRulesObjectModel()
        {
        }

        public BusinessRulesObjectModel(BusinessRules rules)
        {
            this._rules = rules;
        }

        public FieldValue this[string name]
        {
            get
            {
                if (_rules == null)
                    return null;
                var fv = _rules.SelectFieldValueObject(name);
                if (fv == null)
                {
                    fv = new FieldValue(name, null, null, true)
                    {
                        Error = "This field is missing in the arguments."
                    };
                }
                return fv;
            }
        }

        protected virtual void UpdateFieldValue(string fieldName, object value)
        {
            if (this._rules != null)
                this._rules.UpdateFieldValue(fieldName, value);
        }

        public static T CreateInstance<T>(params System.Object[] values)

        {
            var parameters = new BusinessObjectParameters(values);
            var instance = ((T)(Activator.CreateInstance(typeof(T))));
            var instanceType = instance.GetType();
            foreach (var name in parameters.Keys)
            {
                var pi = instanceType.GetProperty(name.Substring(1), (BindingFlags.IgnoreCase | (BindingFlags.Public | BindingFlags.Instance)));
                if (pi != null)
                    try
                    {
                        var v = parameters[name];
                        if ((v != null) && pi.PropertyType.IsGenericType)
                            v = Convert.ChangeType(v, Nullable.GetUnderlyingType(pi.PropertyType));
                        pi.SetValue(instance, v);
                    }
                    catch (Exception ex)
                    {
                        throw new Exception(string.Format("{0}.{1}: {2}", instanceType.Name, pi.Name, ex.Message));
                    }
            }
            return instance;
        }
    }
}
