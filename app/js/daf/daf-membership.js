/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Membership and Membership Manager
* Copyright 2008-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
(function () {

    Type.registerNamespace("Web");

    // Membership

    var _wm = Web.Membership = function () {
        Web.Membership.initializeBase(this);
        this._membershipBar = null;
        this._intervalId = null;
        Web.Membership._instance = this;
        this._displayLogin = true;
        _app = $app;
        _touch = _app.touch;
    };

    var _resources = Web.MembershipResources,
        _window = window,
        _app,
        _touch;

    _wm.prototype = {
        initialize: function () {
            var that = this;
            // parse supported cultures
            var cultures = that.get_cultures();
            if (!String.isNullOrEmpty(cultures) && !(__tf !== 4)) {
                var selectedCulture = { value: 'Detect,Detect', text: _resources.Bar.AutoDetectLanguageOption, selected: false };
                var cultureList = [selectedCulture];
                $(cultures.split(/;/)).each(function () {
                    if (this.length) {
                        var info = this.split('|');
                        var culture = { value: info[0], text: info[1], selected: info[2] === 'True' };
                        cultureList.push(culture);
                        if (culture.selected)
                            selectedCulture = culture;
                    }
                });
                _app.cultureList = cultureList;
            }
            $(document).trigger($.Event('membershipinit.app', { membership: that }));
        },
        dispose: function () {
        },
        updated: function () {
        },
        get_displayRememberMe: function () {
            return this._displayRememberMe !== false;
        },
        set_displayRememberMe: function (value) {
            this._displayRememberMe = value;
        },
        get_rememberMeSet: function () {
            return this._rememberMeSet === true;
        },
        set_rememberMeSet: function (value) {
            this._rememberMeSet = value;
        },
        get_displayLogin: function () {
            return this._displayLogin;
        },
        set_displayLogin: function (value) {
            this._displayLogin = value;
        },
        get_displayPasswordRecovery: function () {
            return this._displayPasswordRecovery !== false;
        },
        set_displayPasswordRecovery: function (value) {
            this._displayPasswordRecovery = value;
        },
        get_displaySignUp: function () {
            return this._displaySignUp !== false;
        },
        set_displaySignUp: function (value) {
            this._displaySignUp = value;
        },
        get_displayMyAccount: function () {
            return this._displayMyAccount;
        },
        set_displayMyAccount: function (value) {
            this._displayMyAccount = value;
        },
        get_displayHelp: function () {
            return this._displayHelp;
        },
        set_displayHelp: function (value) {
            this._displayHelp = value;
        },
        get_baseUrl: function () {
            return this._baseUrl || __baseUrl;
        },
        set_baseUrl: function (value) {
            this._baseUrl = value;
        },
        get_servicePath: function () {
            return this._servicePath || __servicePath;
        },
        set_servicePath: function (value) {
            this._servicePath = value;
        },
        get_welcome: function () {
            return String.isNullOrEmpty(this._welcome) ? _resources.Bar.Welcome : this._welcome;
        },
        set_welcome: function (value) {
            this._welcome = value;
        },
        get_user: function () {
            return this._user;
        },
        set_user: function (value) {
            this._user = value;
        },
        get_enablePermalinks: function () {
            return this._enablePermalinks === true;
        },
        set_enablePermalinks: function (value) {
            this._enablePermalinks = value;
        },
        get_enableHistory: function () {
            return this._enableHistory === true;
        },
        set_enableHistory: function (value) {
            this._enableHistory = value;
        },
        get_isAuthenticated: function () {
            return this._isAuthenticated;
        },
        set_isAuthenticated: function (value) {
            this._isAuthenticated = value;
        },
        get_commandLine: function () {
            return this._commandLine;
        },
        set_commandLine: function (value) {
            this._commandLine = value;
        },
        showLoginDialog: function () {
            this.hideLoginDialog();
        },
        get_authenticationEnabled: function () {
            return this._authenticationEnabled == null || this._authenticationEnabled === true;
        },
        set_authenticationEnabled: function (value) {
            this._authenticationEnabled = value;
        },
        get_idleTimeout: function () {
            return this._idleTimeout == null ? 0 : this._idleTimeout;
        },
        set_idleTimeout: function (value) {
            this._idleTimeout = value;
        },
        get_cultures: function () {
            return this._cultures;
        },
        set_cultures: function (value) {
            this._cultures = value;
        },
        get_cultureName: function () {
            var cl = this._cultureList;
            if (cl)
                for (var i = 0; i < cl.length; i++)
                    if (cl[i][2] === 'True')
                        return cl[i][1];
            return null;
        },
        changeCulture: function (newCulture) {
            var expiratonDate = new Date();
            expiratonDate.setDate(expiratonDate.getDate() + 14);
            document.cookie = String.format('.COTCULTURE={0}; expires={1}; path=/', newCulture, expiratonDate.toUTCString());
            location.replace(_app.unanchor(location.href));
        },
        _idle: function () {
        },
        idle: function () {
            var result = (new Date().getTime() - this._lastActivity > this.get_idleTimeout()) && !this._protecting && _app.loggedIn()/*Sys.Services.AuthenticationService.get_isLoggedIn()*/;
            if (result)
                this._idle();
            return result;
        },
        _disposeIdentityResources: function () {
            if (this._identityModalPopup) {
                this._identityModalPopup.dispose();
                this._idleDialog.parentNode.removeChild(this._idleDialog);
                delete this._idleDialog;
                this._identityModalPopup = null;
            }
        },
        _updateLastActivity: function () {
            this._lastActivity = new Date();
        },
        loggedIn: function () {
            var loggedIn = _app.loggedIn();
            if (!loggedIn && !String.isNullOrEmpty(this.get_user()))
                loggedIn = true;
            return loggedIn;
        },
        idleInterval: function (enable) {
            var that = this;
            if (that._idleIntervalId) {
                clearInterval(that._idleIntervalId);
                that._idleIntervalId = null;
            }
            if (enable)
                if (that.get_idleTimeout() > 0)
                    that._idleIntervalId = _window.setInterval(function () {
                        that.idle();
                    }, 60000);
        },
        logout: function () {
            this._protecting = false;
            //Sys.Services.AuthenticationService.logout(null, null, null, null);
            _app.logout(function () {
                setTimeout(function () {
                    var logoutUrl = 'current';
                    _app._navigated = true;
                    if (_touch) {
                        if ((_touch.settings('ui.state.clear') || 'never') !== 'never')
                            _app.storage.clearUIState();
                        logoutUrl = _touch.settings('membership.logoutUrl');
                        if (logoutUrl == null)
                            logoutUrl = __settings.rootUrl;
                        else if (logoutUrl !== 'current')
                            logoutUrl = _app.resolveClientUrl(logoutUrl, _wm._instance.get_baseUrl());
                    }
                    if (logoutUrl === 'current')
                        location.reload();
                    else
                        location.href = logoutUrl;
                });
            });
        },
        helpUrl: function () {
            var path = _window.location.pathname.split(/\//),
                baseUrl = this.get_baseUrl().split(/\//),
                root = path.slice(0, 1).join('/'),
                pageUrl = path.slice(path.length - baseUrl.length).join('/');
            if (pageUrl.match(/^\//))
                pageUrl = pageUrl.substr(1);
            return (root || '/') + 'help/' + pageUrl;
        },
        help: function (fullScreen) {
            if (__settings.help) {
                var that = this,
                    pageHelpUrl = that.helpUrl();
                if (_touch)
                    _touch.busy({ progress: true });
                $.ajax(pageHelpUrl).done(function (result) {
                    pageHelpUrl = result.match(/404 Not Found/) ? __baseUrl + 'help' : pageHelpUrl;
                    if (_touch) {
                        _touch.busy({ progress: false });
                        _touch.navigate({ href: pageHelpUrl });
                    }
                    else
                        _window.open(pageHelpUrl, '_blank');
                });
            }
        }
    };

    _wm.registerClass('Web.Membership', Sys.Component);

    if (typeof Sys !== 'undefined') Sys.Application.notifyScriptLoaded();
})();