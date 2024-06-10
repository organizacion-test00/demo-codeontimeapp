/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Offline Data Processor
* Copyright 2017-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _touch,
        _odp,
        _window = window,
        odpSettings,
        Int32_MaxValue = 2147483647,
        dateTimeFormat = Sys.CultureInfo.CurrentCulture.dateTimeFormat,
        numberFormat = Sys.CultureInfo.CurrentCulture.numberFormat,
        resourcesODP = Web.DataViewResources.ODP,
        executeCompressedProperties = [
            { _m: 'GetPage', _r: 'request', Me: ['SortExpression', 'FilterIsExternal', 'LookupContextFieldName', 'LookupContextController', 'LookupContextView', 'LookupContext', 'Inserting', 'LastCommandName', 'DoesNotRequireData', 'LastView', 'RequiresFirstLetters', 'SupportsCaching', 'SystemFilter', 'RequiresRowCount', 'RequiresPivot', 'PivotDefinitions', 'Filter', 'ExternalFilter', 'SyncKey', 'Tag'] },
            { _m: 'Execute', _r: 'args', Me: ['CommandArgument', 'LastCommandName', 'LastCommandArgument', 'SaveLEVs', 'ContextKey', 'LastView', 'Filter', 'SortExpression', 'SelectedValues', 'ExternalFilter'], Values: ['OldValue', /*'Modified', */'ReadOnly', 'Error'] } // do not compress-out "Modified" property - it is needed to figure the "Value" property on the server
        ],
        findDataView = _app.findDataView,
        DataFieldAggregate = ['None', 'Sum', 'Count', 'Average', 'Max', 'Min'],
        OnDemandDisplayStyle = ['Thumbnail', 'Link', 'Signature'],
        TextInputMode = ['Text', 'Password', 'RichText', 'Note', 'Static'],
        FieldSearchMode = ['Default', 'Required', 'Suggested', 'Allowed', 'Forbidden'],
        filterExpressionRegex = /([\w\,\.]+):([\s\S]*)/, // (Alias)(Values)
        matchingModeRegex = /^(_match_|_donotmatch_)\:(\$all\$|\$any\$)$/, // (Match)(Scope)
        filterValueRegex = /(\*|\$\w+\$|=|~|<(=|>){0,1}|>={0,1})([\s\S]*?)(\0|$)/; // (Operation)(Value)


    function compressObjectProperty(obj, propList) {
        propList.forEach(function (prop) {
            var v = obj[prop];
            if (prop in obj && (v == null || v === false && prop !== 'OldValue' || v === '' || Array.isArray(v) && !v.length))
                delete obj[prop];
        });
    }

    function jsonToData(obj) {
        return JSON.stringify({ d: obj });
    }

    function canCallServer() {
        return !_odp.offline() && _app.online();
    }

    function isTempPK(v) {
        return typeof v == 'number' && v < 0 || typeof v == 'string' && v.match(/^0{8}-0{4}-0{4}-0{4}-([\da-f]){12}$/);
    }

    function ActionResult_new(options) {
        var rowsAffected,
            errors = [];
        if (typeof options == 'string')
            errors.push(options);
        else if (Array.isArray(options))
            errors = options;
        else
            rowsAffected = options;
        return {
            "Tag": null,
            "Errors": errors,
            "Values": [
                //{
                //    "Name": "ProductID",
                //    "OldValue": null,
                //    "NewValue": 201,
                //    "Modified": true,
                //    "ReadOnly": false,
                //    "Value": 201,
                //    "Error": null
                //}
            ],
            "Canceled": false,
            "NavigateUrl": null,
            "ClientScript": null,
            "RowsAffected": rowsAffected || 0,
            "Filter": null,
            "SortExpression": null,
            "RowNotFound": false
        };
    }

    function DataField_supportsStaticItems() {
        var that = this,
            itemsStyle = that.ItemsStyle;
        return that.ItemsDataController && !(itemsStyle === 'AutoComplete' || itemsStyle === 'Lookup');
    }

    _odp = _app.odp = {
        toDataUrl: function (url) {
            // host will either load the image and then resolve the promise with the data url
            // alternatively the promise will resolve right away with the URL pointing straight to the host
            // For example, the second method will return "cloudontime://getblob/?{url: url}" where 38383 is an internal reference to the actual URL
            return $.when(url);
        },
        toOriginalUrl: function (url) {
            // host will format URL into a host-specific URL
            return $.when(url + '&_ticks=' + new Date().getTime());
        },
        download: function (url) {
            // host will download the original file 
            _touch.openHref(url);
        },
        toThumbnail: function (fileInfo, thumbnail) {
            var result = { thumbnail: thumbnail },
                p;
            for (p in fileInfo)
                if (!p.match(/promise/))
                    result[p] = fileInfo[p];
            return result;
        },
        convertBlob: function (fileInfo, format, thumbnail) {
            var file = fileInfo.file,
                promise = fileInfo.promise,
                requiresDataUrl = format === 'dataurl',
                $canvas, canvas, context, image,
                deferred;

            function resolve() {
                var result = canvas.toDataURL(type, 1.0);
                $canvas.remove();
                delete fileInfo.file;
                fileInfo.promise = null;
                // produce dataURL or arraybuffer
                if (requiresDataUrl)
                    fileInfo.dataUrl = result;
                else {
                    var s = atob(result.substring(result.indexOf('base64') + 7)), i,
                        a = new Uint8Array(new ArrayBuffer(s.length));
                    for (i = 0; i < s.length; i++)
                        a[i] = s.charCodeAt(i);
                    result = a.buffer;
                }
                deferred.resolve(result, type, thumbnail);
            }


            if (!promise) {
                deferred = $.Deferred();
                promise = fileInfo.promise = deferred.promise();

                if (thumbnail) {
                    // thumbnail = 1 (t - thumbnial)
                    // thumbnail = 2 (t+nocrop - thumbnail without cropping)
                    var originalType = fileInfo.file.type,
                        type = fileInfo.type = 'image/png',
                        w = 80,
                        h = 80,
                        w2;
                    $canvas = $('<canvas width="' + w + '" height="' + h + 'px"></canvas>');
                    canvas = $canvas[0];
                    context = canvas.getContext('2d');
                    if (originalType && originalType.match(/^image\//)) {
                        context.fillStyle = 'rgba(0,0,0,0)';
                        context.fillRect(0, 0, w, h);
                        image = new Image();
                        image.onload = function () {
                            // draw image thumbnail
                            var r = { w: w, h: h },
                                imageWidth = image.width,
                                imageHeight = image.height,
                                aspect = r.h / r.w;
                            if (imageWidth < r.w && imageHeight < r.h) {
                                r.w = imageWidth;
                                r.h = imageHeight;
                            }
                            else
                                if (imageWidth > imageHeight) {
                                    r.h = r.w * aspect;
                                    r.w = r.h * imageWidth / imageHeight;
                                }
                                else
                                    if (imageHeight > imageWidth) {
                                        aspect = r.w / r.h;
                                        r.w = r.h * aspect;
                                        r.h = r.w * imageHeight / imageWidth;
                                    }
                                    else {
                                        r.w = imageHeight * aspect;
                                        r.h = r.w;
                                    }
                            aspect = w / r.w;
                            if (r.w <= r.h)
                                aspect = h / r.h;
                            if (aspect > 1)
                                aspect = 1;
                            r.w = r.w * aspect;
                            r.h = r.h * aspect;
                            w2 = r.w;
                            if (thumbnail < 2)  // cropped image (thumbnail === 1)
                                if (w2 > r.h) {
                                    r.w += (w2 - r.h) * 2;
                                    r.h += (w2 - r.h) * aspect * 2;
                                }
                                else {
                                    r.w += (r.h - w2) * aspect * 2;
                                    r.h += (r.h - w2) * 2;
                                }
                            context.drawImage(image, (w - r.w) / 2, (h - r.h) / 2, r.w, r.h);
                            resolve();
                            URL.revokeObjectURL(image.src);
                        };
                        image.src = URL.createObjectURL(fileInfo.file);
                    }
                    else {
                        // thumbnail is not for an image
                        context.fillStyle = '#fff';
                        context.fillRect(0, 0, w, h);
                        context.fillStyle = '#000';
                        context.font = '20px arial';
                        context.textAlign = 'center';
                        var fileExtension = (fileInfo.file.name || '').match(/(\..+)$/);
                        context.fillText(fileExtension ? fileExtension[1] : '', w / 2, h / 2 + 10);
                        resolve();
                    }
                }
                else {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        fileInfo.promise = null;
                        deferred.resolve(e.target.result, file.type, thumbnail);
                    };
                    if (requiresDataUrl)
                        reader.readAsDataURL(file);
                    else
                        reader.readAsArrayBuffer(file);
                }
            }
            return promise;
        },
        // Allows manipulating BLOBs in online, odp/online, and offline modes.
        blob: function (method, options) {
            var result,
                deferred;

            function resolve() {
                deferred.resolve(options);
            }

            function toOdpFile(url, dataView) {
                if (!dataView)
                    dataView = _touch.dataView();
                var fileInfo,
                    odp = dataView.odp;
                if (odp) {
                    fileInfo = odp._files[url];
                    if (!fileInfo) {
                        odp = odp._master;
                        if (odp)
                            fileInfo = odp._files[url];
                    }
                }
                return fileInfo;
            }

            function odpFileToDataUrl(fileInfo) {
                var deferred = $.Deferred(),
                    dataUrl = fileInfo.dataUrl;
                if (dataUrl)
                    deferred.resolve(dataUrl);
                else
                    if (fileInfo.file.type.match(/^image\//)) {
                        // create a thunbnail
                        _odp.convertBlob(odpFile, 'dataurl', fileInfo.thumbnail).done(function (result, type, thumbnail) {
                            deferred.resolve(result);
                        });
                    }
                return deferred.promise();
            }


            switch (method) {
                case 'init':
                    var blobHref = __baseUrl,
                        field = options.field,
                        dataView = field._dataView,
                        onDemandHandler = field.OnDemandHandler,
                        crop = options.crop,
                        format = options.format || 't',
                        key = options.key,
                        odpFile,
                        image = options.image,
                        link = options.link;
                    deferred = $.Deferred();
                    options.href = String.format('{0}blob.ashx?{1}=o|{2}', blobHref, onDemandHandler, key);
                    if (link)
                        link.attr('data-href', options.href);
                    options.src = String.format('{0}blob.ashx?{1}={4}|{2}{3}', blobHref, onDemandHandler, key, crop !== true ? '&_nocrop' : '', format);
                    if (image)
                        image.attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); // single transparent pixel
                    // 1. See if we have a pending file in the current data processor
                    odpFile = toOdpFile(options.src, dataView);
                    if (odpFile)
                        odpFileToDataUrl(odpFile).done(function (dataUrl) {
                            options.src = dataUrl;
                            if (image)
                                image.attr(image.attr('data-observe') ? 'data-src' : 'src', dataUrl);
                            resolve();
                        });
                    else {
                        if (image) {
                            // 2. See if we have a pre-emptively downloaded "offline" file in browser. 
                            var optionsSource = options.src;
                            (_odp.offline('toDataUrl', optionsSource) || _odp.toDataUrl(optionsSource)).done(function (url) {
                                image.attr(image.attr('data-observe') ? 'data-src' : 'src', url);
                            });
                        }
                        resolve();
                    }
                    if (!result)
                        result = deferred.promise();
                    break;
                case 'url':
                    if (typeof options == 'string')
                        options = { href: options };
                    var url = options.href;
                    if (url.match(/^data\:/))
                        result = $.when(url);
                    else {
                        odpFile = toOdpFile(url);
                        if (odpFile)
                            result = odpFileToDataUrl(odpFile);
                        else {
                            result = _odp.offline('toDataUrl', url);
                            if (!result)
                                result = options.original ? _odp.toOriginalUrl(url) : _odp.toDataUrl(url);
                        }
                    }
                    break;
                case 'download':
                    odpFile = toOdpFile(options);
                    if (odpFile)
                        _app.saveBlob(odpFile.file);
                    else {
                        result = _odp.offline('toDataUrl', { url: options, blob: true });
                        if (result)
                            result.done(_app.saveBlob);
                        else
                            _odp.download(options);
                    }
                    break;
            }
            return result;
        },
        blobUrlFormatStrings: function (style) {
            var baseUrl = __baseUrl,
                formatStrings = [baseUrl + 'blob.ashx?{0}=o|{1}'];
            if (typeof style == 'string' && style !== 'Link' || style === 0 || style === 2)
                formatStrings.push(baseUrl + 'blob.ashx?{0}=t|{1}', baseUrl + 'blob.ashx?{0}=t|{1}&_nocrop');
            return formatStrings;
        },
        uploadFile: function (options) {
            var result = _odp.offline('saveBlob', options);
            if (!result) {
                var handler = options.handler;
                if (!handler)
                    handler = options.field.OnDemandHandler;
                result = _app.uploadFileAjax({
                    url: String.format('{0}Blob.ashx?{1}=u|{2}&_v={3}', __baseUrl, handler, options.key, options.apiVer),
                    files: options.file || options.files,
                    progress: options.progress
                });
            }
            return result;
        },
        updateBlob: function (odp, fileInfo) {
            var controller = fileInfo.controller,
                keyValue = fileInfo.key;
            var deferred = $.Deferred();
            odp.is('active');
            odp.tracking(controller, true);
            $.when(_odp.getControllers(controller)).done(function () {
                odp.getData(controller, [{ Name: fileInfo.keyField, Value: keyValue }]).done(function () {
                    odp.select({ from: controller, where: { filter: '(this.' + fileInfo.keyField + '===params.p0)', params: { p0: keyValue } } }).then(function (result) {
                        if (result.length) {
                            var blobField = fileInfo.field;
                            if (!('new' in fileInfo)) {
                                var v = result[0][blobField];
                                fileInfo.new = v == null || typeof v == 'string' && !!v.match(/^null\|/);
                            }
                            result[0][blobField] = fileInfo.file.size ? keyValue.toString() : null;
                        }
                        deferred.resolve(fileInfo);
                    });


                });
            });
            return deferred.promise();
        },
        upload: function (options) {
            var field = options.field,
                dataView = field._dataView,
                controller = dataView._controller,
                odp = dataView.odp,
                master = odp && odp._master,
                handler = field.OnDemandHandler,
                deferred;
            if (master) {
                deferred = $.Deferred();
                odp.is('active');
                odp.tracking(controller, true);
                $.when(_odp.getControllers(controller)).done(function () {
                    var key = options.key,
                        keyField = _odp.controllers[controller].key[0].name,
                        files = options.files,
                        fileInfo = {
                            file: files.length ? files[0] : files,
                            field: field.Name,
                            keyField: keyField,
                            controller: controller,
                            // uploadFile arguments
                            key: key, // needs to be resolved after commit to the server
                            handler: handler,
                            apiVer: options.apiVer
                        },
                        fileIsEmpty = !fileInfo.file.size,
                        odpFiles = odp._files,
                        fileList = odpFiles['list'],
                        formatStrings = _odp.blobUrlFormatStrings(field.OnDemandStyle);
                    // remove an existing pending file
                    fileList.every(function (fi, fileIndex) {
                        var found = fi.handler === fileInfo.handler && fi.key === fileInfo.key;
                        if (found)
                            fileList.splice(fileIndex, 1);
                        return !found;
                    });
                    // create up to 3 variations of URLs
                    formatStrings.forEach(function (fmt, urlIndex) {
                        var url = String.format(fmt, handler, key),
                            oldInfo = odpFiles[url],
                            isNew;
                        delete odpFiles[url];
                        if (!fileIsEmpty)
                            odpFiles[url] = fileInfo;
                        if (urlIndex)
                            odpFiles[url] = _odp.toThumbnail(fileInfo, urlIndex);
                        else
                            if (oldInfo)
                                isNew = fileInfo.new = oldInfo.new;
                        if (!urlIndex) // only the original will be uploaded to the server
                            fileList.push(fileInfo);
                    });
                    deferred.resolve();
                });

                result = deferred.promise();
            }
            else
                result = _odp.uploadFile(options);
            return result;
        },
        enabled: function (value) {
            var that = this,
                checkedSettings = that._checkedSettings;
            if (arguments.length) {
                that._enabled = value === true;
                checkedSettings = true;
            }
            that._checkedSettings = true;
            if (!checkedSettings) {
                if (typeof __settings != 'undefined')
                    odpSettings = __settings && __settings.odp;
                if (!odpSettings)
                    odpSettings = {};
                if ($('body').data('offline')/* && !odpSettings.enabled*/)
                    odpSettings.enabled = true;
                that._enabled = odpSettings.enabled === true;
                _odp._pageSize = odpSettings.pageSize || 100;
            }
            return _touch && this._enabled === true;
        },
        offline: function () { return false; },
        get: function (dataView) {
            var instance = null;
            if (_touch) {
                var activeDataView = dataView || _touch.dataView();
                if (activeDataView) {
                    if (activeDataView._survey)
                        activeDataView = findDataView(activeDataView._survey.parent);
                    if (activeDataView)
                        instance = activeDataView.odp;
                }
            }
            return instance;
        },
        start: function () {
            _odp.controllers = {};
            _odp._controllers = {};
            _odp.functions = {};
            _odp._pk = {};
            _odp._sequence = 0;
            _odp._pendingResponses = {};
        },
        response: function (method, response) {
            var pendingResponses = _odp._pendingResponses;
            if (!pendingResponses)
                return null;
            if (arguments.length === 2)
                pendingResponses[method] = response;
            else {
                response = pendingResponses[method];
                if (response)
                    pendingResponses[method] = null;
                return response;
            }
        },
        invoke: function (dataView, params) {
            var that = this,
                servicePath = dataView.get_servicePath(),
                methodName = params.url.substring(servicePath.length + 1),
                deferred = $.Deferred(),
                odp,
                pendingResponse = _odp.response(methodName),
                prefetchName = '_' + dataView._id + '_prefetch',
                pendingPrefetch = _window[prefetchName],
                runOnServer = true;

            function complete() {
                $.ajax(params).done(function (result) {
                    deferred.resolve(result);
                }).fail(function (jqXHR, textStatus, error) {
                    deferred.reject(jqXHR, textStatus, error);
                });
            }

            function ensureOdp() {
                if (_app.odp.enabled()) {
                    odp = dataView.odp;
                    // assign an Offline Data Processor instance to all members of modal hierarchy
                    if (!odp && odp !== false && methodName.match(/GetPage|GetListOfValues|Execute/)) {
                        var enabled = dataView.tagged(/\odp\-enabled\-(\w+)\b/);
                        enabled = enabled ? enabled[1] : 'auto';
                        if (enabled !== 'none') {
                            if (dataView._dataViewFieldParentId) {
                                var master = findDataView(dataView._filterSource);
                                if (master)
                                    odp = master.odp;
                            }
                            else {
                                var parent = dataView.get_parentDataView();
                                if (parent) {
                                    if (dataView._filterSource)
                                        odp = parent.odp;
                                    if (!odp)
                                        if (parent.odp)
                                            odp = parent.odp;
                                        else
                                            odp = createDataProcessor(dataView, null, enabled);
                                }
                                else if (_odp.offline('sync', { controller: dataView._controller }))
                                    odp = createDataProcessor(dataView, null, enabled);
                            }
                            if (!odp && dataView._isModal) {
                                var currentDataView = $app.touch.dataView();
                                if (currentDataView)
                                    odp = currentDataView.odp;
                            }
                        }
                        dataView.odp = odp;
                    }
                    // execute request locally when needed and skip execution on the server
                    if (odp && odp.invoke({ method: methodName, dataView: dataView, params: params, deferred: deferred }))
                        runOnServer = false;
                }
            }

            params.processData = false; // jQuery 3.5.1 is replacing %20 with +, which is problematic for values that look like this: %js%20

            if (pendingPrefetch && methodName === 'GetPage') {
                // replace "]_[/script>]^[" or "]_[script>]^["
                var prefetchJSON = pendingPrefetch.innerHTML.replace(/\]\_\[(\/?script.)\]\^\[/gi, '<$1'),
                    timeStamp = prefetchJSON.match(/\"TimeStamp\"\:\"ts(\d{4}\-\d{2}\-\d{2}T\d{2}\:\d{2}\:\d{2})\"/);
                if (timeStamp)
                    if (dataView.pageProp(prefetchName) === timeStamp[1])
                        prefetchJSON = null;
                    else
                        dataView.pageProp(prefetchName, timeStamp[1]);
                $(pendingPrefetch).remove();

            }
            if (prefetchJSON) {
                ensureOdp();
                deferred.resolve(prefetchJSON);
            }
            else if (pendingResponse) {
                ensureOdp();
                deferred.resolve(pendingResponse);
            }
            else {

                // compress method argument data properties
                executeCompressedProperties.forEach(function (compressInfo) {
                    if (JSON && compressInfo._m === methodName)
                        for (var prop in compressInfo) {
                            var data = params.data;
                            if (compressInfo._r)
                                data = data[compressInfo._r];
                            if (data && !prop.match(/^_/)) {
                                if (prop !== 'Me')
                                    data = data[prop];
                                if (data)
                                    if (Array.isArray(data))
                                        data.forEach(function (item) {
                                            compressObjectProperty(item, compressInfo[prop]);
                                        });
                                    else
                                        compressObjectProperty(data, compressInfo[prop]);
                            }
                        }
                });
                ensureOdp();
                if (runOnServer) {
                    var ensureData = (methodName === 'GetPage' || methodName === 'Execute') && !(dataView._api && dataView._api.background),
                        locationHref = location.href,
                        startUrl = _touch ? _touch.startUrl() : locationHref;
                    params.data = _app.toAjaxData(params.data);
                    if (startUrl !== locationHref) {
                        if (!params.headers) params.headers = {};
                        params.headers['X-Start-Url'] = startUrl;
                    }
                    if (ensureData)
                        that.ensureData().then(complete);
                    else
                        complete();
                }
            }
            return deferred.promise();
        },
        ensureData: function () {
            return _odp.offline('ensureData') || $.when(true);
        },
        verify: function (dataView) {
            var odp = dataView.odp,
                isForm = dataView.get_isForm();
            if (odp)
                if (odp.root(dataView) && odp.enabled()) {
                    var hasDataViewFields;
                    $(dataView._fields).each(function () {
                        if (this.Type === 'DataView') {
                            hasDataViewFields = true;
                            return false;
                        }
                    });
                    if (!hasDataViewFields && !_odp.offline('sync', { controller: dataView._controller }) || !isForm)
                        dataView.odp = null;
                }
                else if (isForm && /*!dataView._filterSource &&*/ odp.root() !== dataView)
                    dataView.odp = createDataProcessor(dataView, odp);
        },
        getControllers: function (controllers) {
            if (!Array.isArray(controllers))
                controllers = [controllers];

            var missing = [],
                pending = [],
                deferred = $.Deferred(),
                cachedControllers = _odp.controllers,
                pendingControllers = _odp._controllers;

            function resolve() {
                var configList = [];
                controllers.forEach(function (controller) {
                    configList.push(cachedControllers[controller]);
                });
                deferred.resolve(configList);
            }

            function processControllers(controllers) {
                controllers.forEach(function (obj) {
                    var dataController = obj.dataController;
                    cachedControllers[dataController.name] = dataController;
                    // create maps of data controller configuration objects
                    var map = dataController._map = { key: {}, fields: {}, views: {} };
                    var key = dataController.key = [];
                    dataController.fields.forEach(function (f) {
                        map.fields[f.name] = f;
                        if (f.isPrimaryKey) {
                            key.push(f);
                            map.key[f.name] = f;
                        }
                    });
                    dataController.views.forEach(function (v) {
                        map.views[v.id] = v;
                    });
                });
                resolve();
                controllers.forEach(function (obj) {
                    pendingControllers[obj.dataController.name].resolve();
                });
            }

            controllers.forEach(function (controller) {
                if (!cachedControllers[controller]) {
                    var pendingDeferred = pendingControllers[controller];
                    if (!pendingDeferred) {
                        missing.push(controller);
                        pendingDeferred = pendingControllers[controller] = $.Deferred();
                    }
                    pending.push(pendingDeferred.promise());
                }
            });

            if (missing.length) {
                if (_odp.offline('sync', { controller: missing }))
                    _odp.offline('query', { controller: missing }).then(processControllers);
                else
                    $.ajax({
                        url: __servicePath + '/GetControllerList',
                        method: 'POST',
                        cache: false,
                        dataType: 'text',
                        authorize: true,
                        data: JSON.stringify({ controllers: missing })
                    }).then(function (result) {
                        var metadata = JSON.parse(JSON.parse(result).d);
                        processControllers(metadata);
                    });
            }
            else
                $.when.apply($, pending).done(resolve);
            return deferred.promise();
        },
        parseMap: function (scope, callback) {
            var config = _odp.controllers[scope.controller],
                scopeField = scope.field,
                field = config._map.fields[scopeField],
                items = field.items || {},
                list = items._copy,
                aliasFieldName;

            function testDataFieldForAlias(df) {
                if (df.fieldName === scopeField)
                    aliasFieldName = df.aliasFieldName;
            }

            if (!list) {
                list = items._copy = [];
                config.views.every(function (v) {
                    if (v.categories)
                        v.categories.every(function (c) {
                            c.dataFields.every(function (df) {
                                testDataFieldForAlias(df);
                                return !aliasFieldName;
                            });
                            return !aliasFieldName;
                        });
                    if (v.dataFields)
                        v.dataFields.every(function (df) {
                            testDataFieldForAlias(df);
                            return !aliasFieldName;
                        });
                    return !aliasFieldName;
                });
                if (aliasFieldName)
                    list.push({ t: aliasFieldName, f: items.dataTextField || items.dataValueField });
                _app.parseMap(field, function (toField, fromField) {
                    list.push({ t: toField, f: fromField });
                });
            }
            list.forEach(function (entry) {
                callback.call(field, entry.t, entry.f);
            });
        },
        commit: function (options) {
            var controller = options.controller,
                odp = options.odp,
                log = odp._log,
                dataView = odp._dataView,
                deferred = $.Deferred(),
                actionResult,
                fileUploads = [],
                masterChanged;

            function resolve() {
                dataView._busy(false);
                if (!actionResult)
                    actionResult = ActionResult_new(1);
                deferred.resolve(actionResult);
                var d = options.deferred;
                if (d)
                    d.resolve(jsonToData(actionResult));
            }

            function uploadBlobsToServer() {
                var masterBlob;
                do {
                    masterBlob = dataView.uploadNextBlob(dataView._lastArgs.Values, actionResult ? actionResult.Values : []);
                    if (masterBlob)
                        fileUploads.push(masterBlob);
                } while (masterBlob);
                odp._files['list'].forEach(function (file) {
                    if (!(file.new && (!file.file.size || file.key.toString().match(/^\-/)))) // do not upload "new" file that was cleared (size == 0) or the one with the negative primary key
                        fileUploads.push(_odp.uploadFile(file));
                });
                dataView._busy(true);
                if (fileUploads.length) {
                    _touch.notify({ text: String.format(resourcesODP.UploadingFiles, fileUploads.length), force: true });
                    $.when.apply($, fileUploads).done(resolve).fail(function () {
                        // note that a failure to upload any file will stop uploading and resolve the transaction since there is nothing that the user can do about it.
                        _app.alert(resourcesODP.UploadFailed).done(resolve);
                    });
                }
                else
                    resolve();
                return fileUploads.length;
            }

            if (log.length) {
                masterChanged = controller === log[0].controller;
                $.ajax({
                    url: __servicePath + '/commit',
                    method: 'POST',
                    authorize: true,
                    cache: false,
                    dataType: 'text',
                    processData: false,
                    data: JSON.stringify({ log: log })
                }).done(function (result) {
                    result = result ? JSON.parse(result).d : {};
                    if (result.Success) {
                        actionResult = ActionResult_new(1);
                        if (masterChanged && log[0].args.CommandName === 'Insert' && result.Values.length) {
                            var kfv = result.Values[0];
                            if (kfv.Controller === controller)
                                actionResult.Values.push({ Name: kfv.Name, NewValue: kfv.Value, Modified: true });
                        }
                        log.splice(0);
                        // resolve keys in the pending files and upload blobs to the server
                        odp._files['list'].forEach(function (file) {
                            // resolve keys once for "original" URL only
                            result.Values.every(function (kfv) {
                                var result = kfv.Controller === file.controller && kfv.Name === file.keyField && kfv.OldValue === file.key;
                                if (result)
                                    file.key = kfv.NewValue;
                                return !result;
                            });
                        });
                        uploadBlobsToServer();
                    }
                    else {
                        odp.snapshot('restore');
                        actionResult = ActionResult_new(result.Errors);
                        resolve();
                    }
                }).fail(function () {
                    odp.snapshot('restore');
                    actionResult = ActionResult_new(resourcesODP.UnableToSave);
                    resolve();
                });
            }
            else
                uploadBlobsToServer();
            return deferred.promise();
        },
        func: function (text) {
            if (!text.match(/\)$/)) {
                if (text.match(/\bthis\./)) {
                    var indexOfBraket = text.indexOf('{'),
                        newText = text.substring(0, indexOfBraket);
                    newText += '{var t=this';
                    if (text.match(/\$app\.odp\.filters\./))
                        newText += ',f=$app.odp.filters';
                    newText += ';';
                    text = newText + text.substring(indexOfBraket + 1).replace(/\bthis\./g, 't.').replace(/\$app\.odp\.filters\./g, 'f.');
                }
                text = '(function' + text + ')';
            }
            var result = _odp.functions[text];
            if (!result)
                result = _odp.functions[text] = eval(text);
            return result;
        },
        compare: function (a, b) {
            if (a == null)
                if (b == null)
                    return 0;
                else
                    return -1;
            else
                if (b == null)
                    return 1;
            if (typeof a == 'string')
                a = a.toUpperCase();
            if (typeof b == 'string')
                b = b.toUpperCase();
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        },
        filters: {
            _regexCache: {},
            _inrange: function (v, test) {
                // TODO: review and pass a better filter that uses two parameters (startDate and endDate)
                return v === test;
            },
            _eq: function (v, test) {
                if (v == null || test == null)
                    return false;
                return v == test;
            },
            _like: function (v, test) {
                if (v == null || test == null)
                    return false;
                var re = _odp.filters._regexCache[test],
                    reKey;
                if (!re) {
                    reKey = test;
                    if (test.match(/^\%/)) {

                        test = test.substring(1);
                        if (test.match(/\%$/)) {
                            // %abc%
                            test = test.substring(0, test.length - 1);
                            re = new RegExp(RegExp.escape(test), 'i');
                        }
                        else
                            // %abc
                            re = new RegExp(RegExp.escape(test) + '$', 'i');

                    }
                    else
                        if (test.match(/\%$/)) {
                            test = test.substring(0, test.length - 1);
                            // abc%
                            re = new RegExp('^' + RegExp.escape(test), 'i');
                        }
                        else
                            // abc
                            re = new RegExp('^' + RegExp.escape(test) + '$', 'i');
                    _odp.filters._regexCache[reKey] = re;
                }
                if (typeof v !== 'string')
                    v = v.toString();
                return v.match(re) != null;
            },
            beginswith: function (v, test) {
                if (v == null || test == null)
                    return false;
                if (typeof v !== 'string')
                    v = v.toString();
                if (typeof test !== 'string')
                    test = test.toString();
                v = v.toUpperCase();
                test = test.toUpperCase();
                return !v.indexOf(test);
            },
            doesnotbeginwith: function (v, test) {
                return false;
            },
            contains: function (v, test) {
                return false;
            },
            doesnotcontain: function (v, test) {
                return false;
            },
            endswith: function (v, test) {
                return false;
            },
            doesnotendwith: function (v, test) {
                return false;
            },
            between: function (v, test) {
                return false;
            },
            in: function (v, test) {
                if (v == null)
                    return false;
                if (!Array.isArray(test))
                    test = [test];
                var result = false;
                test.every(function (testValue) {
                    if (v == testValue)
                        result = true;
                    return !result;
                });
                return result;
            },
            notin: function (v, test) {
                return !this.in(v, test);
            },
            month1: function (v, test) {
                return false;
            },
            month2: function (v, test) {
                return false;
            },
            month3: function (v, test) {
                return false;
            },
            month4: function (v, test) {
                return false;
            },
            month5: function (v, test) {
                return false;
            },
            month6: function (v, test) {
                return false;
            },
            month7: function (v, test) {
                return false;
            },
            month8: function (v, test) {
                return false;
            },
            month9: function (v, test) {
                return false;
            },
            month10: function (v, test) {
                return false;
            },
            month11: function (v, test) {
                return false;
            },
            month12: function (v, test) {
                return false;
            },
            thismonth: function (v, test) {
                return false;
            },
            nextmonth: function (v, test) {
                return false;
            },
            lastmonth: function (v, test) {
                return false;
            },
            quarter1: function (v, test) {
                return false;
            },
            quarter2: function (v, test) {
                return false;
            },
            quarter3: function (v, test) {
                return false;
            },
            quarter4: function (v, test) {
                return false;
            },
            thisquarter: function (v, test) {
                return false;
            },
            lastquarter: function (v, test) {
                return false;
            },
            nextquarter: function (v, test) {
                return false;
            },
            thisyear: function (v, test) {
                return false;
            },
            nextyear: function (v, test) {
                return false;
            },
            lastyear: function (v, test) {
                return false;
            },
            yeartodate: function (v, test) {
                return false;
            },
            thisweek: function (v, test) {
                return false;
            },
            nextweek: function (v, test) {
                return false;
            },
            lastweek: function (v, test) {
                return false;
            },
            today: function (v, test) {
                return false;
            },
            yesterday: function (v, test) {
                return false;
            },
            tomorrow: function (v, test) {
                return false;
            },
            past: function (v, test) {
                return false;
            },
            future: function (v, test) {
                return false;
            },
            true: function (v, test) {
                return false;
            },
            false: function (v, test) {
                return false;
            },
            isempty: function (v, test) {
                return v == null;
            },
            isnotempty: function (v, test) {
                return v != null;
            }
        },
        pk: function (controllerName, type) {
            var pkValue = _odp.offline('pk', { controller: controllerName });
            if (pkValue === false) {
                pkValue = _odp._pk[controllerName];
                if (pkValue == null)
                    pkValue = _odp._pk[controllerName] = 0;
                pkValue--;
                _odp._pk[controllerName] = pkValue;
            }

            if (type.match(/(Guid|String)/)) {
                pkValue = ('000000000000' + (pkValue * -1).toString(16));
                pkValue = '00000000-0000-0000-0000-' + pkValue.substr(pkValue.length - 12);
            }
            return pkValue;
        }
    };

    //
    // Implementation of OfflineDataProcessor for local data processing
    //

    function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function createDataProcessor(dataView, odp, enabled) {
        var processor = new _app.OfflineDataProcessor(dataView, odp);
        if (enabled)
            processor._enabled = enabled;
        return processor;
    }

    function ViewPage_initializeManyToManyProperties(field, controller) {
        var that = this,
            deferred,
            itemsTargetController = field.ItemsTargetController;
        // do not try to intialize fields that are not many-to-many or if ItemsDataValueField is explicitly defined
        if (!itemsTargetController)
            return $.when(true);
        if (!controller)
            controller = that.Controller;
        deferred = $.Deferred();
        _odp.getControllers(itemsTargetController).then(function (target) {
            target = target[0];
            var field1, field2;
            target.fields.every(function (f) {
                if (f.items && f.items.dataController === controller)
                    field1 = f;
                return !field1;
            });
            target.fields.every(function (f) {
                if (f.items && f.items.dataController === field.ItemsDataController)
                    field2 = f;
                return !field2;
            });
            var field2Items = field2.items;
            if (field2Items) {
                field.ItemsDataValueField = field2Items.dataValueField;
                field.ItemsDataTextField = field2Items.dataTextField;
                field.ItemsDataView = field2Items.dataView;
            }
            deferred.resolve({ targetForeignKey1: field1.name, targetForeignKey2: field2.name });
        });
        return deferred.promise();
    }

    function logArgsToKey(args) {
        var config = _odp.controllers[args.Controller],
            values = args.Values,
            key = [], i, fv;
        i = values.length - 1; // it is more likely that the key is one of the last values
        while (i >= 0 && key.length < config.key.length) {
            fv = values[i];
            if (config._map.key[fv.Name])
                key.push(fv.OldValue == null ? fv.NewValue : fv.OldValue);
            i--;
        }
        return JSON.stringify(key);
    }

    function actionArgs_find(args, name) {
        var i, result, fv,
            values = args.Values;
        for (i = 0; i < values.length; i++) {
            fv = values[i];
            if (fv.Name === name) {
                result = fv;
                break;
            }
        }
        return result;
    }

    function actionArgs_merge(oldArgs, newArgs) {
        var i = 0,
            config = _odp.controllers[newArgs.Controller],
            fv, oldFieldValue,
            values = newArgs.Values,
            keyCount = 0, continueToNext;
        while (i < values.length) {
            fv = values[i];
            continueToNext = true;
            oldFieldValue = actionArgs_find(oldArgs, fv.Name);
            if (oldFieldValue) {
                if (fv.Modified) {
                    oldFieldValue.NewValue = fv.NewValue;
                    oldFieldValue.Modified = true;
                }
                if (config._map.key[fv.Name])
                    keyCount++;
            }
            else
                oldArgs.Values.push(fv);
            values.splice(i, 1);
            continueToNext = false;
            if (continueToNext)
                i++;
        }
        if (values.length <= keyCount)
            values.splice(0);
    }

    function actionArgs_compressLog(log, index) {
        var actionArgs, prevActionArgs, prevIndex,
            key,
            controller,
            commandName, updating, deleting,
            prevCommandName, prevUpdating, prevInserting,
            selectedValues, continueToNext;
        while (odpSettings.compressLog !== false && index && index < log.length) {
            continueToNext = true;
            key = null;
            actionArgs = log[index].args;
            controller = actionArgs.Controller;
            view = actionArgs.View;
            commandName = actionArgs.CommandName;
            updating = commandName === 'Update';
            deleting = commandName === 'Delete';
            selectedValues = actionArgs.SelectedValues || [];
            if (selectedValues.length <= 1 && (updating || deleting)) {
                prevIndex = index - 1;
                while (prevIndex >= 0) {
                    prevActionArgs = log[prevIndex].args;
                    prevCommandName = prevActionArgs.CommandName;
                    prevUpdating = prevCommandName === 'Update';
                    prevInserting = prevCommandName === 'Insert';

                    if (prevActionArgs.Controller === controller) {
                        if (!key)
                            key = logArgsToKey(actionArgs);
                        if (logArgsToKey(prevActionArgs) === key) {
                            if (updating && (prevInserting || prevUpdating)) {
                                actionArgs_merge(prevActionArgs, actionArgs); // merge "update" values with the previous "insert" or "update"
                                if (!actionArgs.Values.length) {
                                    log.splice(index, 1);    // delete the "update" entry since all modifications are incorporated in the previosly logged "insert" or "update" 
                                    continueToNext = false;
                                }
                                break;
                            }
                            else if (deleting) {
                                if (prevUpdating) {
                                    log.splice(prevIndex, 1); // delete the previous "update" entry since we are going to delete the row anyway
                                    index--;
                                }
                                else if (prevInserting) {
                                    log.splice(prevIndex, 1); // delete the prevous "insert" entry since we are going to delete the row anyway
                                    index--;
                                    log.splice(index, 1);     // delete the "delete" entry as well -  the data will not be persisted.
                                    continueToNext = false;
                                    break;
                                }
                            }
                        }
                    }
                    prevIndex--;
                }
            }
            if (continueToNext)
                index++;
        }
    }

    _app.OfflineDataProcessor = function (dataView, odp) {
        var that = this;
        that._cache = {};               // general purpose global cache - needs to be cleared after each commit 
        that._sequence = _odp._sequence++;
        that._date = new Date();
        that._dataView = dataView;
        that._state = 'inactive';       // state of the ODP instance
        that._data = {};                // array of data objects
        that._log = [];                 // log of ExecuteArgs
        that._dataLoadMap = {};         // map of loaded data objects 
        that._dataLoadedKeys = {};      // map of loaded object keys
        that._dataLoadAll = {};         // map of controllers that require the full set of objects
        that._tracking = {};            // map of controllers that have their data tracked by ODP instance
        var files = that._files = {},   // map of uploaded BLOBs of DataView fields
            odpFiles, url, file;
        that._master = odp;
        if (odp) {
            odpFiles = odp._files;
            // borrow data loading info from the master ODP instance
            for (url in odpFiles) {
                file = odpFiles[url];
                files[url] = url === 'list' ? file.slice(0) : file;
            }
            //that._dataLoadMap = cloneObject(odp._dataLoadMap);
            //that._dataLoadedKeys = cloneObject(odp._dataLoadedKeys);
            //that._dataLoadAll = cloneObject(odp._dataLoadAll);
            that._tracking = cloneObject(odp._tracking);
        }
        else
            files['list'] = [];
    };

    _app.OfflineDataProcessor.prototype = {
        is: function (value) {
            var that = this,
                fileList;
            if (arguments.length) {
                if (value.match(/^:/)) {
                    if (value === ':dirty') {
                        fileList = that._files['list'];
                        return that._log.length > 0 || that._dataView._pendingUploads != null || fileList.length && fileList._dirty;
                    }
                    return that._state === value.substring(1);
                }
                else
                    that._state = value;
            }
            else
                return that._state;

        },
        enabled: function () {
            return this._enabled !== 'none';
        },
        root: function (value) {
            return arguments.length === 1 ? this._dataView === value : this._dataView;
        },
        snapshot: function (method) {
            var that = this,
                snapshot = that._snapshot;
            if (method === 'restore') {
                if (snapshot)
                    that._log = JSON.parse(snapshot);
            }
            else
                that._snapshot = JSON.stringify(that._log);

        },
        invoke: function (data) {
            var that = this,
                master = that._master,
                log = that._log,
                result,
                dataView = data.dataView,
                controller = dataView._controller,
                lastArgs = dataView._lastArgs,
                commandName = lastArgs ? lastArgs.CommandName : '',
                root = that._dataView,
                isRoot = root === dataView,
                method = data.method,
                executeIndex = 0, executeLog, executeDeferred, executeLogActionResult,
                //executeDeferredList,
                originalDeferred,
                rootChanged;

            function packageActionArgs(date) {
                var d = data.params.data,
                    args = d.args;
                args.Date = _app.stringifyDate(arguments.length ? date : new Date());
                args.Sequence = that._sequence;
                return d;
            }

            function executeLogActions(actionResult) {
                var doPromise;
                if (!executeDeferred) {
                    executeDeferred = $.Deferred();
                    doPromise = true;
                }
                if (!executeLogActionResult)
                    executeLogActionResult = actionResult;
                var actionData = executeLog[executeIndex++];
                if (actionData) {
                    var actionArgs = actionData.args,
                        actionController = actionData.controller,
                        deferred = $.Deferred(),
                        executeData = { deferred: deferred, method: 'Execute', params: { data: actionData } };
                    actionArgs.Sequence = master._sequence;
                    //executeDeferredList.push(deferred.promise());
                    master.tracking(actionController, true);
                    $.when(master.getData(actionController, actionArgs.ExternalFilter)).done(function () {
                        master.execute(executeData);
                    });
                    $.when(deferred.promise()).then(executeLogActions);
                }
                else
                    executeDeferred.resolve(executeLogActionResult);
                return doPromise ? executeDeferred.promise() : null;
            }

            function commitToMaster(actionResult) {
                // execute data requests against master data
                master.snapshot();
                var masterLog = master._log,
                    masterLogStartIndex = masterLog.length;
                log.forEach(function (actionData) {
                    masterLog.push(actionData);
                });
                var ownerId = dataView.get_parentDataView()._dataViewFieldOwnerId;
                if (ownerId)
                    log.forEach(function (tx) {
                        tx.owner = ownerId;
                    });
                executeLog = log.slice(0);
                $.when(executeLogActions()).done(function (actionResult) {
                    var masterActionData = rootChanged ? actionResult : jsonToData(ActionResult_new(1)),
                        masterActionResult = JSON.parse(masterActionData).d;
                    if (masterActionResult.Errors.length) {
                        that.snapshot('restore');
                        master.snapshot('restore');
                        data.deferred.resolve(masterActionData);
                    }
                    else {
                        var fileUploadDeferredList = [],
                            masterFiles = master._files,
                            masterList = masterFiles['list'],
                            masterBlob;
                        do {
                            masterBlob = dataView.uploadNextBlob(lastArgs.Values, masterActionResult ? masterActionResult.Values : []);
                            if (masterBlob) {
                                fileUploadDeferredList.push(masterBlob);
                                masterList._dirty = true;
                            }
                        } while (masterBlob);
                        $.when.apply($, fileUploadDeferredList).then(function () {
                            dataView._busy(false);
                            // copy BLOB files to the master
                            var files = that._files,
                                fileList = files['list'],
                                blobUpdateDeferred = [];
                            for (var url in files)
                                if (url !== 'list') {
                                    var existingFile = masterFiles[url];
                                    if (existingFile) {
                                        var indexOfExistingFile = masterList.indexOf(existingFile);
                                        if (indexOfExistingFile !== -1)
                                            masterList.splice(indexOfExistingFile, 1);
                                    }
                                    masterFiles[url] = files[url];
                                }
                            fileList.forEach(function (f) {
                                // there may be no URLs in the files and therefore we need to check for duplicates
                                if (masterList.indexOf(f) === -1) {
                                    var add = true;
                                    masterList.every(function (mf) {
                                        if (mf.controller === f.controller && mf.field === f.field && mf.key === f.key) {
                                            // if the file is new then replace the "new" submission
                                            mf.file = f.file;
                                            add = false;
                                        }
                                        return add;
                                    });
                                    if (add)
                                        masterList.push(f);
                                    blobUpdateDeferred.push(_odp.updateBlob(master, f));
                                }
                            });
                            if (fileList._dirty)
                                masterList._dirty = true;
                            // resolve the pending master action
                            $.when.apply($, blobUpdateDeferred).then(function () {
                                log.splice(0); // clear the log
                                files['list'] = [];
                                actionArgs_compressLog(masterLog, masterLogStartIndex);
                                data.deferred.resolve(masterActionData);
                            });
                        });
                    }
                });
            }

            function executeOnClient() {
                if (method.match(/^(GetPage|Execute|GetListOfValues)$/) && that.tracking(dataView)) {
                    $.when(_odp.getControllers(controller)).done(function () {
                        if (root.inserting() && method === 'GetPage' && !data.params.data.request.ExternalFilter && !that._dataLoadAll[controller])
                            that._dataLoadAll[controller] = true;
                        $.when(that.ensureData(controller, method)).done(function () {
                            if (root.inserting() && that._dataLoadAll[controller] || method === 'Execute' && commandName === 'Insert')
                                that.execute(data);
                            else
                                $.when(that.getData(controller, dataView.get_externalFilter())).done(function () {
                                    that.execute(data);
                                });
                        });
                    });
                    result = true;
                }
            }

            if (isRoot) {
                if (method === 'GetPage' && dataView.get_lastCommandName() === 'New')
                    that.is('active');
                else if (method === 'Execute') {
                    that.snapshot();
                    rootChanged = commandName === 'Insert' || commandName === 'Delete' && master;
                    if (!rootChanged)
                        data.params.data.args.Values.every(function (fv) {
                            var result = true;
                            if (fv.Modified) {
                                rootChanged = true;
                                result = false;
                            }
                            return result;
                        });
                    if (!master && _odp.offline('sync', { controller: controller })) {
                        originalDeferred = data.deferred;
                        data.deferred = $.Deferred();
                        // commit to offline storage on the client
                        if (commandName !== 'Update' || rootChanged) {
                            rootChanged = true;
                            executeOnClient();
                            data.deferred.done(function (r) {
                                var result = JSON.parse(r).d;
                                if (result.Errors.length) {
                                    that.snapshot('restore');
                                    originalDeferred.resolve(r);
                                }
                                else
                                    _odp.offline('commit', { dataView: dataView, changes: packageActionArgs(that._date) }).then(function () {
                                        originalDeferred.resolve(r);
                                    });
                            });
                        }
                        else {
                            // Command 'Update' will commit a non-empty log but will include the 'arguments of 'Update' since master has not changed.
                            // Pretend that operation was successful.
                            _odp.offline('commit', { dataView: dataView }).then(function () {
                                originalDeferred.resolve(jsonToData(ActionResult_new(1)));
                            });
                        }
                        return true;
                    }
                    else if (commandName.match(/^(Insert|Update|Delete)$/)) {
                        if (rootChanged || that.is(':dirty')) {
                            // commit the log 
                            if (rootChanged) {
                                // skip all log entries that are not "owned" by this processor
                                var insertionPoint = 0;
                                while (insertionPoint < log.length && log[insertionPoint].owner !== dataView._id)
                                    insertionPoint++;
                                log.splice(insertionPoint, 0, packageActionArgs(that._date));
                            }
                            if (master) {
                                // commit data locally to master ODP instance
                                master.is('active');
                                executeDeferredList = [];
                                // get the master controller configuration
                                if (rootChanged)
                                    $.when(_odp.getControllers(controller)).done(commitToMaster);
                                else
                                    commitToMaster();
                            }
                            else
                                // commit data on the server
                                _odp.commit({
                                    odp: that,
                                    controller: controller,
                                    deferred: data.deferred
                                });
                            return true;
                        }
                        else
                            if (commandName === 'Update') {
                                // user has saved the record without making any changes to the field values
                                data.deferred.resolve(jsonToData(ActionResult_new(1))); // eliminate the server roundtrip
                                return true;
                            }
                            else
                                return false; // execute request on the server
                    }
                }
            }
            else {
                if (method === 'Execute' && commandName.match(/^(Insert|Update|Delete)$/)) {
                    that.is('active');
                    log.push(packageActionArgs());
                    actionArgs_compressLog(log, log.length - 1);
                    that.tracking(controller, true);
                    if (!dataView._filterSource && that._dataLoadAll[controller] == null)
                        that._dataLoadAll[controller] = true;
                }
                else
                    if (method === 'GetPage' && root.inserting()) {
                        master = dataView;
                        while (master && master._filterSource)
                            master = findDataView(master._filterSource);
                        if (master && master !== dataView && master.inserting())
                            that.tracking(controller, true);
                    }
            }
            executeOnClient();
            return !!result;
        },
        tracking: function (controller) {
            var testing = arguments.length === 1;
            if (typeof controller !== 'string')
                controller = controller._controller;
            if (testing && _odp.offline('sync', { controller: controller }))
                return true;
            var trackingMap = this._tracking;
            if (testing)
                return !!trackingMap[controller];
            else
                trackingMap[controller] = arguments[1];

        },
        ensureData: function (controller, method) {
            var that = this,
                deferred = $.Deferred();
            if (method !== 'Execute' && that._dataLoadAll[controller] || _odp.offline('sync', { controller: controller }))
                that.getData(controller).done(function () {
                    deferred.resolve();
                });
            else
                deferred.resolve();
            return deferred.promise();
        },
        // The actual data is not fetched by the child ODP. Only the data load map is cloned from the master.
        // Borrowing will clone the data on-demand. Borrowed data contains the user-created objects and server content.
        _borrowData: function (controller) {
            var that = this,
                master = that._master,
                dataToBorrow;
            if (!that._data[controller])
                while (master) {
                    dataToBorrow = master._data[controller];
                    if (dataToBorrow) {
                        that._data[controller] = cloneObject(dataToBorrow);
                        that._dataLoadMap[controller] = cloneObject(master._dataLoadMap[controller] || {});
                        that._dataLoadedKeys[controller] = cloneObject(master._dataLoadedKeys[controller] || {});
                        that._dataLoadAll[controller] = cloneObject(master._dataLoadAll[controller] || {});
                        break;
                    }
                    else
                        master = master._master;
                }
        },
        getData: function (controller, externalFilter) {
            var that = this,
                deferred = $.Deferred(),
                rowCount,
                masterCache, master,
                loadMapKey, cacheKey, cache,
                loadFromServer,
                dataLoadMap;

            function resolve() {
                var data = that._data[controller];
                deferred.resolve(data);
            }

            function loadPage(pageIndex) {
                var pageSize = _odp._pageSize;
                _app.execute({
                    controller: controller,
                    view: 'offline',
                    pageSize: pageSize,
                    pageIndex: pageIndex,
                    requiresRowCount: !pageIndex,
                    externalFilter: externalFilter,
                    odp: false,
                    nativeDates: false,
                    background: true
                }).done(function (result) {
                    var data = result[controller];
                    // cache serialized data globally
                    if (!cache)
                        cache = masterCache[cacheKey] = [];
                    cache.push(JSON.stringify(data));
                    // add data to the local instance
                    if (!pageIndex)
                        rowCount = result.totalRowCount;
                    that.addData(controller, data);
                    rowCount -= pageSize;
                    if (rowCount < 0)
                        resolve();
                    else
                        loadPage(pageIndex + 1);
                });
            }

            that._borrowData(controller);

            dataLoadMap = that._dataLoadMap[controller];
            if (!dataLoadMap)
                dataLoadMap = that._dataLoadMap[controller] = {};
            loadMapKey = externalFilter && externalFilter.length ? JSON.stringify(externalFilter) : '_all';
            cacheKey = controller + '$' + loadMapKey;
            if (!dataLoadMap['_all'] && !dataLoadMap[loadMapKey]) {
                if (_odp.offline('sync', { controller: controller })) {
                    dataLoadMap['_all'] = true;
                    _odp.offline('query', { data: controller }).then(function (data) {
                        that.addData(controller, data);
                        resolve();
                    });
                }
                else {
                    dataLoadMap[loadMapKey] = true;
                    master = that;
                    while (master._master)
                        master = master._master;
                    masterCache = master._cache;
                    cache = masterCache[cacheKey];
                    if (cache) {
                        rowCount = 0;
                        cache.forEach(function (data) {
                            data = JSON.parse(data);
                            rowCount += data.length;
                            that.addData(controller, data);
                        });
                        resolve();
                    }
                    else {
                        if (loadMapKey === '_all')
                            dataLoadMap['_all'] = true;
                        loadFromServer = true;
                        if (externalFilter)
                            externalFilter.every(function (fv) {
                                var v = fv.Value;
                                if (typeof v == 'string') {
                                    if (v.match(/^%js%/))
                                        v = JSON.parse(v.substring(4));
                                    else
                                        v = parseInt(v);
                                }
                                //if (typeof v == 'number' && v < 0)
                                if (isTempPK(v))
                                    loadFromServer = false;
                                return loadFromServer;
                            });
                        if (loadFromServer)
                            loadPage(0);
                        else {
                            that.addData(controller, []);
                            if (!cache)
                                cache = masterCache[cacheKey] = [];
                            resolve();
                        }
                    }
                }
            }
            else
                resolve();

            return deferred.promise();
        },
        addData: function (controller, data) {
            var that = this,
                pk = _odp.controllers[controller].key,
                loadedKeys = that._dataLoadedKeys[controller],
                list = that._data[controller],
                all = (that._dataLoadMap[controller] || {})['_all'];

            if (all && !list)
                that._data[controller] = data;
            else {
                if (!loadedKeys)
                    loadedKeys = that._dataLoadedKeys[controller] = {};
                if (!list)
                    list = that._data[controller] = [];
                data.forEach(function (obj) {
                    var key = [];
                    pk.forEach(function (k) {
                        key.push(obj[k.name]);
                    });
                    key = key.join(',');
                    if (!loadedKeys[key]) {
                        loadedKeys[key] = true;
                        list.push(obj);
                    }
                });
            }
        },
        execute: function (options) {
            var that = this,
                method = options.method,
                methodArgs = options.params.data,//JSON.parse(htmlDecode(options.params.data)),
                request = methodArgs.request,
                controllerName = methodArgs.controller,
                config = _odp.controllers[controllerName],
                args = methodArgs.args || {},
                values = args.Values,
                commandName = args.CommandName,
                updating = commandName === 'Update',
                deleting = commandName === 'Delete',
                inserting = commandName === 'Insert',
                selectedValues = args.SelectedValues || [],
                isBatchEditOrDelete = args.LastCommandName === 'BatchEdit' && updating || deleting && selectedValues.length > 1,
                map = config._map,
                keyFilter = [], keyFilterParams = {}, keyFilterParamCount = 0, keyFilterTemplate,
                objects;

            function resolve(result) {
                options.deferred.resolve(jsonToData(result));
            }

            function reject(error) {
                var actionResult = ActionResult_new();
                actionResult.Errors = [error];
                resolve(actionResult);
            }

            function ensureReferentialIntegrity(objects) {
                var refIntegrityDeferred = $.Deferred(),
                    dataViewFields = [],
                    dataViewControllers = [];

                function resolveRefIntegrityTest() {
                    refIntegrityDeferred.resolve();
                }

                function testForChildren() {
                    var f = dataViewFields[0];
                    if (f) {
                        var dataViewConfig = f.dataView,
                            filterFields = dataViewConfig && dataViewConfig.filterFields,
                            testController,
                            testKeyFilter = [];
                        if (filterFields) {
                            dataViewFields.splice(0, 1);
                            objects.forEach(function (obj) {
                                testKeyFilter.push(obj[config.key[0].name]);
                            });
                            testController = dataViewConfig.controller;
                            _app.execute({
                                odp: that, background: true, controller: testController, pageSize: 1, _filter: [dataViewConfig.filterFields + ':$in$' + testKeyFilter.join('$or$')]
                            }).then(function (children) {
                                var totalRowCount = children.totalRowCount,
                                    testControllerConfig = _odp.controllers[testController];
                                if (totalRowCount) {
                                    that._log.splice(0, 1); // remove the pending delete from the log
                                    refIntegrityDeferred.reject(String.format(resourcesODP.UnableToDelete, f.label, totalRowCount));
                                }
                                else
                                    testForChildren();
                            });
                        }
                        else
                            resolveRefIntegrityTest();
                    }
                    else
                        resolveRefIntegrityTest();
                }

                if (deleting && objects.length && config.key.length === 1) {
                    config.fields.forEach(function (f) {
                        var dataViewConfig = f.dataView;
                        if (f.type === 'DataView' && dataViewConfig && !dataViewConfig.filterSource) {
                            dataViewFields.push(f);
                            dataViewControllers.push(dataViewConfig.controller);
                        }
                    });
                    if (dataViewControllers.length)
                        _odp.getControllers(dataViewControllers).then(testForChildren);
                    else
                        resolveRefIntegrityTest();
                }
                else
                    resolveRefIntegrityTest();
                return refIntegrityDeferred.promise();
            }

            function processManyToManyFields(objects) {
                // this method is execute when the parent JSON object was processed and the m2m value list is already persisted as a property value
                var deferred = $.Deferred(),
                    m2mDeferredList = [],
                    pendingRequests = [],
                    pkField = config.key[0].name,
                    log = that._log,
                    logLength = log.length,
                    commitRequest = log[deleting ? logLength - 1 : 0];

                function executePendingRequests(result) {
                    var errors = result && result.errors || [];
                    if (errors.length)
                        deferred.reject(errors);
                    else {
                        var request = pendingRequests[0];
                        if (request) {
                            pendingRequests.splice(0, 1);
                            request.odp = that;
                            request.background = true;
                            _app.execute(request).then(executePendingRequests);

                        }
                        else {
                            if (deleting && commitRequest && log.length !== logLength) {
                                if (log.indexOf(commitRequest) >= 0) {
                                    log.splice(logLength - 1, 1);
                                    log.push(commitRequest);
                                }
                            }
                            deferred.resolve();
                        }
                    }
                }

                config.fields.forEach(function (f) {
                    var items = f.items,
                        itemsTargetController = items && items.targetController,
                        itemsDataController,
                        m2mDeferred,
                        m2mFieldName = f.name,
                        m2m, m2mOldValue, m2mNewValue;

                    if (itemsTargetController) {
                        // find the field value and mark it as unmodified
                        values.every(function (fv) {
                            if (fv.Name === m2mFieldName)
                                m2m = fv;
                            return !m2m;
                        });
                        if (!m2m || m2m.Scope === 'client')
                            m2m = { Name: m2mFieldName };
                        else
                            m2m.Scope = 'client'; // prevent server-side processing of many-to-many field since dedicated log entries will be created on the client instead
                        m2mOldValue = m2m.OldValue;
                        if (inserting || updating)
                            m2mNewValue = m2m.Modified ? m2m.NewValue : m2m.OldValue;

                        // generate insert/update/delete requests for the target controller if the value of m2m field has changed
                        m2mOldValue = m2mOldValue == null ? [] : m2mOldValue.toString().split(/,/g);
                        m2mNewValue = m2mNewValue == null ? [] : m2mNewValue.toString().split(/,/g);
                        var m2mChanged = m2mOldValue.length !== m2mNewValue.length;
                        if (!m2mChanged)
                            m2mNewValue.every(function (v) {
                                if (m2mOldValue.indexOf(v) === -1)
                                    m2mChanged = true;
                                return !m2mChanged;
                            });
                        if (m2mChanged) {
                            m2mDeferred = $.Deferred();
                            m2mDeferredList.push(m2mDeferred.promise());
                            itemsDataController = items.dataController;
                            var field = { ItemsDataController: itemsDataController, ItemsTargetController: itemsTargetController, ItemsDataValueField: items.dataValueField };
                            _odp.getControllers([itemsDataController, itemsTargetController]).then(function (configList) {
                                var targetConfig = configList[1];
                                ViewPage_initializeManyToManyProperties(field, controllerName).then(function (m2mProps) {
                                    var pendingExecuteList = [],
                                        targetForeignKey1 = m2mProps.targetForeignKey1,
                                        targetForeignKey2 = m2mProps.targetForeignKey2;
                                    // iterate through "old" and "new" lists of values to create "delete" and "insert" requests for the target controller
                                    var insertRequestValues = [],
                                        insertFk2Filter = [],
                                        insertDeferred;
                                    objects.forEach(function (obj) {
                                        var pkValue = obj[pkField];
                                        if (deleting) {
                                            m2mOldValue = obj[m2mFieldName];
                                            m2mOldValue = m2mOldValue == null ? [] : m2mOldValue.toString().split(/,/g);
                                        }
                                        // delete unselected m2m items
                                        m2mOldValue.forEach(function (v) {
                                            if (m2mNewValue.indexOf(v) === -1)
                                                pendingRequests.push({
                                                    controller: itemsTargetController, command: 'Delete', LastCommandName: 'Select',
                                                    values: [
                                                        { Name: targetForeignKey1, OldValue: pkValue },
                                                        { Name: targetForeignKey2, OldValue: v },
                                                        { Name: '_SurrogatePK', OldValue: [m2mProps.targetForeignKey1, m2mProps.targetForeignKey2] }
                                                    ]
                                                });
                                        });
                                        // insert new selected m2m items
                                        m2mNewValue.forEach(function (v) {
                                            if (m2mOldValue.indexOf(v) === -1) {
                                                var insertValues = [
                                                    { Name: targetForeignKey1, Modified: true, NewValue: pkValue },
                                                    { Name: targetForeignKey2, Modified: true, NewValue: v }
                                                ];
                                                _odp.parseMap({ controller: itemsTargetController, field: targetForeignKey1 }, function (toField, fromField) {
                                                    var fv = { Name: toField, NewValue: obj[fromField] },
                                                        targetToField = targetConfig._map.fields[toField];
                                                    if (targetToField && targetToField.readOnly)
                                                        fv.ReadOnly = true;
                                                    insertValues.push(fv);
                                                });

                                                insertRequestValues.push(insertValues);
                                                insertFk2Filter.push(v);
                                            }
                                        });
                                    });
                                    if (insertRequestValues.length) {
                                        // resolve the borrowed field values of the second foreign key 
                                        insertDeferred = $.Deferred();
                                        pendingExecuteList.push(insertDeferred.promise());
                                        _app.execute({ odp: that, controller: itemsDataController, _filter: [targetForeignKey2 + ':$in$' + insertFk2Filter.join('$or$')] }).then(function (fk2Data) {
                                            var dataMap = {};
                                            fk2Data[itemsDataController].forEach(function (obj) {
                                                dataMap[obj[targetForeignKey2]] = obj;
                                            });
                                            insertRequestValues.forEach(function (insertValues) {
                                                var obj = dataMap[insertValues[1].NewValue];
                                                _odp.parseMap({ controller: itemsTargetController, field: targetForeignKey2 }, function (toField, fromField) {
                                                    var fv = { Name: toField, NewValue: obj[fromField] },
                                                        targetToField = targetConfig._map.fields[toField];
                                                    if (targetToField && targetToField.readOnly)
                                                        fv.ReadOnly = true;
                                                    insertValues.push(fv);
                                                });
                                                // insert the complete set of field values
                                                pendingRequests.push({ controller: itemsTargetController, command: 'Insert', LastCommandName: 'New', values: insertValues });
                                            });
                                            insertDeferred.resolve();
                                        });
                                    }
                                    // wait for "execute" calls to complete
                                    $.when.apply($, pendingExecuteList).then(function () {
                                        m2mDeferred.resolve();
                                    });
                                });
                            });
                        }
                    }
                });
                $.when.apply($, m2mDeferredList).then(executePendingRequests);
                return deferred.promise();
            }

            that._borrowData(controllerName);

            if (method === 'Execute') {
                var actionResult = ActionResult_new(),
                    filterFields = [];
                // force Offline Sync to reload the data files
                if (updating || deleting || inserting)
                    _odp.offline('forget', { controller: controllerName });
                // translate values into filter expression
                if (updating || deleting) {
                    values.every(function (fv) {
                        var name = fv.Name;
                        if (map.key[name])
                            filterFields.push(name);
                        else if (name === '_SurrogatePK')
                            filterFields = fv.OldValue;
                        return filterFields.length < config.key.length;
                    });
                    // there is no need for conflict detection - use the fields listed in filterFields variable
                    values.forEach(function (fv) {
                        var name = fv.Name;
                        if (filterFields.indexOf(name) >= 0) {
                            if (keyFilter.length)
                                keyFilter.push('&&');
                            keyFilter.push('(this.' + name + '==params.p' + keyFilterParamCount + ')'); // use == to compare since selected values are passed as an array of strings
                            keyFilterParams['p' + keyFilterParamCount++] = fv.OldValue;
                        }
                    });
                    // extend keyFilter with more expressions if we are batch editing or deleting
                    if (isBatchEditOrDelete) {
                        keyFilterTemplate = keyFilter.join('');
                        keyFilter = [];
                        selectedValues.forEach(function (key, index) {
                            var paramPrefix = String.format('{0:d4}', index);
                            if (keyFilter.length)
                                keyFilter.push('||');
                            keyFilter.push(keyFilterTemplate.replace(/(==params\.p)(\d+)/g, '$1' + paramPrefix + '$2'));
                            key = key.split(/,/g).forEach(function (v, index) {
                                keyFilterParams['p' + paramPrefix + index] = v;
                            });
                        });
                    }
                    // select records matching the key filter and process them as needed
                    that.select({
                        from: controllerName,
                        where: { filter: keyFilter.join(''), params: keyFilterParams },
                        limit: deleting || isBatchEditOrDelete ? Number.MAX_VALUE : 1
                    }).done(function (result) {
                        ensureReferentialIntegrity(result).then(function () {
                            processManyToManyFields(result).then(function () {
                                // process values and update the item for "Update" command
                                var resultLength = result.length;
                                actionResult.RowsAffected = resultLength;
                                actionResult.RowNotFound = !resultLength;
                                if (resultLength)
                                    if (updating) {
                                        result.forEach(function (obj) {
                                            values.forEach(function (fv) {
                                                if (fv.Modified)
                                                    obj[fv.Name] = fv.NewValue;
                                                else if (fv.ReadOnly)
                                                    obj[fv.Name] = fv.OldValue;
                                            });
                                        });
                                        resolve(actionResult);
                                    }
                                    else // deleting
                                        that.select({
                                            from: controllerName,
                                            where: { filter: keyFilter.join(''), params: keyFilterParams },
                                            limit: Number.MAX_VALUE,
                                            remove: deleting
                                        }).done(function (result) {
                                            resolve(actionResult);
                                        }).fail(reject);
                                else
                                    resolve(actionResult); // nothing was found - simulate success
                            }).fail(reject);
                        }).fail(reject);

                    }).fail(function (error) {
                        // Remove the last logged action if we are executing an invoke via ODP.
                        // Commit command is undone via odp.snapshot('restore') call.
                        if (options.dataView)
                            that._log.splice(that._log.length - 1);
                        // Resolve the action instead of rejecting. Otherwise 
                        reject(error);
                    });
                }
                else if (inserting) {
                    // insert a new row but check for duplicates
                    var newObj = {},
                        statusField = map.fields['Status'];
                    objects = that._data[controllerName];
                    values.forEach(function (fv) {
                        if (fv.Name !== 'Status' || statusField)
                            newObj[fv.Name] = fv.NewValue;
                    });
                    if (!objects)
                        objects = that._data[controllerName] = [];
                    objects.push(newObj);
                    actionResult.RowsAffected = 1;
                    for (var pkName in map.key)
                        if (newObj[pkName] == null) {
                            // generate a new primary key and alter the log
                            var pkValue = _odp.pk(controllerName, map.key[pkName].type),
                                keyFieldValue;
                            newObj[pkName] = pkValue;
                            actionResult.Values.push({ Name: pkName, NewValue: pkValue, Modified: true });
                            values.every(function (fv) {
                                if (fv.Name === pkName) {
                                    fv.NewValue = pkValue;
                                    fv.Modified = true;
                                    keyFieldValue = fv;
                                }
                                return !keyFieldValue;
                            });
                            if (!keyFieldValue)
                                values.push({ Name: pkName, NewValue: pkValue, Modified: true });
                            break;
                        }
                    processManyToManyFields([newObj]).then(function () {
                        resolve(actionResult);
                    }).fail(reject);
                }
                else if (commandName === 'Calculate')
                    if (config.calculateOnServer && canCallServer()) {
                        keyFilterParams = options.params;
                        keyFilterParams.data = _app.toAjaxData(keyFilterParams.data);
                        keyFilterParams.processData = false;
                        $.ajax(keyFilterParams).done(function (result) {
                            actionResult = JSON.parse(result).d;
                            resolve(actionResult);
                        }).fail(function (jqXHR, textStatus, error) {
                            resolve(actionResult);
                        });
                    }
                    else
                        resolve(actionResult);
                else if (commandName === 'PopulateDynamicLookups') {
                    var populateLookupsRequest = {
                        Controller: controllerName,
                        View: methodArgs.view,
                        RequiresMetaData: true,
                        MetadataFilter: ['items', 'fields']
                    };
                    that._viewPage(populateLookupsRequest, { contextValues: args.Values }).done(function (page) {
                        page.Fields.forEach(function (field) {
                            if (field.ContextFields && DataField_supportsStaticItems.call(field))
                                actionResult.Values.push({ Name: field.Name, NewValue: field.Items });
                        });
                        resolve(actionResult);
                    });
                }
                else
                    _app.alert('Unsupported command ' + commandName, function () {
                        resolve(actionResult);
                    });
            }
            else if (method === 'GetPage') {
                var pageRequest = request;
                pageRequest.Controller = controllerName;
                pageRequest.View = methodArgs.view;
                that._viewPage(pageRequest).done(function (page) {
                    delete page._fieldMap;
                    delete page._metadataFilter;
                    resolve(page);
                });
            }
            else if (method === 'GetListOfValues') {
                var getListOfValuesRequest = request;
                getListOfValuesRequest.Controller = controllerName;
                getListOfValuesRequest.View = methodArgs.view;
                getListOfValuesRequest.Distinct = true;
                getListOfValuesRequest.PageSize = Number.MAX_VALUE;
                getListOfValuesRequest.PageIndex = 0;
                var distinctValueFieldName = getListOfValuesRequest.FieldName;
                getListOfValuesRequest.FieldFilter = [distinctValueFieldName];
                getListOfValuesRequest.MetadataFilter = ['fields'];
                getListOfValuesRequest.DoesNotRequireAggregates = true;
                getListOfValuesRequest.SortExpression = distinctValueFieldName;
                that._viewPage(getListOfValuesRequest).done(function (page) {
                    var listOfValues = [];
                    page.Rows.every(function (r) {
                        listOfValues.push(r[0]);
                        return listOfValues.length < 1000;
                    });
                    resolve(listOfValues);
                });
            }
            else
                _app.alert('Unknown method: ' + method);
        },
        select: function (options) {
            var that = this,
                deferred = $.Deferred(),
                from = options.from,
                where = options.where,
                removing = options.remove,
                filter = where ? where.filter : null,
                sort = options.sort,
                objects = typeof from == 'string' ? that._data[from] || [] : from,
                result = [], toRemove = [],
                indexes = options.index ? [] : null,
                filterFunc;

            function resolve() {
                deferred.resolve(result, indexes);
            }

            if (options.yield)
                result = options.yield;
            else {
                // filter
                if (filter) {
                    filterFunc = _odp.func('(params,rowIndex){return ' + filter + '}');
                    for (var i = 0; i < objects.length; i++) {
                        var obj = objects[i];
                        if (filterFunc.call(obj, where.params, i + 1)) {
                            result.push(obj);
                            if (indexes)
                                indexes.push(i + 1);
                            if (removing)
                                toRemove.push(i);
                            if (options.limit === result.length)
                                break;
                        }
                    }
                    if (toRemove.length)
                        for (i = toRemove.length - 1; i >= 0; i--)
                            objects.splice(toRemove[i], 1);
                }
                else
                    result = objects.slice(0);
                // sort
                if (sort)
                    result.sort(_odp.func(that._sortFunc(sort)));
            }
            // complete
            resolve();

            return deferred.promise();
        },
        key: function (dataView) {
            var key = [],
                controller = dataView._controller,
                row = dataView.inserting() ? dataView._newRow : dataView._rows[0];
            if (row) {
                dataView._keyFields.forEach(function (pkField) {
                    var fieldType = pkField.Type,
                        fieldIndex = pkField.Index,
                        isGuid = fieldType === 'Guid' || pkField.Len === 36;
                    if (fieldType !== 'String' || isGuid) {
                        var pkValue = row[fieldIndex];
                        if (pkValue == null && (pkField.isReadOnly() || isGuid))
                            row[fieldIndex] = _odp.pk(controller, fieldType);
                    }
                    key.push(row[pkField.Index]);
                });
            }
            return key;
        },
        _sortFunc: function (sort) {
            var func = ['(a,b){'],
                iterator = /(\w+)(\s+(asc|desc))?/ig,
                m = iterator.exec(sort), first = true;
            func.push('var result=0;');
            while (m) {
                if (first)
                    first = false;
                else
                    func.push('if (result != 0) return result;');
                func.push(String.format('result = ($app.odp.compare(a.{0},b.{0}))', m[1]));
                if (m[3] && m[3].match(/^desc/i))
                    func.push('if (result != 0) result *=-1;');
                m = iterator.exec(sort);
            }
            func.push('return result;');
            func.push('}');
            return func.join('\n');
        },
        //_filterFunc: function (filter) {
        //    var func = ['(function(a,b){'];
        //    func.push('})');
        //    func = func.join('\n');
        //    return func;
        //},
        _viewPage: function (request, options) {
            var odp = this,
                page = {}, pageDeferred = $.Deferred(),
                controller = request.Controller,
                config,
                viewId = request.View,
                view;

            function selectView() {
                config = _odp.controllers[controller];
                if (viewId)
                    view = config._map.views[viewId];
                else {
                    view = config.views[0];
                    viewId = request.View = view.id;
                }
            }

            function PageRequest_assignContext(view) {
                var that = this;
                if (that.PageSize === 1000 && !that.SortExpression)
                    // we are processing a request to retreive static lookup data
                    that.SortExpression = view.sortExpression;
            }

            //function ViewPage_resetSkipCount(preFetch) {
            //    var that = this;
            //    that._readCount = Number.MAX_VALUE;
            //    that._skipCount = 0;
            //    if (preFetch) {
            //        that._skipCount = (that.PageIndex - 1) * that.PageSize;
            //        that._readCount = that._readCount * 3;
            //        if (that._skipCount < 0) {
            //            that._skipCount = 0;
            //            that._readCount = that._readCount * that._pageSize;
            //        }
            //    }
            //    else
            //        that._skipCount = that.PageIndex * that.PageSize;
            //}

            function ViewPage_new(request) {
                var that = this;
                that.Tag = request.Tag;
                that.DistinctValueFieldName = request.FieldName;
                that.PageOffset = request.PageOffset || 0;
                that.RequiresMetaData = request.PageIndex === -1 || request.RequiresMetaData;
                that.RequiresRowCount = request.PageIndex < 0 || request.RequiresRowCount;
                that.PageIndex = 0;
                if (request.PageIndex === -2)
                    request.PageIndex = 0;
                that.PageSize = request.PageSize;
                if (request.RequiresPivot) {
                    that.RequiresPivot = true;
                    that.RequiresMetaData = false;
                    that.RequiresRowCount = false;
                    that.PageSize = Number.MAX_VALUE;
                    // assign pivot definitions
                }
                if (request.PageIndex > 0)
                    that.PageIndex = request.PageIndex;
                that.Rows = [];
                that.Fields = [];
                //ViewPage_resetSkipCount.call(that, false)
                //that._readCount = that.PageSize;
                that.SortExpression = request.SortExpression;
                that.GroupExpression = request.GroupExpression;
                that.Filter = request.Filter;
                that.SystemFilter = request.SystemFilter;
                that.TotalRowCount = -1;
                that.Views = [];
                that.ActionGroups = [];
                that.Categories = [];
                that.Controller = request.Controller;
                that.View = request.View;
                that.LastView = request.LastView;
                that.ViewType = request.ViewType;
                that.SupportsCaching = request.SupportsCaching;
                that.QuickFindHint = request.QuickFindHint;
                that.InnerJoinPrimaryKey = request.InnerJoinPrimaryKey;
                that.InnerJoinForeignKey = request.InnerJoinForeignKey;
                that.RequiresSiteContentText = request.RequiresSiteContentText;
                //that._disableJSONCompatibility = request.DisableJSONCompatibility;
                that.FieldFilter = request.FieldFilter;
                //that._requestedFieldFilter = request.FieldFilter;
                that._metadataFilter = request.MetadataFilter;
                that.Distinct = request.Distinct;
                var staticLookupViewTypeFilter = 'Form',
                    tag = request.Tag;
                if (tag && tag.match(/\bview\-type\-inline\-editor\b/))
                    staticLookupViewTypeFilter = 'Grid';
                that._staticLookupViewTypeFilter = staticLookupViewTypeFilter;
            }

            function ViewPage_includeMetadata(name) {
                var metadataFilter = this._metadataFilter;
                return metadataFilter == null || metadataFilter.indexOf(name) !== -1;
            }

            function ViewPage_enumerateSyncFields() {
                var page = this,
                    keyFields = [];
                if (!page.Distinct)
                    page.Fields.forEach(function (df) {
                        if (df.IsPrimaryKey)
                            keyFields.push(df);
                    });
                return keyFields;
            }

            function ControllerConfiguration_AssignDynamicExpressions(page) {
                var expressions = page.Expressions = [];
                if (ViewPage_includeMetadata.call(page, 'expressions')) {
                    // TODO - enumerate a list of expressions
                    config.expressions.forEach(function (de) {
                        if (de.ViewId == null || de.ViewId === page.View)
                            expressions.push(de);
                    });
                }
            }

            function DataField_IsMatchedByName(sample) {
                var that = this,
                    headerText = that.HeaderText || that.Label || that.Name;
                headerText = headerText.replace(/\s/g, '');
                sample = new RegExp('^' + RegExp.escape(sample.replace(/\s/g, '')), 'i');
                return headerText.match(sample);

            }

            function populatePageCategories(page) {
                var categories = view.categories || [];
                categories.forEach(function (c, index) {
                    page.Categories.push({
                        Id: c.id,
                        Index: index,
                        HeaderText: c.headerText,
                        Description: c.description ? c.description['@value'] : null,
                        Tab: c.tab,
                        Wizard: c.wizard,
                        Flow: c.flow,
                        Wrap: c.wrap === true,
                        Floating: c.floating === true,
                        Collapsed: c.collpased === true
                    });
                });
                if (!categories.length)
                    page.Categories.push({ Id: null, Index: 0 });
            }

            function appendDeepFilter(hint, page, sb, deepFilterExpression) {
                // TBD
            }

            function stringToValue(s) {
                var v = s,
                    values, isArray;
                if (s != null) {
                    if (typeof s === 'string') {
                        values = s.split(/(?:\$(?:and|or)\$)/g);
                        isArray = values.length > 1;
                    }
                    else
                        values = [s];
                    for (var i = 0; i < values.length; i++) {
                        s = values[i];
                        if (s != null && s.match(/^%js%/))
                            values[i] = s.length > 4 ? JSON.parse(s.substring(4)) : null;
                    }
                    v = isArray ? values : values[0];
                }
                return v;
            }

            function stringIsNull(s) {
                return s === 'null' || s === '%js%null';
            }

            function toWhere(request, page) {
                var params = {}, paramCount = 0,
                    quickFindHint = page.QuickFindHint,
                    firstCriteria = true,
                    matchListCount = 0,
                    firstDoNotMatch = true,
                    logicalConcat = '&&',
                    useExclusiveQuickFind = false,
                    pageFilter = page.Filter,
                    sb = [];
                page.Fields.every(function (df) {
                    var searchOptions = df.SearchOptions;
                    if (searchOptions && searchOptions.match(/\$quickfind(?!disabled)/)) {
                        useExclusiveQuickFind = true;
                        return false;
                    }
                });
                if (pageFilter)
                    pageFilter.forEach(function (filterExpression) {
                        // test matching mode
                        var matchingMode = filterExpression.match(matchingModeRegex);
                        if (matchingMode) {
                            var doNotMatch = matchingMode[1] === '_donotmatch_';
                            if (doNotMatch) {
                                if (firstDoNotMatch) {
                                    firstDoNotMatch = false;
                                    if (!firstCriteria)
                                        sb.push(')\n');
                                    if (matchListCount > 0)
                                        sb.push(')\n');
                                    if (!firstCriteria || matchListCount > 0)
                                        sb.push('&&\n'); // and
                                    matchListCount = 0;
                                    sb.push(' !\n'); // not
                                    firstCriteria = true;
                                }
                            }
                            if (!matchListCount) {
                                if (!firstCriteria)
                                    sb.push(') &&\n'); // and
                                sb.push('(\n');
                            }
                            else {
                                sb.push(')\n');
                                sb.push('||\n'); // or
                            }
                            // begin a list of conditions for the next match
                            if (matchingMode[2] === '$all$')
                                logicalConcat = ' && '; // and
                            else
                                logicalConcat = ' || '; // or
                            matchListCount++;
                            firstCriteria = true;
                        }
                        // test filter expression
                        var filterMatch = filterExpression.match(filterExpressionRegex);
                        if (filterMatch) {
                            var firstValue = true;
                            var fieldOperator = ' || '; // or
                            if (filterMatch[2].match(/>\|</))
                                fieldOperator = ' && '; // and
                            var valueMatch = filterMatch[2].match(filterValueRegex);
                            if (valueMatch) {
                                var alias = filterMatch[1],
                                    operation = valueMatch[1],
                                    paramValue = valueMatch[3];
                                if (operation === '~' && alias === '_quickfind_')
                                    alias = page.Fields[0].Name;
                                var deepSearching = alias.match(/,/);
                                var field = page._fieldMap[alias];
                                if ((field != null && field.AllowQBE !== false || operation === "~") && (page.DistinctValueFieldName !== field.Name || matchListCount > 0 || operation === "~" || page.AllowDistinctFieldInFilter /*|| page.CustomFilteredBy(field.Name)*/) || deepSearching) {
                                    if (firstValue) {
                                        if (firstCriteria) {
                                            sb.push('(\n');
                                            firstCriteria = false;
                                        }
                                        else
                                            sb.push(logicalConcat);
                                        sb.push('(');
                                        firstValue = false;
                                    }
                                    else
                                        sb.push(fieldOperator);
                                    if (deepSearching) {
                                        var deepSearchFireldName = alias.substring(0, alias.indexOf(','));
                                        var hint = alias.substring(deepSearchFireldName.length + 1);
                                        var deepFilterExpression = deepSearchFireldName + filterExpression.indexOf(':');
                                        appendDeepFilter(hint, page, sb, deepFilterExpression);
                                    }
                                    else if (operation === '~') {
                                        paramValue = stringToValue(paramValue);
                                        var words = [];
                                        var phrases = [words];
                                        var removableNumericCharactersRegex = new RegExp(RegExp.escape(numberFormat.NumberGroupSeparator + numberFormat.CurrencyGroupSeparator + numberFormat.CurrencySymbol), 'gi');
                                        var textDateNumber = /*'\\p{L}\\d'*/ Unicode.w + RegExp.escape(dateTimeFormat.DateSeparator + dateTimeFormat.TimeSeparator + numberFormat.NumberDecimalSeparator);
                                        // (Token((Quote)(Value))|((Quote)(Value)|(())|(Value))
                                        //    1       3     4         6       7          10
                                        // Token (1), Quote (3, 6), Value (4, 7, 10)
                                        var quickFindRegex = new RegExp("\\s*(((\")(.+?)\")|((\\\')(.+?)\\\')|(,|;|(^|\\s+)-)|([" + textDateNumber + "]+))", 'gi');
                                        var m = quickFindRegex.exec(paramValue);
                                        var negativeSample = false;
                                        while (m) {
                                            var token = m[1].trim();
                                            if (token === ',' || token === ';') {
                                                words = [];
                                                phrases.push(words);
                                                negativeSample = false;
                                            }
                                            else
                                                if (token === '-')
                                                    negativeSample = true;
                                                else {
                                                    var exactFlag = '=';
                                                    if (!(m[3] || m[6]))
                                                        exactFlag = ' ';
                                                    var negativeFlag = ' ';
                                                    if (negativeSample) {
                                                        negativeFlag = '-';
                                                        negativeSample = false;
                                                    }
                                                    var value = m[4];
                                                    if (value == null)
                                                        value = m[7];
                                                    if (value == null)
                                                        value = m[10];
                                                    words.push(negativeFlag + exactFlag + value);
                                                }
                                            m = quickFindRegex.exec(paramValue);
                                        }
                                        var firstPhrase = true;
                                        phrases.forEach(function (phrase) {
                                            if (firstPhrase)
                                                firstPhrase = false;
                                            else
                                                sb.push('||\n'); // or
                                            sb.push('(\n');
                                            var firstWord = true;
                                            phrase.forEach(function (paramValueWord) {
                                                var negativeFlag = paramValueWord.charAt(0) === '-';
                                                var exactFlag = paramValueWord.charAt(1) === '=';
                                                var comparisonOperator = 'like';
                                                if (exactFlag)
                                                    comparisonOperator = '=';
                                                var pv = paramValueWord.substring(2);
                                                var fieldNameFilter;
                                                var complexParam = pv.match(/^(.+)\:(.+)$/);
                                                if (complexParam) {
                                                    fieldNameFilter = complexParam[1];
                                                    var fieldIsMatched = false;
                                                    page.Fields.every(function (tf) {
                                                        if (tf.AllowQBE !== false && !tf.AliasName || !(tf.IsPrimaryKey && tf.Hidden && DataField_IsMatchedByName.call(tf))) {
                                                            fieldIsMatched = true;
                                                            return;
                                                        }
                                                    });
                                                    if (fieldIsMatched)
                                                        pv = complexParam[2];
                                                    else
                                                        fieldNameFilter = null;
                                                }
                                                var paramValueAsDate = Date.tryParseFuzzyDate(pv);
                                                var paramValueIsDate = paramValueAsDate != null;
                                                var firstTry = true;
                                                var parameter;
                                                var paramValueAsNumber;
                                                var testNumber = pv;
                                                testNumber = testNumber.replace(removableNumericCharactersRegex, '');
                                                paramValueAsNumber = parseFloat(testNumber);
                                                var paramValueIsNumber = !isNaN(paramValueAsNumber);
                                                if (!exactFlag && !pv.match(/%/))
                                                    pv = '%' + pv + '%';
                                                if (firstWord)
                                                    firstWord = false;
                                                else
                                                    sb.push('&&'); // and
                                                if (negativeFlag)
                                                    sb.push('!'); // not
                                                sb.push('(');
                                                var hasTests = false;
                                                var originalParameter;
                                                if (!quickFindHint || !quickFindHint.match(/^;/))
                                                    page.Fields.forEach(function (tf) {
                                                        var searchOptions = tf.SearchOptions;
                                                        if (tf.AllowQBE !== false && !tf.AliasName && !(tf.IsPrimaryKey && tf.Hidden && (!tf.Type.match(/^Date/) || paramValueIsDate))) {
                                                            if (!fieldNameFilter || DataField_IsMatchedByName.call(tf, fieldNameFilter))
                                                                if (!useExclusiveQuickFind && !searchOptions || !searchOptions.match(/\$quickfinddisabled/) || useExclusiveQuickFind && !searchOptions && searchOptions.match(/\$quickfind/)) {
                                                                    hasTests = true;
                                                                    if (!parameter) {
                                                                        parameter = 'p' + paramCount++;
                                                                        params[parameter] = pv;
                                                                    }
                                                                    if (exactFlag && paramValueIsNumber)
                                                                        params[parameter] = paramValueAsNumber;
                                                                    if (!(exactFlag && (!tf.Type.match(/String/) && !paramValueIsNumber || tf.Type.match(/String/) && paramValueIsNumber))) {
                                                                        if (firstTry)
                                                                            firstTry = false;
                                                                        else
                                                                            sb.push('||'); // or
                                                                        if (tf.Type.match(/^Date/)) {
                                                                            var dateParameter = 'p' + paramCount++;
                                                                            params[dateParameter] = _app.stringifyDate(paramValueAsDate);
                                                                            if (negativeFlag)
                                                                                sb.push('(', tf.Name, ' != null)&&');
                                                                            sb.push('$app.odp.filters._eq(this.', tf.Name, ',', 'params.', dateParameter, ',"', tf.Type, '")');
                                                                        }
                                                                        else {
                                                                            var skipLike = false;
                                                                            if (comparisonOperator !== '=' && tf.Type === 'String' && tf.Len > 0 && tf.Len < pv.length) {
                                                                                var pv2 = pv;
                                                                                pv2 = pv2.substring(1);
                                                                                if (tf.Len < pv2.length)
                                                                                    pv2 = pv2.substring(0, pv2.length - 1);
                                                                                if (pv2.length > tf.Len)
                                                                                    skipLike = true;
                                                                                else {
                                                                                    originalParameter = parameter;
                                                                                    parameter = 'p' + paramCount++;
                                                                                    params[parameter] = pv2;
                                                                                }
                                                                            }
                                                                            if (negativeFlag)
                                                                                sb.push('(this.', tf.Name, '!= null)&&');
                                                                            if (comparisonOperator === '=')
                                                                                sb.push('$app.odp.filters._eq(this.', tf.Name, ',', 'params.', parameter, ',"', tf.Type, '")');
                                                                            else
                                                                                sb.push('$app.odp.filters._like(this.', tf.Name, ',', 'params.', parameter, ',"', tf.Type, '")');
                                                                        }
                                                                        if (originalParameter)
                                                                            parameter = originalParameter;
                                                                    }
                                                                }
                                                        }
                                                    });
                                                if (quickFindHint && quickFindHint.match(/\;/)) {
                                                    // inject deep filter here
                                                }
                                                if (!hasTests)
                                                    if (negativeFlag && quickFindHint.match(/^\;/))
                                                        sb.push('1==1');
                                                    else
                                                        sb.push('1==0');
                                                sb.push(')\n');
                                            });
                                            sb.push(')\n');
                                        });
                                        if (firstPhrase)
                                            sb.push('1==1');
                                    }
                                    else
                                        if (operation.match(/^$/)) {
                                            var parameter = 'p' + paramCount++;
                                            paramValue = stringToValue(paramValue);
                                            params[parameter] = paramValue;
                                            sb.push('($app.odp.filters.', operation.substring(operation.length - 1), '(this.', alias, ',params.', parameter, ')');
                                        }
                                        else {
                                            parameter = 'p' + paramCount++;
                                            params[parameter] = stringToValue(paramValue);
                                            var requiresRangeAdjustment = operation === '=' && field.Type.match(/^DateTime/) && paramValue;
                                            if (operation === '<>' & stringIsNull(paramValue))
                                                sb.push('this.', alias, ' != null');
                                            else
                                                if (operation === '=' && stringIsNull(paramValue))
                                                    sb.push('this.', alias, ' == null');
                                                else {
                                                    var filterFunc = operation;
                                                    if (operation === '*')
                                                        filterFunc = '_like';
                                                    else if (requiresRangeAdjustment)
                                                        filterFunc = '_inrange';
                                                    else if (operation === '<>')
                                                        operation = '!=';
                                                    else if (operation === '=')
                                                        operation = '==';
                                                    if (filterFunc.match(/\$/))
                                                        filterFunc = filterFunc.substring(1, filterFunc.length - 1);
                                                    if (filterFunc in _odp.filters)
                                                        sb.push('$app.odp.filters.', filterFunc, '(this.', alias, ',params.', parameter, ')');
                                                    else
                                                        sb.push('this.', alias, operation + 'params.', parameter);
                                                }
                                        }
                                }
                            }
                        }
                        if (!firstValue)
                            sb.push(')\n');
                    });
                if (matchListCount) {
                    sb.push(')\n');
                    // the end of the match list
                    sb.push(')\n');
                    firstCriteria = true;
                }
                if (!firstCriteria)
                    sb.push(')\n');

                return { filter: sb.join(''), params: params };
            }

            function toSort(page) {
                var sort = page.SortExpression || '';
                var keyFields = ViewPage_enumerateSyncFields.call(page);
                keyFields.forEach(function (f) {
                    if (f.IsPrimaryKey) {
                        if (sort.length)
                            sort += ',';
                        sort += f.Name;
                    }
                });
                return sort;
            }

            function syncRequestedPage(request, page) {
                var deferred = $.Deferred();
                if (request.SyncKey == null || !request.SyncKey.length || page.PageSize < 0) {
                    deferred.resolve(page);
                    return deferred.promise();
                }
                configureCommand(page);
                var keyFields = ViewPage_enumerateSyncFields.call(page);
                if (keyFields.length === request.SyncKey.length) {
                    var keyFilter = [],
                        params = {}, paramCount = 0;
                    keyFields.forEach(function (df, index) {
                        if (keyFilter.length)
                            keyFilter.push('&&');
                        keyFilter.push('(this.' + df.Name + '==params.p' + paramCount + ')');
                        params['p' + paramCount++] = request.SyncKey[index];
                    });

                    odp.select({ from: page.Controller, where: toWhere(request, page), sort: toSort(page) }).done(function (sortedAndFilteredObjects) {
                        odp.select({ from: sortedAndFilteredObjects, where: { filter: keyFilter.join(''), params: params }, index: true, limit: 1 }).done(function (objects, indexes) {
                            if (objects.length) {
                                page.PageIndex = Math.floor((indexes[0] - 1) / page.PageSize);
                                page.PageOffset = 0;
                            }
                            deferred.resolve(page, sortedAndFilteredObjects);
                        });
                    });
                }
                else
                    deferred.resolve(page);
                return deferred.promise();
            }

            function configureCommand(page) {
                populatePageFields(page);
                ensurePageFields(page);
                if (!page.SortExpression)
                    page.SortExpression = view.sortExpression;
            }


            function DataField_new(f, hidden) {
                var field = { Name: f.name, Type: f.type };
                if (hidden)
                    field.Hidden = hidden === true;
                if (f.length != null)
                    field.Len = f.length;
                if (f.label)
                    field.Label = f.label;
                if (f.isPrimaryKey != null)
                    field.IsPrimaryKey = f.isPrimaryKey === true;
                if (f.readOnly != null)
                    field.ReadOnly = f.readOnly === true;
                if (f.onDemand != null)
                    field.OnDemand = f.onDemand === true;
                if (f.default != null)
                    field.HasDefaultValue = true; // do not output the actual value
                if (f.allowNulls !== false)
                    field.AllowNulls = true;
                if (f.hidden != null)
                    field.Hidden = f.hidden === true;
                if (f.allowQBE != null)
                    field.AllowQBE = f.allowQBE !== false;
                if (f.allowLEV != null)
                    field.AllowLEV = f.allowLEV === true;
                if (f.allowSorting != null)
                    field.AllowSorting = f.allowSorting !== false;
                if (f.sourceFields != null)
                    field.SourceFields = f.sourceFields;
                if (f.onDemandStyle)
                    field.OnDemandStyle = OnDemandDisplayStyle.indexOf(f.onDemandStyle);
                if (f.onDemandHandler)
                    field.OnDemandHandler = f.onDemandHandler;
                if (f.contextFields)
                    field.ContextFields = f.contextFields;
                // skip selectExpression
                // skip computed 
                // skip formula
                if (f.showInSummary != null)
                    field.ShowInSummary = f.showInSummary;
                if (f.htmlEncode != null)
                    field.htmlEncode = f.htmlEncode !== false;
                if (f.calculated != null)
                    field.Calculated = f.calculated;
                if (f.causesCalculate != null)
                    field.CausesCalculate = f.causesCalculate === true;
                if (f.isVirtual != null)
                    field.IsVirtual = f.isVirtual === true;
                if (f.configuration)
                    field.Configuration = f.configuration['@value'];
                if (f.dataFormatString)
                    field.DataFormatString = f.dataFormatString;
                if (f.formatOnClient != null)
                    field.FormatOnClient = f.formatOnClient === true;
                // skip editor
                var items = f.items;
                if (items) {
                    if (items.dataController)
                        field.ItemsDataController = items.dataController;
                    if (items.targetController)
                        field.ItemsTargetController = items.targetController;
                }
                var dataView = f.dataView;
                if (dataView) {
                    field.DataViewController = dataView.controller;
                    field.DataViewId = dataView.view;
                    field.DataViewFilterFields = dataView.filterFields;
                    field.DataViewFilterSource = dataView.filterSource;
                    field.AllowQBE = true;
                    field.AllowSorting = true;
                    field.Len = 0;
                    field.Columns = 0;
                    field.HtmlEncode = true;
                }
                return field;
            }

            function populatePageFields(page) {
                if (page.Fields.length) return;
                // enumerate data fields in the view
                var dataFields = view.dataFields,
                    categoryMap = {};
                if (view.categories && view.categories.length) {
                    dataFields = [];
                    (view.categories || []).forEach(function (c, categoryIndex) {
                        (c.dataFields || []).forEach(function (df) {
                            dataFields.push(df);
                            categoryMap[df.fieldName] = categoryIndex;
                        });
                    });
                }
                if (!dataFields)
                    dataFields = [];
                // create DataField instances
                dataFields.forEach(function (df) {
                    var f = config._map.fields[df.fieldName],
                        field;
                    if (f) {
                        field = DataField_new(f);
                        if (df.hidden != null)
                            field.Hidden = df.hidden === true;
                        if (df.dataFormatString != null)
                            field.DataFormatString = df.dataFormatString;
                        if (df.formatOnClient != null)
                            field.FormatOnClient = df.formatOnClient !== false;
                        if (df.dataFormatString && !field.DataFormatString)
                            field.DataFormatString = dt.dataFormatString;
                        if (df.headerText)
                            field.HeaderText = df.headerText['@value'];
                        if (df.footerText)
                            field.FooterText = df.footerText['@value'];
                        if (df.toolTip)
                            field.toolTip = df.toolTip;
                        if (df.watermark)
                            field.Watermark = df.watermark;
                        if (df.hyperlinkFormatString)
                            field.HyperlinkFormatString = df.hyperlinkFormatString;
                        if (df.aliasFieldName)
                            field.AliasName = df.aliasFieldName;
                        if (df.tag)
                            field.Tag = df.tag;
                        if (df.AllowQBE != null)
                            field.AllowQBE = df.allowQBE === true;
                        if (df.AllowSorting != null)
                            field.AllowSorting = df.allowSorting === true;
                        if (categoryMap[field.Name] != null)
                            field.CategoryIndex = categoryMap[field.Name];
                        if (df.columns != null)
                            field.Columns = df.columns;
                        if (df.rows != null)
                            field.Rows = df.rows;
                        if (df.textMode != null)
                            field.TextMode = TextInputMode.indexOf(df.textMode);
                        // skip Mask
                        // skip MaskType
                        if (df.readOnly != null)
                            field.ReadOnly = df.readOnly;
                        if (df.aggregate)
                            field.Aggregate = DataFieldAggregate.indexOf(df.aggregate);
                        if (df.search)
                            field.Tag = (field.Tag ? field.Tag + ' ' : '') + 'search-mode-' + FieldSearchMode.indexOf(df.search).ToLowerCase();
                        if (df.searchOptions)
                            field.SearchOptions = df.searchOptions;
                        // skip AutoCompletePrefixLength
                        // skip items of the Data Field
                        var items = df.items || f.items;
                        if (items != null) {
                            if (items.dataController)
                                field.ItemsDataController = items.dataController;
                            if (items.dataView)
                                field.ItemsDataView = items.dataView;
                            if (items.dataValueField)
                                field.ItemsDataValueField = items.dataValueField;
                            if (items.dataTextField)
                                field.ItemsDataTextField = items.dataTextField;
                            if (items.style)
                                field.ItemsStyle = items.style;
                            if (items.newDataView)
                                field.ItemsNewDataView = items.newDataView;
                            if (items.targetController)
                                field.ItemsTargetController = items.targetController;
                            if (items.copy)
                                field.Copy = items.copy;
                            if (items.pageSize)
                                field.ItemsPageSize = items.pageSize;
                            if (items.letters != null)
                                field.ItemsLetters = items.letters === true;
                            var list = items.list;
                            if (list && list.length) {
                                field.Items = [];
                                list.forEach(function (item) {
                                    field.Items.push([item.value, item.text]);
                                });
                            }
                            if (items.autoSelect != null)
                                field.AutoSelect = items.autoSelect === true;
                            if (items.searchOnStart != null)
                                field.SearchOnStart = items.searchOnStart === true;
                            if (items.description)
                                field.ItemsDescription = items.description;
                        }
                        page.Fields.push(field);
                        // populate DataView field properties
                        var dataView = df.dataView;
                        if (dataView) {
                            if (dataView.showInSummary != null)
                                field.DataViewShowInSummary = dataView.showInSummary === true;
                            if (dataView.showActionBar != null)
                                field.DataViewShowActionBar = dataView.showActionBar !== false;
                            if (dataView.showActionButtons)
                                field.DataViewShowActionButtons = dataView.showActionButtons;
                            if (dataView.showDescription != null)
                                field.DataViewShowDescription = !false;
                            if (dataView.showViewSelector != null)
                                field.DataViewShowViewSelector = dataView.showViewSelector !== false;
                            if (dataView.showModalForms != null)
                                field.DataViewShowModalForms = dataView.showModalForms === true;
                            if (dataView.searchByFirstLetter != null)
                                field.DataViewSearchByFirstLetter = dataView.searchByFirstLetter === true;
                            if (dataView.searchOnStart != null)
                                field.SearchOnStart = dataView.searchOnStart === true;
                            if (dataView.pageSize != null)
                                field.DataViewPageSize = dataView.pageSize;
                            if (dataView.multiSelect)
                                field.DataViewMultiSelect = dataView.multiSelect === true;
                            if (dataView.showPager != null)
                                field.DataViewShowPager = dataView.showPager === true;
                            if (dataView.showPageSize != null)
                                field.DataViewShowPageSize = dataView.showPageSize !== false;
                            if (dataView.showSearchBar != null)
                                field.DataViewShowSearchBar = dataView.showSearchBar !== false;
                            if (dataView.showQuickFind != null)
                                field.DataViewShowQuickFind = dataView.showQuickFind !== false;
                            if (dataView.showRowNumber != null)
                                field.DataViewShowRowNumber = dataView.showRowNumber === true;
                            if (dataView.autoSelectFirstRow != null)
                                field.DataViewAutoSelectFirstRow = dataView.autoSelectFirstRow === true;
                            if (dataView.autoHighlightFirstRow != null)
                                field.DataViewAutoHighlightFirstRow = dataView.autoHighlightFirstRow === true;
                        }
                        // popuplate pivot info
                        if (page.RequiresPivot) {
                            // TODO - complete processing of pivot definitions
                        }
                    }
                });
            }

            function ensurePageFields(page) {
                if (config.statusBar)
                    page.statusBar = config.startBar;
                var fields = config.fields,
                    dataFields = page.Fields,
                    dataFieldMap = page._fieldMap = {};
                if (!fields.length)
                    fields.forEach(function (f) {
                        dataFields.push(DataField_new(f));
                    });
                dataFields.forEach(function (df) {
                    dataFieldMap[df.Name] = df;
                });

                function addDataField(f) {
                    if (typeof f == 'string')
                        f = config._map.fields[f];
                    if (f && !dataFieldMap[f.name]) {
                        dataFields.push(DataField_new(f, true));
                        dataFieldMap[f.name] = dataFields[dataFields.length - 1];
                    }
                }

                // ensure primary keys
                fields.forEach(function (f) {
                    if ((f.isPrimaryKey || f.hidden) && !dataFieldMap[f.name])
                        addDataField(f);
                });
                // ensure alias fields
                dataFields.forEach(function (df) {
                    var aliasName = df.AliasName;
                    if (aliasName) {
                        var aliasDataField = dataFieldMap[aliasName];
                        if (aliasDataField)
                            aliasDataField.Hidden = true;
                        else
                            addDataField(aliasName);
                    }
                });
                // ensure groupExpression 
                var groupExpression = view.groupExpression;
                if (groupExpression) {
                    groupExpression.split($app._simpleListRegex).forEach(function (groupField) {
                        addDataField(groupField);
                    });
                }
                // ensure fields specified in "configuration" and "items/copy"
                dataFields.forEach(function (df) {
                    _app.parseMap(df, function (toField) {
                        addDataField(toField);
                    });
                    _app.parseMap(df.Configuration, function (toField, fromField) {
                        addDataField(fromField);
                    });
                });
            }

            function ensureSystemPageFields(request, page) {
                if (page.Distinct) {
                    var i = 0;
                    while (i < page.Fields.length)
                        if (page.Fields[i].IsPrimaryKey)
                            page.Fields.splice(i, 1);
                        else
                            i++;
                    page.Fields.push({ Name: 'group_count_', Type: 'Double' });
                }
            }

            function createValueFromSourceFields(field, obj) {
                var v = '',
                    objVal = obj[field.Name];
                if (typeof objVal == 'string')
                    v = objVal;
                else {
                    if (objVal == null)
                        v = 'null';
                    var fieldNames = field.SourceFields.split(_app._simpleListRegex);
                    fieldNames.forEach(function (name) {
                        if (v.length)
                            v += '|';
                        var rawValue = obj[name];
                        if (rawValue == null)
                            v += 'null';
                        else
                            v += rawValue.toString();
                    });
                }
                return v;
            }

            function ViewPage_addPivotValues(values) {
                // TODO: Implement pivot framework
            }

            function ViewPage_requiresAggregates() {
                for (var i = 0; i < page.Fields.length; i++)
                    if (page.Fields[i].Aggregate)
                        return true;
                return false;
            }

            function populateManyToManyFields(page) {
                var deferred = $.Deferred(),
                    manyToManyDeferredList = [],
                    listOfPrimaryKeys;
                page.Fields.forEach(function (field) {
                    var itemsTargetController = field.ItemsTargetController;
                    if (itemsTargetController) {
                        var m2mDeferred = $.Deferred(),
                            supportsStatisItems = DataField_supportsStaticItems.call(field);
                        manyToManyDeferredList.push(m2mDeferred.promise());

                        if (!listOfPrimaryKeys && !supportsStatisItems) {
                            listOfPrimaryKeys = [];
                            var pkFieldIndex;
                            page.Fields.every(function (f, index) {
                                if (f.IsPrimaryKey)
                                    pkFieldIndex = index;
                                return pkFieldIndex == null;
                            });
                            page.Rows.forEach(function (r) {
                                listOfPrimaryKeys.push('%js%' + JSON.stringify(r[pkFieldIndex]));
                            });
                        }

                        ViewPage_initializeManyToManyProperties(field, controller).then(function (m2mProps) {
                            if (supportsStatisItems)
                                m2mDeferred.resolve();
                            else
                                $.when(odp.getData(itemsTargetController)).done(function () {
                                    odp._viewPage({
                                        Controller: itemsTargetController,
                                        PageIndex: 0, PageSize: Int32_MaxValue, Filter: [m2mProps.targetForeignKey1 + ':$in$' + listOfPrimaryKeys.join('$or$')], RequiresMetaData: true
                                    }).done(function (m2mPage) {
                                        var fieldMap = ViewPage_toFieldIndexMap.call(m2mPage),
                                            targetTextIndex = -1,
                                            targetForeignKey2Index = fieldMap[m2mProps.targetForeignKey2],
                                            itemMap = {},
                                            items = field.Items;
                                        m2mPage.Fields.every(function (f) {
                                            if (f.Name === m2mProps.targetForeignKey2)
                                                targetTextIndex = fieldMap[f.AliasName || f.Name];
                                            return targetTextIndex < 0;
                                        });
                                        m2mPage.Rows.forEach(function (r) {
                                            var v2 = r[targetForeignKey2Index],
                                                t2 = r[targetTextIndex],
                                                s2;
                                            if (v2 != null) {
                                                s2 = v2.toString();
                                                if (!(s2 in itemMap)) {
                                                    itemMap[s2] = true;
                                                    if (!items)
                                                        field.Items = items = [];
                                                    if (t2 == null)
                                                        t2 = v2;
                                                    items.push([v2, typeof t2 == 'string' ? t2 : t2.toString()]);
                                                }
                                            }
                                        });

                                        m2mDeferred.resolve();
                                    });
                                });

                        });
                    }
                });
                $.when.apply($, manyToManyDeferredList).done(function () {
                    deferred.resolve();
                });

                return deferred.promise();
            }

            function View_new(v) {
                var view = { Id: v.id, Type: v.type, Label: v.label };
                if (v.headerText)
                    view.HeaderText = v.headerText['@value'];
                if (v.group != null)
                    view.Group = v.group;
                if (v.tags)
                    view.Tags = v.tags;
                if (v.showInSelector === false)
                    view.ShowInSelector = false;
                return view;
            }

            function Action_new(a) {
                var action = { Id: a.id };
                if (a.commandName)
                    action.CommandName = a.commandName;
                if (a.commandArgument != null)
                    action.CommandArgument = a.commandArgument;
                if (a.headerText)
                    action.HeaderText = a.headerText;
                if (a.description)
                    action.Description = a.description;
                if (a.cssClass)
                    action.CssClass = a.cssClass;
                if (a.confirmation)
                    action.Confirmation = a.confirmation;
                if (a.notify)
                    action.Notify = a.notify;
                if (a.whenLastCommandName)
                    action.WhenLastCommandName = a.whenLastCommandName;
                if (a.whenLastCommandArgument)
                    action.WhenLastCommandArgument = a.whenLastCommandArgument;
                if (a.causesValidation != null)
                    action.CausesValidation = a.causesValidation !== false;
                if (a.whenKeySelected != null)
                    action.WhenKeySelected = a.whenKeySelected === true;
                if (a.whenTag)
                    action.WhenTag = a.whenTag;
                if (a.whenHRef)
                    action.WhenHRef = a.whenHRef;
                if (a.whenView)
                    action.WhenView = a.whenView;
                if (a.whenClientScript)
                    action.WhenClientScript = a.whenClientScript;
                if (a.key)
                    action.key = a.key;
                return action;
            }

            function ActionGroup_new(ag) {
                var group = { Id: ag.id, Actions: [], Scope: ag.scope };
                if (ag.headerText)
                    group.HeaderText = ag.headerText;
                if (ag.flat === true)
                    group.Flat = true;
                if (ag.actionGroup)
                    ag.actionGroup.forEach(function (a) {
                        group.Actions.push(Action_new(a));
                    });
                return group;
            }

            function ViewPage_applyFieldFilter() {
                var that = this,
                    fields = that.Fields,
                    fieldFilter = that.FieldFilter;
                if (fieldFilter && fieldFilter.length) {
                    var newFields = [];
                    fields.forEach(function (f) {
                        if (f.IsPrimaryKey || ViewPage_includeField.call(that, f.Name))
                            newFields.push(f);
                    });
                    that.Fields = newFields;
                    that.FieldFilter = null;
                }
            }


            function ViewPage_populateStaticItems(field, contextValues) {
                var that = this;
                if (!ViewPage_includeMetadata('items'))
                    return false;
                var supportsStatisItems = DataField_supportsStaticItems.call(field);
                if (supportsStatisItems) {
                    var itemsDeferred = $.Deferred();
                    ViewPage_initializeManyToManyProperties.call(that, field).then(function () {
                        var filter,
                            contextFields = field.ContextFields;
                        if (contextFields) {
                            var contextFilter = [],
                                contextIterator = /(\w+)\s*=\s*(.+?)($|,)/g,
                                m = contextIterator.exec(contextFields),
                                staticContextValues = {};
                            while (m) {
                                var vm = m[2].match(/^(\'(.+?)\'|(\d+))$/);
                                if (vm) {
                                    var lov = staticContextValues[vm[1]];
                                    if (!lov)
                                        lov = staticContextValues[vm[1]] = [];
                                    lov.push(vm[2]);
                                }
                                else if (contextValues) {
                                    var matchedValue;
                                    contextValues.every(function (cv) {
                                        if (cv.Name === m[2]) {
                                            matchedValue = cv;
                                            var v = 'NewValue' in cv ? cv.NewValue : 'OldValue' in cv ? cv.OldValue : cv.Value;
                                            contextFilter.push(m[1] + ':=%js%' + JSON.stringify(v));
                                            return false;
                                        }
                                        return true;
                                    });
                                    if (!matchedValue)
                                        contextFilter.push(m[1] + ':=%js%null');
                                }
                                m = contextIterator.exec(contextFields);
                            }
                            for (fieldName in staticContextValues) {
                                lov = staticContextValues[fieldName];
                                for (var i = 0; i < lov.length - 1; i++)
                                    lov[i] = JSON.stringify(lov[i]);
                                if (lov.length === 1)
                                    contextFilter.push(fieldName + ':=' + lov[0]);
                                else
                                    contextFilter.push(fieldName + ':$in$' + lov.join('$or$'));
                            }
                            filter = contextFilter;
                        }
                        var sortExpression = null;
                        if (!field.ItemsTargetController && !field.ItemsDataView)
                            sortExpression = field.ItemsDataTextField;
                        var itemsDataController = field.ItemsDataController,
                            itemsView = field.ItemsDataView;
                        $.when(_odp.getControllers(itemsDataController)).done(function () {
                            $.when(odp.getData(itemsDataController)).done(function () {
                                odp._viewPage({
                                    Controller: itemsDataController, View: itemsView,
                                    PageIndex: 0, PageSize: 1000, SortExpression: sortExpression, Filter: filter, RequiresMetaData: true, MetadataFilter: ['fields']
                                }).done(function (page) {
                                    itemsDeferred.resolve(field, page);
                                });
                            });
                        });
                    });
                    return itemsDeferred.promise();
                }
                return false;
            }

            function ViewPage_toFieldIndexMap() {
                var map = {},
                    fields = this.Fields;
                for (i = 0; i < fields.length; i++)
                    map[fields[i].Name] = i;
                return map;

            }

            function ViewPage_populateStaticItems_done(field, itemsPage) {
                if (!field.Items)
                    field.Items = [];
                var that = this,
                    dataValueField = field.ItemsDataValueField,
                    dataTextField = field.ItemsDataTextField,
                    items = field.Items;
                if (!dataValueField)
                    itemsPage.Fields.every(function (df) {
                        if (df.IsPrimaryKey) {
                            dataValueField = df.Name;
                            return false;
                        }
                    });
                if (!dataTextField)
                    itemsPage.Fields.every(function (df) {
                        if (df.Type === 'String') {
                            dataTextField = df.Name;
                            return false;
                        }
                    });
                if (!dataTextField)
                    dataTextField = itemsPage.Fields[0].Name;
                var indexMap = ViewPage_toFieldIndexMap.call(itemsPage);
                var fieldList = [indexMap[dataValueField], indexMap[dataTextField]];
                _app.parseMap(field, function (toField, fromField) {
                    var fieldIndex = indexMap[fromField];
                    if (fieldIndex != null)
                        fieldList.push(fieldIndex);
                });
                //if (copy) {
                //    m = _app._fieldMapRegex.exec(copy);
                //    while (m) {
                //        var fieldIndex = indexMap[m[2]];
                //        if (fieldIndex != null)
                //            fieldList.push(fieldIndex);
                //        m = _app._fieldMapRegex.exec(copy);
                //    }
                //}
                itemsPage.Rows.forEach(function (row) {
                    var values = [];
                    fieldList.forEach(function (fieldIndex) {
                        values.push(row[fieldIndex]);
                    });
                    items.push(values);
                });
            }


            function ViewPage_includeField(fieldName) {
                var fieldFilter = this.FieldFilter;
                return !fieldFilter || fieldFilter.indexOf(fieldName) !== -1;
            }

            function ViewPage_toResult(config, options) {
                var that = this,
                    fields = that.Fields,
                    deferred = $.Deferred(),
                    populateStaticItemsDeferred = [],
                    m2mPropsDeferred = [];


                function ensureMetadata() {
                    var metadataDeferred = $.Deferred();
                    if (ViewPage_includeMetadata.call(that, 'views') && config.views)
                        config.views.forEach(function (v) {
                            if (!v.virtualViewId) {
                                var view = View_new(v);
                                that.Views.push(View_new(v));
                                if (view.Id === that.View)
                                    that.ViewHeaderText = view.HeaderText;
                            }
                        });
                    if (ViewPage_includeMetadata.call(that, 'layouts')) {
                        if (view.layout)
                            that.ViewLayout = view.layout['@value'];
                    }
                    if (ViewPage_includeMetadata.call(that, 'actions') && config.actions)
                        config.actions.forEach(function (ag) {
                            that.ActionGroups.push(ActionGroup_new(ag));
                        });
                    if (ViewPage_includeMetadata(that, 'items')) {
                        var contextValues = options ? options.contextValues : null,
                            populateDynamicLookups = contextValues,
                            row = that.NewRow;
                        fields.forEach(function (field) {
                            if (field.ItemsStyle === 'CheckBoxList' || field.ItemsTargetController || (view.type === that._staticLookupViewTypeFilter || populateDynamicLookups)) {
                                if (!contextValues) {
                                    contextValues = [];
                                    if (!row && that.Rows.length)
                                        row = that.Rows[0];
                                    if (row != null)
                                        fields.forEach(function (field, index) {
                                            contextValues.push({ Name: field.Name, Value: row[index] });
                                        });
                                }
                                if (!populateDynamicLookups || field.ContextFields) {
                                    var populateResult = ViewPage_populateStaticItems.call(that, field, contextValues);
                                    if (typeof populateResult !== 'boolean')
                                        populateStaticItemsDeferred.push(populateResult);
                                }
                            }
                        });
                        var deferredCount = populateStaticItemsDeferred.length;
                        $.when.apply($, populateStaticItemsDeferred).done(function () {
                            var list = arguments;
                            if (deferredCount === 1)
                                list = [list];
                            for (var i = 0; i < list.length; i++)
                                ViewPage_populateStaticItems_done.call(page, list[i][0], list[i][1]);
                            metadataDeferred.resolve();
                        });
                    }
                    else
                        metadataDeferred.resolve();

                    return metadataDeferred.promise();
                }

                var metadataPromise = true;
                if (!that.RequiresMetaData) {
                    fields = [];
                    that.Expressions = null;
                }
                else
                    metadataPromise = ensureMetadata();
                $.when(metadataPromise).then(function () {
                    if (!ViewPage_includeMetadata.call(that, 'fields'))
                        fields.splice(0, fields.length);
                    else {
                        fields.forEach(function (f) {
                            if (f.Formula)
                                delete f.Formula;
                            if (f.ItemsTargetController)
                                m2mPropsDeferred.push(ViewPage_initializeManyToManyProperties.call(that, f));
                        });
                    }
                    if (that.Filter)
                        that.Filter.every(function (expression, index) {
                            var isAdvancedSearch = expression.match(/_match_/);
                            if (isAdvancedSearch)
                                that.Filter.splice(index);
                            return !isAdvancedSearch;
                        });
                    // additional initialization
                    that.IsAuthenticated = !!_app.userName();
                    // done
                    $.when.apply($, m2mPropsDeferred).then(function () {
                        deferred.resolve(that);
                    });
                });

                return deferred.promise();
            }

            function ViewPage_fieldIndex(name) {
                var fields = this.Fields;
                for (var i = 0; i < fields.length; i++)
                    if (fields[i].Name === name)
                        return i;
                return -1;
            }

            function ViewPage_NewRow() {
                var deferred = $.Deferred(),
                    page = this,
                    newRow = page.NewRow = [],
                    controller = page.Controller;

                function generateNewRow(obj) {
                    var fieldName, i;
                    for (i = 0; i < config.fields.length; i++)
                        newRow[i] = null;
                    if (obj)
                        for (fieldName in config._map.fields) {
                            if (fieldName in obj)
                                newRow[ViewPage_fieldIndex.call(page, fieldName)] = obj[fieldName];
                        }
                    deferred.resolve(page);
                }

                // request NewRow from the server when
                // 1. Primary key field is calculated (PK is provided by business rules)
                // 2. There is a business rule with CommandName="New (there are possible default values)

                var hasCalculatedPK;
                for (pkFieldName in config._map.key)
                    if (config._map.fields[pkFieldName].calculated)
                        hasCalculatedPK = true;

                if ((hasCalculatedPK || config.newOnServer) && canCallServer()) {
                    _app.execute({ controller: controller, view: page.View, requiresNewRow: true, odp: false, nativeDates: false }).done(function (result) {
                        generateNewRow(result[controller][0]);
                    }).fail(generateNewRow);
                }
                else
                    generateNewRow();

                return deferred.promise();
            }

            //****************************************
            // implementation of GetPage method
            //****************************************
            selectView();
            PageRequest_assignContext.call(request, page);
            ViewPage_new.call(page, request);
            ControllerConfiguration_AssignDynamicExpressions.call(config, page);
            if (page.RequiresMetaData && ViewPage_includeMetadata.call(page, 'categories'))
                populatePageCategories(page);
            if (options) {
                if (options.contextValues) {
                    configureCommand(page);
                    ViewPage_toResult.call(page, config, { contextValues: options.contextValues }).done(function (page) {
                        pageDeferred.resolve(page);
                    });
                }
                else
                    pageDeferred.resolve(page);
            }
            else
                syncRequestedPage(request, page).done(function (page, sortedAndFilteredObjects) {
                    configureCommand(page);
                    ViewPage_applyFieldFilter.call(page);
                    ensureSystemPageFields(request, page);
                    var preFetch = page.SupportsCaching && page.PageSize !== Int32_MaxValue,
                        offset = page.PageSize * page.PageIndex + page.PageOffset,
                        limit = page.PageSize,
                        pagesToFetch = 2;
                    if (!view.type.match(/Grid|DataSheet/))
                        preFetch = page.SupportsCaching = false;
                    if (preFetch) {
                        if (offset >= page.PageSize) {
                            offset -= page.PageSize;
                            pagesToFetch = 3;
                        }
                        limit = page.PageSize * pagesToFetch;
                    }
                    odp.select({ from: page.Controller, where: toWhere(request, page), sort: toSort(page), yield: sortedAndFilteredObjects }).done(function (objects) {
                        for (var rowIndex = offset; rowIndex < offset + limit && rowIndex < objects.length; rowIndex++) {
                            var obj = objects[rowIndex],
                                values = [], i, field;
                            for (i = 0; i < page.Fields.length; i++) {
                                field = page.Fields[i];
                                values[i] = obj[field.Name];
                                if (field.SourceFields)
                                    values[i] = createValueFromSourceFields(field, obj);
                            }
                            if (page.RequiresPivot)
                                ViewPage_addPivotValues.call(page, values);
                            else
                                page.Rows.push(values);
                        }
                        var requiresRowCount = page.RequiresRowCount && !(request.Inserting || request.DoesNotRequireData);
                        if (requiresRowCount)
                            page.TotalRowCount = objects.length;
                        if (!request.DoesNotRequireAggregates && ViewPage_requiresAggregates.call(page)) {
                            var aggregates = page.Aggregates = [],
                                aggregateFields = [];

                            page.Fields.forEach(function (f, index) {
                                if (f.Aggregate)
                                    aggregateFields.push({ field: f, index: index, map: {}, sum: 0, count: 0, min: null, max: null });
                            });
                            objects.forEach(function (obj) {
                                aggregateFields.forEach(function (info) {
                                    var af = info.field,
                                        v = obj[af.Name], result;
                                    switch (af.Aggregate) {
                                        case 1:  // sum
                                            if (v != null)
                                                result = info.sum += v;
                                            break;
                                        case 2:  // count
                                            if (v != null && !info.map[v]) {
                                                result = ++info.count;
                                                info.map[v] = true;
                                            }
                                            break;
                                        case 3:  // average
                                            if (v != null) {
                                                info.sum += v;
                                                result = info.sum / ++info.count;
                                            }
                                            break;
                                        case 4:  // max
                                            if (v != null)
                                                if (info.max == null || info.max < v)
                                                    result = info.max = v;
                                            break;
                                        case 5:  // min
                                            if (v != null)
                                                if (info.min == null || info.min > v)
                                                    result = info.min = v;
                                            break;
                                    }
                                    if (result != null)
                                        aggregates[info.index] = result;
                                });
                            });
                        }
                        if (request.RequiresFirstLetters && page.ViewType !== 'Form')
                            if (!page.RequiresRowCount)
                                page.FirstLetters = '';
                            else {
                                var letterMap = {},
                                    letterList = [];
                                letterField = page.Fields[0];
                                objects.forEach(function (obj) {
                                    var v = obj[letterField.Name];
                                    if (v != null) {
                                        if (typeof v !== 'string')
                                            v = v.toString();
                                        if (v.length) {
                                            var letter = v.substring(0, 1);
                                            if (!letterMap[letter]) {
                                                letterList.push(letter);
                                                letterMap[letter] = true;
                                            }
                                        }
                                    }
                                });
                                letterList.sort();
                                page.FirstLetters = letterList.join(',');
                            }

                        function ViewPage_Complete() {
                            if (page.Distinct) {
                                var distinctRows = [],
                                    distinctMap = {};
                                page.Rows.forEach(function (r) {
                                    var k = r.toString(),
                                        index = distinctMap[k];
                                    if (index == null) {
                                        distinctMap[k] = distinctRows.length;
                                        distinctRows.push(r);
                                        r[r.length - 1] = 0;
                                    }
                                    else
                                        r = distinctRows[index];
                                    r[r.length - 1]++;
                                });
                                page.Rows = distinctRows;
                            }
                            ViewPage_toResult.call(page, config).done(function (page) {
                                pageDeferred.resolve(page);
                            });
                        }

                        if (request.Inserting)
                            ViewPage_NewRow.call(page).done(ViewPage_Complete);
                        else
                            populateManyToManyFields(page).done(ViewPage_Complete);
                    });
                });
            return pageDeferred.promise();
        }
    };

    function htmlDecode(s) {
        var decoder = _app._htmlDecoder;
        if (!decoder)
            decoder = _app._htmlDecoder = document.createElement("textarea");
        decoder.innerHTML = s;
        return decoder.value;
    }

    $(document).on('starting.app', function (e) {
        _touch = _app.touch;
        if (e.namespace === 'app')
            _odp.start();
    });

})();