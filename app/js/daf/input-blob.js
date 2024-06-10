/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework  - Universal Input / Blob
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        resources = Web.DataViewResources,
        resourcesData = resources.Data,
        labelBlobDownloadHint = resourcesData.BlobDownloadHint,
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
        $ul = htmlUtilities.$ul;

    function captureBlob(field, dataInput, blob) {
        if (_touch.isInTransition())
            setTimeout(captureBlob, 50, field, dataInput, blob);
        else if (dataInput.closest('.ui-page-active').length)
            // "capture" the default blob if the page active
            _app.upload('capture', { field: field, container: dataInput.find('.app-drop-box'), files: blob });
    }

    _input.methods.blob = {
        _mapRequest: function (dataView, row, autofill, fields) {
            var request = { autofill: 'map' },
                count = 0, triggerCount = 0, triggerValueCount = 0;
            fields.forEach(function (fname) {
                if (!fname.match(/^_/) && fname in autofill) {
                    var fieldConfig = autofill[fname],
                        isTriggered = fieldConfig.trigger,
                        f = dataView.findField(fieldConfig.field),
                        v = row[f.Index];
                    if (isTriggered)
                        triggerCount++;
                    if (v != null) {
                        request[fname] = v;
                        count++;
                        if (isTriggered)
                            triggerValueCount++;
                    }
                }
            });
            return count && triggerCount === triggerValueCount ? request : null;
        },
        _mapUpdate: function (map, inner, mapRequest, mapResponse) {
            var backgroundImage = '';
            mapRequest = JSON.parse(mapRequest);
            if (mapResponse) {
                mapResponse = JSON.parse(mapResponse);
                if (mapResponse.image)
                    backgroundImage = 'url(data:' + mapResponse.contentType + ';base64,' + mapResponse.image + ')';
            }
            var address = [],
                lat = mapRequest.latitude;
            if (lat != null && !('address1' in mapRequest))
                address.push(lat, mapRequest.longitude);
            else
                ['address1', 'address2', 'address3', 'city', 'region', 'postalcode', 'country'].forEach(function (p) {
                    var v = mapRequest[p];
                    if (v != null)
                        address.push(v);
                });
            map.attr('title', address.join(', '));
            map.css({ backgroundImage: backgroundImage, width: backgroundImage ? mapRequest.width : '', backgroundSize: mapRequest.scale > 1 ? '100% auto' : '' }).data('r', mapRequest);
            inner.toggleClass('app-has-map', backgroundImage.length > 0);
        },
        render: function (options) {
            var that = this,
                dataInput = options.container,
                inner = options.inner,
                field = options.field,
                onDemandStyle = field.OnDemandStyle,
                dataView = field._dataView,
                row = options.row,
                editing = options.editing,
                dropBox,
                v = row[field.Index], t,
                useOriginalImage,
                blobLink;
            t = _input.fieldToPlaceholder(field);
            if (field.tagged('autofill-address', 'autofill-geocode')) {
                var map = inner.find('.app-map-placeholder');
                if (!map.length) {
                    map = $div('app-map-placeholder').appendTo(inner.empty());
                    dataInput.attr('data-read-only', 'true');
                    if (t)
                        $span('app-data-input-placeholder').text(t).appendTo(map);
                    else
                        map.html('&nbsp;');
                }
                _touch.autofillConfig(dataView, ''); // ensure autofill config
                var autofill = dataView._autoFill,
                    controller = dataView._controller,
                    config, mapRequestLatLng, mapRequestAddr, mapRequest, mapResult,
                    backgroundImage;
                for (var n in autofill)
                    if (field.tagged(n + '-map')) {
                        config = autofill[n];
                        // ensure that we have the data to get the static map
                        mapRequestLatLng = that._mapRequest(dataView, row, config, ['latitude', 'longitude']);
                        mapRequestAddr = that._mapRequest(dataView, row, config, ['address1', 'address2', 'address3', 'city', 'region', 'city', 'country']);
                        mapRequest = mapRequestAddr;
                        if (!mapRequest)
                            mapRequest = mapRequestLatLng;
                        else
                            if (!('address1' in mapRequest) && mapRequestLatLng)
                                mapRequest = mapRequestLatLng;
                        // get the static map
                        inner.toggleClass('app-has-map', mapRequest != null);
                        if (mapRequest) {
                            backgroundImage = ''; // do not reset  the background until the map is returned from the server
                            map.css({ width: '', height: field.tagged('map-height-') ? _app.tagSuffix : '' });
                            mapRequest.width = Math.floor(map.width());
                            mapRequest.height = Math.floor(map.height());
                            map.css('width', mapRequest.width);
                            //if (highScreenDPI())
                            //    mapRequest.scale = 2;
                            mapRequest.scale = Math.ceil(window.devicePixelRatio) || 1;
                            var mapType = field.Tag.match(/\bmap\-type\-(\w+)\b/);
                            if (mapType)
                                mapRequest.mapType = mapType[1];
                            mapRequest.zoom = field.tagged('map-zoom-') ? parseInt(_app.tagSuffix) : 16;
                            mapRequest = JSON.stringify(mapRequest);
                            mapResult = _app.cache['map:' + mapRequest];
                            if (mapResult) {
                                if (mapResult !== true)
                                    that._mapUpdate(map, inner, mapRequest, mapResult);
                            }
                            else {
                                _app.cache['map:' + mapRequest] = true;
                                _app.execute({ controller: controller, view: dataView._viewId, command: 'AutoFill', trigger: mapRequest, background: true }).done(function (r) {
                                    mapResult = r[controller].AutoFill;
                                    that._mapUpdate(map, inner, mapRequest, mapResult);
                                    _app.cache['map:' + mapRequest] = mapResult;
                                });
                            }
                            break;
                        }
                    }
                if (backgroundImage == null)
                    map.css({ backgroundImage: '', width: '', height: '' }).removeData('r');

            }
            else {
                inner.empty();
                if (!v || v.match(/^null/)) {
                    dataInput.addClass('app-null');
                    if (t) {
                        if (t === resources.Validator.Required)
                            t = '';
                        $span('app-blob-placeholder').text(t).appendTo(inner);
                    }
                }
                else {
                    t = v;
                    if (!editing) {
                        dropBox = inner.find('.app-drop-box');
                        if (dropBox.length)
                            _app.upload('destroy', { container: dropBox });
                    }
                    blobLink = $a('', 'rel="external"').appendTo(inner);
                    var contentType,
                        loweredFieldName = field.Name.toLowerCase(),
                        imageOriginal = field.tagged(/\bimage\-original\-(\w+)\b/),
                        isImage, imageHref
                    _app.odp.blob('init', { link: blobLink, field: field, key: t });
                    if (onDemandStyle !== 1) {
                        // figure the content type of the blob
                        $(dataView._allFields).each(function () {
                            var f = this,
                                loweredName = f.Name.toLowerCase();
                            if (loweredName === loweredFieldName + 'contenttype' || loweredName === loweredFieldName + 'content_type') {
                                contentType = row[f.Index];
                                return false;
                            }
                        });
                        $(dataView._allFields).each(function () {
                            var f = this,
                                loweredName = f.Name.toLowerCase();
                            if (loweredName === 'contenttype' || loweredName === 'content_type') {
                                contentType = row[f.Index];
                                return false;
                            }
                        });
                        if (!contentType)
                            contentType = 'image';
                        isImage = contentType.match(/^image/i);

                        if (isImage && imageOriginal && (imageOriginal[1] === 'always' || imageOriginal[1] === 'editing' && editing))
                            useOriginalImage = true;

                        // create a thumbnail
                        blobLink.addClass('app-has-image');
                        _app.odp.blob('init', { image: $htmlTag('img', '', _touch.observableAttr()).appendTo(blobLink).attr({ 'title': labelBlobDownloadHint }), field: field, key: t });
                        if (isImage)
                            blobLink.attr('data-content-type', contentType);
                        else if (!_touch.pointer('touch'))
                            blobLink.attr('target', '_blank');
                        if (useOriginalImage && !editing) {
                            imageHref = blobLink.data('href');
                            $htmlTag('img', '', 'draggable="false"').css('max-width', '100%').attr({ src: imageHref, 'data-href': imageHref, title: labelBlobDownloadHint }).appendTo(inner);
                            blobLink.remove();
                        }
                    }
                    else {
                        blobLink.appendTo(inner).addClass('app-link-blob').attr('title', labelBlobDownloadHint);
                        //$('<span class="glyphicon glyphicon-download"> </span>').appendTo(blobLink);
                        $span().text(resourcesData.BlobDownloadLink).appendTo(blobLink);
                        if (!_touch.pointer('touch'))
                            blobLink.attr('target', '_blank');
                    }
                }
                if (editing) {
                    _app.upload('create', {
                        container: $div('drop-box-' + field.Index, 'tabindex="0"').appendTo(inner),
                        dataViewId: dataView._id,
                        fieldName: field.Name,
                        multiple: field.Multiple,
                        change: function () {
                            var isEmpty = !!dataInput.find('.app-drop-box.app-empty').length;
                            dataInput.toggleClass('app-null', isEmpty);
                            _input.execute({ dataView: field._dataView, values: { field: field, value: isEmpty ? null : '0' }, skipDrawingInput: dataInput });
                            _touch.pageResized(false);
                            if (isEmpty && _touch && field.OnDemandStyle !== 2)
                                _input.methods.blob._setDefaultValue(field, _app.input.of(inner));
                        }
                    });
                    // create the default blob value for non-signatures
                    if ((v == null || v.match(/^null\|/)) && onDemandStyle !== 2)
                        that._setDefaultValue(field, dataInput);
                    else if (useOriginalImage && blobLink) {
                        var dropBox = inner.find('.app-drop-box').removeClass('app-empty');
                        dropBox.find('.app-drop-text').remove();
                        $htmlTag('img', '', 'draggable="false"').attr('src', blobLink.data('href')).insertBefore(dropBox.children().first());
                        blobLink.remove();
                    }
                }
            }
            _input.methods.text._createFooter(options);
        },
        focus: function (target, source) {
            _input.beforeFocus(target);
            _touch.hasFocus(target);
            //alert(target[0].outerHTML);
            if (!target.is(':input')) {
                _touch.findInput().blur();
                target.find('.app-drop-box').focus();
                _touch.saveLastFocusedField(target);
                //_input.labelState(target);
                return true;
            }
        },
        blur: function (e) {
            _touch.hasFocus(e.target, false);
        },
        _setDefaultValue: function (field, dataInput) {
            getDefaultBlobEvent = $.Event('getdefaultblob.app', { dataView: field._dataView, field: field.Name, blob: {} });
            $document.trigger(getDefaultBlobEvent);
            var blobUrl = getDefaultBlobEvent.blob.url,
                blobIcon = getDefaultBlobEvent.blob.icon;
            if (blobUrl || blobIcon) {
                // create a placeholder for the image
                var dropBox = dataInput.find('.app-drop-box').empty().removeClass('app-empty');
                $div().text(resources.HeaderFilter.Loading).appendTo(dropBox);
                var height = field.OnDemandStyle !== 1 ? 300 : 0,
                    imageWidth, imageHeight, blobIconCanvas, blobIconCtx, blobIcon,
                    processImageSize = field.tagged(/\bimage\-size\-(\d+)x(\d+)\b/);
                if (processImageSize) {
                    imageWidth = parseInt(processImageSize[1]);
                    imageHeight = parseInt(processImageSize[2]);
                    dropBoxRect = getBoundingClientRect(dropBox);
                    if (dropBoxRect.width < imageWidth)
                        height = dropBox.width() * (imageWidth > imageHeight ? imageWidth / imageHeight : imageHeight / imageWidth);
                    else
                        height = imageHeight;
                }
                if (height)
                    $htmlTag('img', '', 'draggable="false"').css({ visibility: 'hidden', width: '100%', height: height }).appendTo(dropBox);
                $a('app-clear ui-btn ui-btn-icon-notext ui-icon-trash ui-corner-all').css('visibility', 'hidden').appendTo(dropBox);
                if (blobUrl) {
                    // load the default blob from the server and capture in the data input
                    blobFileName = blobUrl.match(/\/([\w\.\-]+?)(\?|$)/);
                    blobFileName = getDefaultBlobEvent.blob.fileName || blobFileName ? blobFileName[1] : null;
                    var blobRequest = new XMLHttpRequest();
                    blobRequest.open('GET', _app.resolveClientUrl(blobUrl), true);
                    blobRequest.responseType = 'blob';
                    blobRequest.onload = function (e) {
                        var blob = blobRequest.response;
                        blob.name = blobFileName;
                        captureBlob(field, dataInput, blob);
                    };
                    blobRequest.send();
                }
                else {
                    imageWidth = imageWidth || 512;
                    imageHeight = imageHeight || 512;
                    blobIconCanvas = $htmlTag('canvas')[0];
                    blobIconCanvas.width = imageWidth;
                    blobIconCanvas.height = imageHeight;
                    blobIconCtx = blobIconCanvas.getContext('2d');
                    blobIconCtx.textBaseline = "top";
                    blobIconCtx.fillStyle = "#fff";
                    blobIconCtx.fillRect(0, 0, imageWidth, imageHeight);
                    blobIconCtx.fillStyle = getDefaultBlobEvent.blob.color || "#000";
                    var fontSize = Math.min(imageWidth, imageHeight);
                    blobIconCtx.font = fontSize + 'px Material Icons';
                    blobIconCtx.fillText(blobIcon, (imageWidth - fontSize) / 2, (imageHeight - fontSize) / 2, fontSize);
                    blobIcon = _app.dataUrlToBlob(blobIconCanvas.toDataURL('image/png', 1));
                    blobIcon.name = field.Name + '.png';
                    captureBlob(field, dataInput, blobIcon);
                }
            }
        },
        draw: function (container) {
            var that = this;
            _app.getScript('~/js/daf/input-draw', function () {
                that._draw(container);
            });
        }
    };

})();