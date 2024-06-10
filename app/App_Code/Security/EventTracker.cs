using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Xml.XPath;
using System.Web;
using System.Web.Security;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Security
{
    public partial class EventTracker : EventTrackerBase
    {
    }

    public class EventTrackerBase
    {

        private static Regex _modifiedByUserNameRegex = null;

        private static Regex _modifiedByUserIdRegex = null;

        private static Regex _modifiedOnRegex = null;

        private static Regex _createdByUserNameRegex = null;

        private static Regex _createdByUserIdRegex = null;

        private static Regex _createdOnRegex = null;

        private string _email;

        private object _userId;

        public EventTrackerBase()
        {
        }

        public virtual string Email
        {
            get
            {
                EnsureMembershipUserProperties();
                return _email;
            }
        }

        public virtual object UserId
        {
            get
            {
                EnsureMembershipUserProperties();
                return _userId;
            }
        }

        public virtual string UserName
        {
            get
            {
                return HttpContext.Current.User.Identity.Name;
            }
        }

        public virtual string DateTimeFormatString
        {
            get
            {
                return "{0:g}";
            }
        }

        public virtual bool IsModifiedByUserNamePattern(string fieldName)
        {
            return ((_modifiedByUserNameRegex != null) && _modifiedByUserNameRegex.IsMatch(fieldName));
        }

        public virtual bool IsModifiedByUserIdPattern(string fieldName)
        {
            return ((_modifiedByUserIdRegex != null) && _modifiedByUserIdRegex.IsMatch(fieldName));
        }

        public virtual bool IsModifiedOnPattern(string fieldName)
        {
            return ((_modifiedOnRegex != null) && _modifiedOnRegex.IsMatch(fieldName));
        }

        public virtual bool IsCreatedByUserNamePattern(string fieldName)
        {
            return ((_createdByUserNameRegex != null) && _createdByUserNameRegex.IsMatch(fieldName));
        }

        public virtual bool IsCreatedByUserIdPattern(string fieldName)
        {
            return ((_createdByUserIdRegex != null) && _createdByUserIdRegex.IsMatch(fieldName));
        }

        public virtual bool IsCreatedOnPattern(string fieldName)
        {
            return ((_createdOnRegex != null) && _createdOnRegex.IsMatch(fieldName));
        }

        public static void Process(ViewPage page, PageRequest request)
        {
            var tracker = new EventTracker();
            tracker.InternalProcess(page, request);
        }

        protected virtual bool IsNewRow(ViewPage page, PageRequest request)
        {
            if (request.Inserting && (page.NewRow == null))
                page.NewRow = new object[page.Fields.Count];
            return request.Inserting;
        }

        protected virtual void InternalProcess(ViewPage page, PageRequest request)
        {
            var index = 0;
            foreach (var field in page.Fields)
            {
                if (!field.ReadOnly)
                {
                    if (IsCreatedByUserIdPattern(field.Name) || IsModifiedByUserIdPattern(field.Name))
                    {
                        field.TextMode = TextInputMode.Static;
                        if (string.IsNullOrEmpty(field.ItemsDataController) || request.Inserting)
                            field.Hidden = true;
                        else
                        {
                            if (!ApplicationServicesBase.IsSuperUser)
                                field.Tag = (field.Tag + " lookup-details-hidden");
                        }
                        if (IsNewRow(page, request) && (page.NewRow[index] == null))
                            page.NewRow[index] = UserId;
                    }
                    else
                    {
                        if (IsCreatedByUserNamePattern(field.Name) || IsModifiedByUserNamePattern(field.Name))
                        {
                            field.TextMode = TextInputMode.Static;
                            if (IsNewRow(page, request) && (page.NewRow[index] == null))
                                page.NewRow[index] = UserName;
                        }
                        else
                        {
                            if (IsCreatedOnPattern(field.Name) || IsModifiedOnPattern(field.Name))
                            {
                                field.TextMode = TextInputMode.Static;
                                field.DataFormatString = DateTimeFormatString;
                                if (request.Inserting)
                                    field.Hidden = true;
                                if (IsNewRow(page, request) && (page.NewRow[index] == null))
                                    page.NewRow[index] = DateTime.Now;
                            }
                        }
                    }
                }
                index++;
            }
        }

        public static void Process(ActionArgs args, ControllerConfiguration config)
        {
            if ((args.CommandName == "Update") || (args.CommandName == "Insert"))
            {
                var tracker = new EventTracker();
                tracker.InternalProcess(args, config);
            }
        }

        protected virtual void InternalProcess(ActionArgs args, ControllerConfiguration config)
        {
            var updating = (args.CommandName == "Update");
            var hasCreatedByUserId = updating;
            var hasCreatedByUserName = updating;
            var hasCreatedOn = updating;
            var hasModifiedByUserId = false;
            var hasModifiedByUserName = false;
            var hasModifiedOn = false;
            // assign tracking values to field values passed from the client
            foreach (var v in args.Values)
                if (!v.ReadOnly)
                {
                    if (!hasCreatedByUserId && IsCreatedByUserIdPattern(v.Name))
                    {
                        hasCreatedByUserId = true;
                        if (v.Value == null)
                        {
                            v.NewValue = UserId;
                            v.Modified = true;
                        }
                    }
                    else
                    {
                        if (!hasCreatedByUserName && IsCreatedByUserNamePattern(v.Name))
                        {
                            hasCreatedByUserName = true;
                            if (v.Value == null)
                            {
                                v.NewValue = UserName;
                                v.Modified = true;
                            }
                        }
                        else
                        {
                            if (!hasCreatedOn && IsCreatedOnPattern(v.Name))
                            {
                                hasCreatedOn = true;
                                if (v.Value == null)
                                {
                                    v.NewValue = DateTime.Now;
                                    v.Modified = true;
                                }
                            }
                            else
                            {
                                if (!hasModifiedByUserId && IsModifiedByUserIdPattern(v.Name))
                                {
                                    hasModifiedByUserId = true;
                                    v.NewValue = UserId;
                                    v.Modified = true;
                                }
                                else
                                {
                                    if (!hasModifiedByUserName && IsModifiedByUserNamePattern(v.Name))
                                    {
                                        hasModifiedByUserName = true;
                                        v.NewValue = UserName;
                                        v.Modified = true;
                                    }
                                    else
                                    {
                                        if (!hasModifiedOn && IsModifiedOnPattern(v.Name))
                                        {
                                            hasModifiedOn = true;
                                            v.NewValue = DateTime.Now;
                                            v.Modified = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            // assign missing tracking values
            var values = new List<FieldValue>(args.Values);
            var fieldIterator = config.Select("/c:dataController/c:fields/c:field[not(@readOnly=\'true\')]");
            while (fieldIterator.MoveNext())
            {
                var fieldName = fieldIterator.Current.GetAttribute("name", string.Empty);
                // ensure that missing "created" values are provided
                if (args.CommandName == "Insert")
                {
                    if (!hasCreatedByUserId && IsCreatedByUserIdPattern(fieldName))
                    {
                        hasCreatedByUserId = true;
                        var v = new FieldValue(fieldName, UserId);
                        values.Add(v);
                    }
                    else
                    {
                        if (!hasCreatedByUserName && IsCreatedByUserNamePattern(fieldName))
                        {
                            hasCreatedByUserName = true;
                            var v = new FieldValue(fieldName, UserName);
                            values.Add(v);
                        }
                        else
                        {
                            if (!hasCreatedOn && IsCreatedOnPattern(fieldName))
                            {
                                hasCreatedOn = true;
                                var v = new FieldValue(fieldName, DateTime.Now);
                                values.Add(v);
                            }
                        }
                    }
                }
                // ensure that missing "modified" values are provided
                if (!hasModifiedByUserId && IsModifiedByUserIdPattern(fieldName))
                {
                    hasModifiedByUserId = true;
                    var v = new FieldValue(fieldName, UserId);
                    values.Add(v);
                }
                else
                {
                    if (!hasModifiedByUserName && IsModifiedByUserNamePattern(fieldName))
                    {
                        hasModifiedByUserName = true;
                        var v = new FieldValue(fieldName, UserName);
                        values.Add(v);
                    }
                    else
                    {
                        if (!hasModifiedOn && IsModifiedOnPattern(fieldName))
                        {
                            hasModifiedOn = true;
                            var v = new FieldValue(fieldName, DateTime.Now);
                            values.Add(v);
                        }
                    }
                }
            }
            args.Values = values.ToArray();
        }

        public static void EnsureTrackingFields(ViewPage page, ControllerConfiguration config)
        {
            var tracker = new EventTracker();
            tracker.InternalEnsureTrackingFields(page, config);
        }

        protected virtual void InternalEnsureTrackingFields(ViewPage page, ControllerConfiguration config)
        {
            var hasCreatedByUserId = false;
            var hasCreatedByUserName = false;
            var hasCreatedOn = false;
            var hasModifiedByUserId = false;
            var hasModifiedByUserName = false;
            var hasModifiedOn = false;
            // detect missing tracking fields
            foreach (var field in page.Fields)
                if (!field.ReadOnly)
                {
                    if (IsCreatedByUserIdPattern(field.Name))
                        hasCreatedByUserId = true;
                    if (IsCreatedByUserNamePattern(field.Name))
                        hasCreatedByUserName = true;
                    if (IsCreatedOnPattern(field.Name))
                        hasCreatedOn = true;
                    if (IsModifiedByUserIdPattern(field.Name))
                        hasModifiedByUserId = true;
                    if (IsModifiedByUserNamePattern(field.Name))
                        hasModifiedByUserName = true;
                    if (IsModifiedOnPattern(field.Name))
                        hasModifiedOn = true;
                }
            // Create DataField instances for missing tracking fields
            var fieldIterator = config.Select("/c:dataController/c:fields/c:field[not(@readOnly=\'true\')]");
            while (fieldIterator.MoveNext())
            {
                var fieldName = fieldIterator.Current.GetAttribute("name", string.Empty);
                // ensure that missing "created" data fields are declared
                if (!hasCreatedByUserId && IsCreatedByUserIdPattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasCreatedByUserId = true;
                }
                if (!hasCreatedByUserName && IsCreatedByUserNamePattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasCreatedByUserName = true;
                }
                if (!hasCreatedOn && IsCreatedOnPattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasCreatedOn = true;
                }
                // ensure that missing "modified" data fields are declared
                if (!hasModifiedByUserId && IsModifiedByUserIdPattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasModifiedByUserId = true;
                }
                if (!hasModifiedByUserName && IsModifiedByUserNamePattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasModifiedByUserName = true;
                }
                if (!hasModifiedOn && IsModifiedOnPattern(fieldName))
                {
                    page.Fields.Add(new DataField(fieldIterator.Current, config.Resolver));
                    hasModifiedOn = true;
                }
            }
        }

        protected void EnsureMembershipUserProperties()
        {
            if (_userId == null)
            {
                _userId = Guid.Empty;
                if (HttpContext.Current.User.Identity.IsAuthenticated && !(HttpContext.Current.User.Identity.GetType().Equals(typeof(System.Security.Principal.WindowsIdentity))))
                {
                    var user = Membership.GetUser();
                    _userId = Convert.ToString(user.ProviderUserKey);
                    _email = user.Email;
                }
            }
        }
    }
}
