/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - One Time Password Authentication
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        _window = window,
        $document = $(document),
        resources = Web.DataViewResources,
        getBoundingClientRect = _app.clientRect,
        // html utilities
        htmlUtilities = _app.html,
        htmlTag = htmlUtilities.tag,
        div = htmlUtilities.div,
        span = htmlUtilities.span,
        $htmlTag = htmlUtilities.$tag,
        $p = htmlUtilities.$p,
        $div = htmlUtilities.$div,
        $span = htmlUtilities.$span,
        $a = htmlUtilities.$a,
        $i = htmlUtilities.$i,
        $li = htmlUtilities.$li,
        $ul = htmlUtilities.$ul,
        // miscellaneous
        resources2FA = resources.TwoFA;

    if (!_app.otpauth)
        _app.otpauth = {};
    _app.otpauth.totp = {
        login: function (options) {
            var methodList = []
                ;

            function generateContacts(contacts) {
                if (contacts != null)
                    contacts.forEach(function (contactInfo) {
                        methodList.push({ value: contactInfo.type + ':' + contactInfo.value, text: resources2FA.GetCode[contactInfo.type] + ' ' + contactInfo.text });
                    });
            }

            if (options.verify.app)
                methodList.push({ value: 'app', text: resources2FA.AuthenticatorApp });
            generateContacts(options.verify.email);
            generateContacts(options.verify.sms);
            generateContacts(options.verify.call);
            generateContacts(options.verify.dial);

            if (!methodList.length) {
                _touch.notify({ text: 'Verification methods are unavailable.', force: true });
                return;
            }

            _app.survey({
                context: options,
                text: resources2FA.Text,
                text2: _app.touch.appName(),
                values: { Method: methodList[0].value, TrustThisDevice: false },
                questions: [
                    {
                        name: 'Passcode',
                        type: 'text',
                        text: resources2FA.VerificationCode,
                        placeholder: new Array(options.codeLength + 1).join('0'),
                        length: options.codeLength,
                        causesCalculate: true,
                        options: {
                            kbd: 'pin'
                        }
                    },
                    {
                        name: 'Method',
                        text: resources2FA.Method,
                        type: 'text', //required: true,
                        causesCalculate: true,
                        visibleWhen: methodList.length > 1 || methodList.length === 1 && methodList[0].value !== 'app',
                        columns: 1,
                        items: {
                            style: 'RadioButtonList',
                            list: methodList
                        },
                        options: {
                            lookup: {
                                nullValue: false
                            }
                        }
                    },
                    {
                        name: 'VerificationCodeMethodActions',
                        text: false,
                        items: {
                            style: 'Actions'
                        },
                        options: {
                            mergeWithPrevious: true
                        },
                        visibleWhen: function () {
                            var method = this.fieldValue('Method');
                            return method && method.match(/sms|call|email/);
                        }
                    },
                    {
                        name: 'TrustThisDevice',
                        type: 'bool',
                        text: resources2FA.TrustThisDevice,
                        items: {
                            style: 'CheckBox'
                        },
                        causesCalculate: true,
                        visibleWhen: function () {
                            return options.canTrustThisDevice !== false;
                        }
                    },
                    {
                        name: 'BackupCode',
                        type: 'text',
                        text: resources2FA.BackupCode.Text,
                        placeholder: resources2FA.BackupCode.Placeholder,
                        footer: resources2FA.BackupCode.Footer,
                        causesCalculate: true,
                        visibleWhen: function () {
                            return options.canEnterBackupCode !== false;
                        }
                    },
                ],
                // modal-fit-content modal-auto-grow modal-max-xs material-icon-lock-outline discard-changes-prompt-none
                options: {
                    modal: {
                        fitContent: true,
                        autoGrow: true,
                        max: 'xs'
                    },
                    materialIcon: 'dialpad',
                    discardChangesPrompt: false
                },
                actions: [
                    {
                        text: resources2FA.Actions.GetVerificationCode,
                        execute: 'otpauthtotp_getcode.app',
                        position: 'before',
                        //icon: 'material-icon-send',
                        scope: 'VerificationCodeMethodActions',
                        when: function () {
                            var method = this.fieldValue('Method');
                            return method && method.match(/sms|call|email/);
                        }
                    }
                    //    ,
                    //    {
                    //        text: 'Call Me',
                    //        execute: 'otpauthtotp_getcode.app',
                    //        position2: 'before',
                    //        when: function () {
                    //            var method = this.fieldValue('Method');
                    //            return method && method.match(/sms|call|email/);
                    //        }
                    //    },
                    //    {
                    //        text: 'Go Home',
                    //        execute: 'otpauthtotp_getcode.app',
                    //        position2: 'before',
                    //        when: function () {
                    //            var method = this.fieldValue('Method');
                    //            return method && method.match(/sms|call|email/);
                    //        }
                    //    }
                ],
                submitText: resources.Mobile.Verify,
                submit: 'otpauthtotp_submit.app',
                calculate: 'otpauthtotp_calculate.app'
            });
        },
        setup: function (options) {
            if (!options)
                _app.login(_app.userName(), 'null;otpauth:totp;exec:setup;');
            else
                _app.otpauth.totp._setup(options);
        },
        _setup: function (options) {

            function consentGiven(dataView) {
                if (options.status !== 'ready')
                    return true;
                if (!dataView)
                    dataView = this;
                var consent = dataView.fieldValue('Consent');
                return consent != null && consent.match(/Enable/);
            }


            var verificatonMethods = [],
                backupCodes = options.backupCodes && options.backupCodes.length ? options.backupCodes : null,
                setupValues = {
                    Consent: 'Enable',
                    AppConfig: 'ScanQrCode',
                    //Url: 'otpauth://totp/ACME%20Co:john@example.com?secret=A9BEB54C166348D6A1D14F17AE1CEA0A&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30',
                    Url: options.url,// 'otpauth://totp/user?secret=ME4WEZLCGU2GGLJRGY3DGLJUHBSDMLLBGFSDCLJUMYYTOYLFGFRWKYJQME======&issuer=northwind',
                    EnterSetupKey: options.secret,// '3847clssdlkdufu834',
                    BackupCodes: backupCodes ? backupCodes.join(', ') : null,// '18397949 78848484\n89548484 34584848\n84843388 81384444',
                    Methods: options.methods ? options.methods.replace(/\s+/g, '') : null,//'app'
                    Status: options.status
                },
                appsToInstall = [],
                setupAuthenticators = options.setup.authenticators,
                setupMethods = options.setup.methods;

            if (!setupValues.Methods && setupMethods) {
                var defaultMethods = [];
                for (var m in setupMethods)
                    if (setupMethods[m])
                        defaultMethods.push(m);
                if (defaultMethods.length)
                    setupValues.Methods = defaultMethods.join(',');
            }

            if (setupAuthenticators) {
                if (!Array.isArray(setupAuthenticators))
                    setupAuthenticators = [setupAuthenticators];
                setupAuthenticators.forEach(function (app) {
                    if (app.name && app.url)
                        appsToInstall.push({ value: app.url, text: app.name });
                });
            }
            if (!appsToInstall.length)
                appsToInstall.push(
                    {
                        value: 'https://apps.apple.com/us/app/google-authenticator/id388497605',
                        text: 'Google Authenticator (iOS)'
                    },
                    {
                        value: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
                        text: 'Google Authenticator (Android)'
                    },
                    {
                        value: 'https://apps.apple.com/us/app/microsoft-authenticator/id983156458',
                        text: 'Microsoft Authenticator (iOS)'
                    },
                    {
                        value: 'https://play.google.com/store/apps/details?id=com.azure.authenticator',
                        text: 'Microsoft Authenticator (Android)'
                    },
                    {
                        value: 'https://apps.apple.com/us/app/salesforce-authenticator/id782057975',
                        text: 'Salesforce Authenticator (iOS)'
                    },
                    {
                        value: 'https://play.google.com/store/apps/details?id=com.salesforce.authenticator',
                        text: 'Salesforce Authenticator (Android)'
                    }
                );
            if (appsToInstall.length === 1) {
                setupValues.InstallApp = appsToInstall[0].value;
                setupValues.SelectedApp = setupValues.InstallApp;
            }
            if (options.verifyVia.email)
                verificatonMethods.push({ value: 'email', text: resources2FA.VerifyVia.email });
            if (options.verifyVia.sms)
                verificatonMethods.push({ value: 'sms', text: resources2FA.VerifyVia.sms })
            if (options.verifyVia.call)
                verificatonMethods.push({ value: 'call', text: resources2FA.VerifyVia.call })
            if (options.verifyVia.app)
                verificatonMethods.push({ value: 'app', text: resources2FA.VerifyVia.app })
            _app.survey({
                context: options,
                text: resources2FA.Text,
                text2: _app.touch.appName(),
                values: setupValues,
                questions: [
                    {
                        name: 'Consent',
                        text: resources2FA.Consent,
                        required: options.status !== 'ready',
                        items: {
                            style: 'CheckBoxList',
                            list: [
                                { value: 'Enable', text: resources2FA.Setup.Consent }
                            ]
                        }
                    },
                    {
                        name: 'Methods',
                        type: 'text',
                        text: resources2FA.Setup.Methods,
                        required: true,
                        items: {
                            style: 'CheckBoxList',
                            list: verificatonMethods
                        },
                        visibleWhen: consentGiven
                    },
                    {
                        name: 'AppConfig',
                        required: true,
                        items: {
                            style: /*options.status === 'ready' && false ? 'DropDownList' : */'RadioButtonList',
                            list: [
                                { value: 'ScanQrCode', text: resources2FA.Setup.AppConfigScanQrCode },
                                { value: 'EnterSetupKey', text: resources2FA.Setup.AppConfigEnterSetupKey },
                                { value: 'InstallApp', text: resources2FA.Setup.AppConfigInstallApp },
                            ]
                        },
                        visibleWhen: function () {
                            return options.verifyVia.app && consentGiven(this) && verificationWithApp(this);
                        }
                    },
                    {
                        name: 'Url',
                        text: resources2FA.Setup.ScanQrCode,
                        options: {
                            input: {
                                qrcode: {
                                    valueHidden: true,
                                    tooltipHidden: true,
                                    scrollIntoView: !setupValues.Methods || !setupValues.Methods.match(/app/),
                                    size: '192x192'// '256x256'
                                }
                            }
                        },
                        visibleWhen: function () {
                            var appConfig = this.fieldValue('AppConfig');
                            return options.verifyVia.app && consentGiven(this) && verificationWithApp(this) && appConfig === 'ScanQrCode';
                        }
                    },
                    {
                        name: 'EnterSetupKey',
                        text: resources2FA.Setup.EnterSetupKey,
                        mode: 'static',
                        options: {
                            textAction: 'copy'
                        },
                        visibleWhen: function () {
                            var appConfig = this.fieldValue('AppConfig');
                            return consentGiven(this) && verificationWithApp(this) && appConfig === 'EnterSetupKey';
                        }
                    },
                    {
                        name: 'InstallApp',
                        text: resources2FA.AuthenticatorApp,
                        required: true,
                        items: {
                            style: 'RadioButtonList',
                            list: appsToInstall
                        },
                        columns: 1,
                        causesCalculate: true,
                        visibleWhen: function () {
                            var appConfig = this.fieldValue('AppConfig');
                            return consentGiven(this) && verificationWithApp(this) && appConfig === 'InstallApp' && appsToInstall.length > 1;
                        }
                    },
                    {
                        name: 'SelectedApp',
                        text: resources2FA.Setup.ScanAppQrCode,
                        options: {
                            input: {
                                qrcode: {
                                    valueHidden: true,
                                    scrollIntoView: true,
                                    size: '192x192' // '256x256'
                                }
                            }
                        },
                        visibleWhen: function () {
                            var appConfig = this.fieldValue('AppConfig'),
                                installApp = this.fieldValue('InstallApp');
                            return consentGiven(this) && verificationWithApp(this) && appConfig === 'InstallApp' && installApp;
                        }
                    },
                    {
                        name: 'BackupCodes',
                        text: resources2FA.Setup.BackupCodes.Text,
                        //required: true,
                        mode: 'static',
                        htmlEncode: false,
                        footer: resources2FA.Setup.BackupCodes.Footer,
                        options: {
                            textAction: 'copy'
                        },
                        visibleWhen: function () {
                            return consentGiven(this) && this.fieldValue('Methods') && this.fieldValue('Status') === 'ready' && this.fieldValue('BackupCodes');
                        }
                    },
                    {
                        name: 'BackupCodeActions',
                        text: false,
                        rows: 1,
                        items: {
                            style: 'Actions'
                        },
                        options: {
                            mergeWithPrevious: true
                        },
                        visibleWhen: function () {
                            return consentGiven(this) && this.fieldValue('Methods') && this.fieldValue('Status') === 'ready' && this.fieldValue('BackupCodes');
                        }
                    },
                    {
                        name: 'BackupCodesUnavailable',
                        text: resources2FA.Setup.BackupCodes.Text,
                        rows: 1,
                        items: {
                            style: 'Actions'
                        },
                        footer: resources2FA.Setup.BackupCodes.Footer,
                        visibleWhen: function () {
                            return consentGiven(this) && this.fieldValue('Methods') && this.fieldValue('Status') === 'ready' && !this.fieldValue('BackupCodes');
                        }
                    },
                    {
                        name: 'Status',
                        hidden: true
                    }
                ],
                // modal-fit-content modal-auto-grow modal-max-xs material-icon-lock-outline discard-changes-prompt-none
                options: {
                    modal: {
                        fitContent: true,
                        autoGrow: true,
                        max: 'sm'
                    },
                    materialIcon: 'dialpad',
                    discardChangesPrompt: false
                },
                actions: [
                    {
                        text: resources.Mobile.Next,
                        execute: 'otpauthtotpsetup_next.app',
                        scope: 'form',
                        icon: 'material-icon-arrow_forward',
                        when: function () {
                            return this.fieldValue('Status') != 'ready' && (!verificationWithApp(this) || this.fieldValue('AppConfig') !== 'InstallApp');
                        }
                    },
                    {
                        text: options.status === 'ready' ? resources.ModalPopup.SaveButton : resources.Mobile.Enable,
                        execute: 'otpauthtotpsetup_save.app',
                        scope: 'form',
                        icon: 'material-icon-check',
                        when: function () {
                            return this.fieldValue('Status') === 'ready';
                        }
                    },
                    {
                        text: resources.ModalPopup.SaveButton,
                        execute: 'otpauthtotpsetup_backupcodessave.app',
                        scope: 'BackupCodeActions',
                        causesValidation: false
                    },
                    //{
                    //    text: 'Print',
                    //    execute: 'otpauthtotpsetup_backupcodesprint.app',
                    //    scope: 'BackupCodeActions',
                    //    causesValidation: false
                    //},
                    {
                        text: resources.Mobile.Generate,
                        execute: 'otpauthtotpsetup_backupcodesgenerate.app',
                        scope: 'BackupCodeActions',
                        causesValidation: false
                    },
                    {
                        text: resources.Mobile.Generate,
                        execute: 'otpauthtotpsetup_backupcodesgenerate.app',
                        scope: 'BackupCodesUnavailable',
                        causesValidation: false
                    }
                ],
                calculate: 'otpauthtotpsetup_calculate.app'
            });
        },
        exec: function (method, options) {
            if (_touch.busy())
                return;

            var dataView = options.dataView || _touch.dataView(),
                authData = dataView.data('survey'),
                message = [(authData.password || 'null') + ';'];

            function addParam(name, value) {
                if (value != null)
                    message.push(name + ':' + (value == null ? 'null' : value) + ';')
            }

            addParam('otpauth', authData.otpauth);
            addParam('exec', method);

            for (var op in options)
                addParam(op, options[op]);

            // Invoke the "app.login" to process otpauth commands. The extended otpauth information is following the user password
            _app.login(authData.username, message.join(''), authData.createPersistentCookie,
                function (result) {
                    _touch.busy(true);
                    if (authData.callback)
                        authData.callback.success(result);
                    else if (result.event)
                        $document.trigger($.Event(result.event, { args: result }));
                },
                function (result) {
                    var confirm = _touch.dataView().data('survey').confirm,
                        errorMessage = confirm === 'verification_code' ?
                            resources2FA.Messages.InvalidVerificationCode :
                            resources2FA.Messages.InvalidPassword;
                    _app.alert(errorMessage).then(function () {
                        _input.focus({ field: confirm === 'password' ? 'Password' : 'Passcode' });
                    });
                });
        }
    };


    function verificationWithApp(dataView) {
        if (!dataView)
            dataView = this;
        var method = dataView.fieldValue('Methods');
        return method != null && method.match(/app/);
    }


    function inputToPasscode(dataView, passcode) {
        var data = dataView.data(),
            options = dataView.data('survey'),
            newPasscode,
            backupCode = data.BackupCode,
            result = {};
        if (passcode == null)
            passcode = data.Passcode;

        if (passcode != null && (passcode.length !== options.codeLength || !passcode.toString().match(/^\d+$/)) || passcode == null && backupCode == null) {
            if (passcode != null) {
                newPasscode = passcode.replace(/\D/g, '');
                if (newPasscode !== passcode) {
                    passcode = newPasscode;
                    _input.execute({ values: { Passcode: newPasscode }, raiseCalculate: false });
                }
            }
            result.error = String.format(resources2FA.Messages.EnterCode, options.codeLength);
        }
        result.value = passcode;
        return result;
    }

    // optauth - Login with Passcode

    $document.on('otpauthtotp_submit.app', function (e) {
        var data = e.dataView.data(),
            surveyData = e.dataView.data('survey'),
            backupCode = data.BackupCode,
            passcode = inputToPasscode(e.dataView);
        if (passcode.error) {
            _app.alert(passcode.error).then(function () {
                _input.focus({ field: 'Passcode' });
            });
        }
        else {
            passcode = passcode.value;
            if (passcode == null)
                passcode = backupCode;
            passcode = passcode.toString();
            _app.otpauth.totp.exec(e.dataView.data('survey').exec || 'login', {
                passcode: passcode,
                trustThisDevice: data.TrustThisDevice,
                url: surveyData.url,
                backupCodes: surveyData.backupCodes,
                methods: surveyData.methods
            });
        }
        return false;
    }).on('otpauthtotp_getcode.app', function (e) {
        _input.focus({ field: 'Passcode' });
        var method = e.dataView.data().Method.match(/^(\w+)\:(.+)$/),
            surveyData = e.dataView.data('survey'),
            confirmationMessage;
        var list = surveyData.verify[method[1]];
        for (var i = 0; i < list.length; i++)
            if (list[i].value === method[2])
                confirmationMessage = resources2FA.CodeSent[method[1]] + ' ' + list[i].text;
        _app.otpauth.totp.exec('send', {
            method: method[2],
            type: method[1],
            url: surveyData.url,
            template: String.format(resources2FA.Messages.YourCode, _touch.appName()),
            confirmation: confirmationMessage
        });
        setTimeout(function () {
            _input.focus({ field: 'Passcode' });
        });
        _touch.notify({ text: resources.Mobile.Wait, force: true });
        return false;
    }).on('otpauthtotp_calculate.app', function (e) {
        var triggerField = e.rules._args.trigger,
            dataView = e.dataView,
            passcode = dataView.fieldValue('Passcode'),
            backupCode = dataView.fieldValue('BackupCode');
        if (triggerField === 'Method') {
            var method = dataView.fieldValue('Method');
            if (method && method.match(/^dial|app/))
                setTimeout(function () {
                    _input.focus({ field: 'Passcode' });
                });
        }
        if (triggerField === 'Passcode') {
            var passcodeData = inputToPasscode(dataView);
            if (backupCode != null && passcode != null)
                _input.execute({ BackupCode: null });
            if (!passcodeData.error && passcodeData.value != null)
                $document.trigger($.Event('otpauthtotp_submit.app', { dataView: dataView, survey: dataView._survey }));
        }
        if (triggerField === 'BackupCode') {
            if (backupCode != null && passcode != null)
                _input.execute({ Passcode: null });
        }
        if (triggerField === 'TrustThisDevice') {
            setTimeout(function () {
                _input.focus({ field: 'Passcode' });
            });
        }
        return false;
    }).on('beforefocus.input.app', '[data-field="Passcode"][data-type="pin"]', function (e) {
        e.inputElement.data('change', pinChanged)
    }).on('beforefocus.keyboard.app', '[data-field="Passcode"][data-type="pin"]', function (e) {
        e.context.change = pinChanged;
    });

    // optauth - setup 2FA

    $document.on('otpauthtotpsetup_calculate.app', function (e) {
        var triggerField = e.rules._args.trigger,
            dataView = e.dataView;
        if (triggerField === 'InstallApp') {
            var install = dataView.fieldValue('InstallApp');
            _input.execute({ SelectedApp: install });
        }
        return false;
    }).on('otpauthtotpsetup_verificationcodesent.app', function (e) {
        _touch.notify({ text: e.args.notify, force: true });
        return false;
    }).on('otpauthtotpsetup_backupcodessave.app', function (e) {
        var backupCodes = _touch.dataView().data('survey').backupCodes,
            fileName = _app.touch.appName() + ' backup codes.txt';
        _app.saveFile(fileName, backupCodes.join('\r\n'));

        return false;
    }).on('otpauthtotpsetup_backupcodesgenerate.app', function (e) {
        var surveyData = e.dataView.data('survey');
        _app.otpauth.totp.exec('generate', { url: surveyData.url });
        return false;
    }).on('otpauthtotpsetup_backupcodesgeneratedone.app', function (e) {
        var surveyData = _touch.dataView().data('survey');
        surveyData.backupCodes = e.args.newBackupCodes;
        _input.execute({ 'BackupCodes': e.args.newBackupCodes.join(', ') });
        setTimeout(function () {
            _input.focus({ field: 'BackupCodeActions' });
        });
        return false;
    }).on('otpauthtotpsetup_next.app', function (e) {
        _input.execute({ Status: 'ready' });
        setTimeout(function () {
            _input.focus({ field: e.dataView.fieldValue('BackupCodes') ? 'BackupCodeActions' : 'BackupCodesUnavailable' });
        });
        return false;
    }).on('otpauthtotpsetup_save.app', function (e) {
        var data = e.dataView.data(),
            surveyData = e.dataView.data('survey');

        // 2FA enabled/saved

        function complete2FASetup() {
            _app.otpauth.totp.exec('setup', { consent: data.Consent, url: surveyData.url, backupCodes: data.BackupCodes, methods: data.Methods });
        }

        if (data.Consent)
            complete2FASetup();
        else
            _app.confirm(resources2FA.Messages.DisableQuestion).then(complete2FASetup);

        return false;
    }).on('otpauthtotpsetup_confirm.app', function (e) {
        if (e.args.confirm === 'verification_code') {
            _app.otpauth.totp.login(e.args.options);
        }
        else if (e.args.confirm === 'password') {
            _app.survey({
                context: e.args.options,
                text: resources2FA.Text,
                text2: _app.touch.appName(),
                //values: {  },
                questions: [
                    {
                        name: 'Password',
                        mode: 'password',
                        text: resources2FA.EnterPassword,
                        required: true,
                    }
                ],
                options: {
                    modal: {
                        fitContent: true,
                        max: 'xs'
                    },
                    materialIcon: 'password',
                    discardChangesPrompt: false
                },
                submitText: resources.Mobile.Next,
                submit: 'otpauthtotppassword_submit.app'
            });
        }
        return false;
    }).on('otpauthtotppassword_submit.app', function (e) {
        _app.otpauth.totp.exec(e.dataView.data('survey').exec, { password: e.dataView.fieldValue('Password') });
        return false;
    }).on('otpauthtotpsetup.app', function (e) {
        var surveyData = _touch.dataView().data('survey');
        e.args.verifyVia = surveyData.verifyVia;
        e.args.setup = surveyData.setup || {};
        _touch.goBack(function () {
            _app.otpauth.totp.setup(e.args);
        });
        return false;
    }).on('otpauthtotpsetup_complete.app', function (e) {
        var setupType = e.args.setupType;
        _touch.goBack(function () {
            if (setupType === 'none')
                // 2FA Setup form has been closed
                _app.alert(resources2FA.Messages.Disabled);
            else
                // The passcode has been confirmed. We are back in the 2FA Setup form.
                _touch.goBack(function () {
                    _app.alert(setupType === 'new' ? resources2FA.Messages.Enabled : resources2FA.Messages.Changed);
                });
        });
        return false;
    });

    function pinChanged(options) {
        var dataView = options.keyboardPage ? _touch.pageInfo(options.inputPage).dataView : _touch.dataView(),
            survey = dataView._survey,
            context = survey && survey.context,
            passcode;
        if (context && context.otpauth) {
            passcode = options.value;
            if (passcode.length == context.codeLength && passcode.match(/^\d+$/))
                if (options.keyboardPage)
                    _touch.goBack();
                else
                    options.input.blur();
        }

    };

})();