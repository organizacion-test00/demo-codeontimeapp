/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework  - Universal Input / Draw
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        resources = Web.DataViewResources,
        resourcesData = resources.Data,
        resourcesModalPopup = resources.ModalPopup,
        resourcesDraw = resources.Draw,
        resourcesEditor = resources.Editor,
        getBoundingClientRect = _app.clientRect,
        _toolbox = {
            _default: 'pen',
            pen: {
                config: { color: 'e61b1b', width: 3 },
                settings: {
                    colors: [
                        '000000', 'ffffff', 'd1d3d4', 'a7a9ac', '808285', '58595b',
                        'b31564', 'e61b1b', 'ff5500', 'ffaa00', 'ffce00', 'ffe600',
                        'a2e61b', '26e600', '008055', '00aacc', '004de6', '3d00b8',
                        '6600cc', '600080', 'f7d7c4', 'bb9167', '8e562e', '613d30',
                        'ff80ff', 'ffc680', 'ffff80', '80ff9e', '80d6ff', 'bcb3ff',
                    ],
                    minWidth: 1,
                    maxWidth: 24
                },
                opacity: 1,
            },
            highlighter: {
                config: { color: 'ffe600', width: 12 },
                settings: {
                    colors: ['ffe600', '26e600', '44c8f5', 'ec008c', 'ff5500', '6600cc'],
                    minWidth: 12,
                    maxWidth: 64
                },
                opacity: .7
            },
            blur: {
                config: { color: '000000', width: 6 },
                settings: {},
                opacity: 1//,
                //blur: 5
            },
            eraser: {
                fill: true,
                config: { color: '333333', width: 20, density: 25 },
                //config: { color: 'blue', width: 3, density: 4 },
                settings: {}
            }
        },
        _tools,
        activePage = _touch.activePage,
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

    _input.methods.blob._draw = function (container) {
        var field = _input.elementToField(container),
            pendingUploads = field._dataView._pendingUploads,
            img = activePage('[data-field="' + field.Name + '"] .app-drop-box img'),
            imageWidth,
            imageHeight,
            thumbnail,
            layers,
            headerText;
        if (!img.length) {
            _touch.busy(true);
            container.removeClass('app-empty').find('.app-drop-text').remove();
            thumbnail = container.closest('[data-field]').find('img');
            img = $htmlTag('img', '', 'draggable="false"').insertBefore(container.children().first());
            img.one('load', function () {
                _touch.busy(false);
                _input.methods.blob._draw(container);
            });
            img.attr('src', thumbnail.parent().data('href')/*.attr('src').replace(/=t\|/, '=o|')*/);
            thumbnail.parent().remove();
            return;
        }
        imageWidth = img[0].naturalWidth;
        imageHeight = img[0].naturalHeight;
        if (pendingUploads)
            pendingUploads.forEach(function (pendingUpload) {
                if (pendingUpload.fieldName === field.Name)
                    layers = pendingUpload.layers;
            });
        _touch.whenPageShown(function () {
            var scrollable = _touch.scrollable(),
                pageHeader,
                pageHeaderRect,
                canvasWidth = imageWidth,
                canvasHeight = imageHeight,
                canvas,
                canvasContext,
                canvasContainer,
                drawing = activePage('.app-drawing'),
                buttons = activePage('.app-bar-buttons').css('text-align', 'right'),
                firstChildInButtons = buttons.children().first(),
                tools = $div('app-tools');
            if (firstChildInButtons.length)
                tools.insertBefore(firstChildInButtons);
            else
                tools.appendTo(buttons);

            function createTool(name, icon, indicator) {
                var labels = {
                    pen: resourcesDraw.Pen,
                    highlighter: resourcesDraw.Highlighter,
                    blur: resourcesDraw.Blur,
                    eraser: resourcesDraw.Eraser,
                    undo: resourcesEditor.Undo,
                    redo: resourcesEditor.Redo

                },
                    tool = $span('ui-btn app-tool app-tool-' + name, 'data-tooltip-location="above"').appendTo(tools).attr('data-title', labels[name]);
                _touch.icon('material-icon-' + icon, tool);
                if (indicator)
                    $span('app-indicator').appendTo(tool);
            }

            $div('app-toolbox-form app-toolbox-panel').insertAfter(scrollable);

            createTool('pen', 'edit', true);
            createTool('highlighter', 'brush', true);
            createTool('blur', 'blur_on');
            createTool('eraser', 'edit_off');
            createTool('undo', 'undo');
            createTool('redo', 'redo');

            refreshToolsToolbar();

            pageHeader = scrollable.find('.app-page-header');

            pageHeaderRect = getBoundingClientRect(pageHeader);
            drawing.appendTo(scrollable).css({ top: pageHeaderRect.height });

            canvasContainer = activePage('.app-canvas').css({
                width: canvasWidth,
                height: canvasHeight,
                'margin-left': -canvasWidth / 2,
                'margin-top': -canvasHeight / 2
            });

            if (layers) {
                layers.each(function () {
                    $(this).appendTo(canvasContainer).removeClass('app-layer-top');
                });
                layers.each(function () {
                    var that = $(this),
                        undo = that.data('undo');
                    if (undo)
                        that.show().removeData('undo');
                });
            }
            else {
                canvas = getCanvas(canvasWidth, canvasHeight).addClass('app-layer-commit');
                canvas.appendTo(canvasContainer);
                canvasContext = getContext(canvas);
                canvasContext.drawImage(img[0], 0, 0, imageWidth, imageHeight, 0, 0, canvasWidth, canvasHeight);

                // secondary canvas for drawing of strokes
                canvas = getCanvas(canvasWidth, canvasHeight, 'data-draggable="blobimagecanvas"');
                canvas.css({
                    cursor: 'pointer'
                }).appendTo(
                    canvasContainer);

            }
            drawing.data({ layers: [], width: canvasWidth, height: canvasHeight });
            syncDrawingWithThePageSize();
            updateTools();
        });
        headerText = [field.HeaderText, activePage('.app-page-header h1').first().text()];
        if (headerText[0] === '&nbsp;')
            headerText.splice(0, 1);
        _app.survey({
            context: { field: field, image: img },
            text: headerText[0],
            text2: headerText[1],
            questions: [
                {
                    name: 'changed', type: 'bool'
                }
            ],
            options: {
                modal: {
                    always: true,
                    buttons: {
                        fullscreen: false
                    },
                    fullscreen: true,
                    //dock: "right",
                    //max: 'xxs',
                    gap: false,
                    //tapOut: true,
                    background: 'transparent',
                    title: {
                        minimal: _touch.screen().height - imageHeight < 175
                    }
                },
                materialIcon: _app.agent.ie ? 'tune' : 'draw',
                contentStub: false
                //discardChangesPrompt: false,
            },
            layout: '<div class="app-drawing"><div class="app-canvas"></div></div>',
            submitText: resourcesModalPopup.SaveButton,
            submit: 'drawblobsubmit.app'
        });
    };

    function toolboxScreen(panel) {
        var screen = panel.parent().find('.app-toolbox-screen');
        if (!screen.length)
            screen = $div('app-toolbox-screen').insertBefore(panel);
        return screen;
    }

    function toolboxPanel(method) {
        var panel = activePage('.app-toolbox-form'),
            isVisible = panel.is('.app-toolbox-visible'),
            buttons;
        switch (method) {
            case 'hide':
                panel.removeClass('app-toolbox-visible');
                if (isVisible)
                    setTimeout(function () {
                        panel.css('margin', '');
                    }, 100);
                toolboxScreen(panel).hide();
                return;
            case 'init':
                buttons = panel.closest('.ui-page').find('.app-bar-buttons');
                toolboxScreen(panel).show();
                panel.css({
                    left: getBoundingClientRect(buttons.find('.app-tool-' + toolbox()._active)).left,
                    marginBottom: getBoundingClientRect(buttons).height
                });
                var screen = _touch.screen(),
                    panelRect = getBoundingClientRect(panel);
                if (screen.width <= _touch.toWidth('sm'))
                    panel.removeClass('app-toolbox-panel').css('left', '');
                else {
                    panel.addClass('app-toolbox-panel');
                    if (panelRect.right > screen.left + screen.width - 9)
                        panel.css('left', screen.left + screen.width - 9 - panelRect.width);
                }
                break;
            case 'show':
                toolboxPanel('init').addClass('app-toolbox-visible');
                return;
            case 'toggle':
                return toolboxPanel(isVisible ? 'hide' : 'show');
            case 'visible':
                return isVisible;
        }
        return panel;
    }

    $document
        .on('resized.app', syncDrawingWithThePageSize)
        .on('pagereadycomplete.app', syncDrawingWithThePageSize)
        .on('drawblobsubmit.app', function (e) {
            var context = e.survey.context,
                field = context.field,
                pendingUploads = field._dataView._pendingUploads,
                canvasContainer = activePage('.app-drawing .app-canvas'),
                layers = findLayers(),
                canvas, ctx, crect,
                dataUrl, newBlob, upload,
                saveTransform = canvasContainer.css('transform');
            e.dataView.tag('discard-changes-prompt-none');
            if (layers.length > 2) {
                canvasContainer.css('transform', 'none');
                // create a canvas and reproduce the layers
                layers.each(function (index) {
                    var layer = $(this).removeClass('app-layer-commit app-layer-top'),
                        rect = getBoundingClientRect(layer),
                        opacity = layer.css('opacity');
                    if (layer.is(':visible')) {
                        if (!canvas) {
                            canvas = getCanvas(rect.width, rect.height);
                            ctx = getContext(canvas);
                            crect = rect;
                        }
                        if (index < layers.length - 1) {
                            ctx.globalAlpha = opacity;
                            ctx.drawImage(layer[0], rect.left - crect.left, rect.top - crect.top);
                        }
                        else
                            layer.prev().addClass('app-layer-commit');
                    }
                    else
                        layer.remove();
                });
                canvasContainer.css('transform', saveTransform);

                // locate the pending upload and replace the blob with the new one
                if (!pendingUploads)
                    pendingUploads = field._dataView._pendingUploads = [{
                        fieldName: field.Name,
                        files: [{ name: 'edit.png' }]
                    }];
                pendingUploads.forEach(function (u) {
                    if (u.fieldName === field.Name)
                        upload = u;
                });

                originalBlob = upload.files[0];


                dataUrl = canvas[0].toDataURL(originalBlob.type, originalBlob.quality);
                context.image.attr('src', dataUrl);

                newBlob = _app.dataUrlToBlob(dataUrl);
                newBlob.name = originalBlob.name;
                newBlob.lastModified = originalBlob.lastModified;
                newBlob.lastModifiedDate = originalBlob.lastModifiedDate;
                newBlob.quality = originalBlob.quality;

                upload.files = [newBlob];
                upload.layers = layers.filter(':visible');
            }
        })
        .on('vclick', '.app-tools .app-tool', function (e) {
            var tool = $(this);
            if (toolboxPanel('visible'))
                toolboxPanel('hide');
            else if (!tool.is('.app-disabled')) {
                if (tool.is('.app-tool-pen,.app-tool-highlighter,.app-tool-blur,.app-tool-eraser')) {
                    if (tool.is('.app-selected'))
                        selectTool(tool, true);
                    else {
                        tool.parent().find('.app-selected').removeClass('app-selected');
                        tool.addClass('app-selected');
                        selectTool(tool);
                    }
                }
                else {
                    toolboxPanel('hide');
                    if (tool.is('.app-tool-undo'))
                        performUndo();
                    else if (tool.is('.app-tool-redo'))
                        performRedo();
                }
            }
            return false;
        })
        .on('vclick', '.app-toolbox-form .app-color-palette .app-color', function (e) {
            var colorElem = $(this);
            colorElem.parent().find('.app-color').removeClass('app-selected');
            colorElem.addClass('app-selected');
            var toolName = toolbox()._active,
                color = colorElem.css('background-color').match(/(\d+)\,\s*(\d+),\s*(\d+)/),
                toolboxInfo = toolbox()[toolName];

            color = rgbToHex(parseInt(color[1]), parseInt(color[2]), parseInt(color[3]));
            toolboxInfo.config.color = color;
            _app.userVar('blobdrawtoolbox_' + toolName, toolboxInfo.config)
            activePage('.app-tool-' + toolName + ' .app-indicator').css('background-color', '#' + color);
            drawSampleLine(colorElem.closest('.app-toolbox-form').find('.app-width-sample'));
            return false;
        })
        .on('touchstart mousedown pointerdown', '.app-toolbox-screen', function () {
            toolboxPanel('hide');
            return false;
        }).
        on('blobdrawtoolboxwidth.app', function (e) {
            var toolName = toolbox()._active,
                toolboxInfo = toolbox()[toolName];
            if (e.value !== toolboxInfo.config.width) {
                toolboxInfo.config.width = e.value;
                _app.userVar('blobdrawtoolbox_' + toolName, toolboxInfo.config);
                drawSampleLine(e.slider.parent().find('.app-width-sample'));
            }
        });

    function rgbToHex(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function selectTool(tool, config) {
        var toolName = 'highlighter';
        if (tool.is('.app-tool-pen'))
            toolName = 'pen';
        else if (tool.is('.app-tool-eraser'))
            toolName = 'eraser';
        else if (tool.is('.app-tool-blur'))
            toolName = 'blur';
        if (toolName.match(/pen|highlighter|blur/))
            _app.userVar('blobdrawtoolbox_active', toolName)
        toolbox()._active = toolName;
        if (config) {
            if (toolName !== 'eraser' && toolName !== 'blur') {
                if (!toolboxPanel('visible')) {
                    toolboxPanel('init');
                    var toolInfo = toolbox()[toolName],
                        colors = toolInfo.settings.colors,
                        minWidth = toolInfo.settings.minWidth,
                        width = toolInfo.config.width || minWidth,
                        toolboxContainer = $div('app-toolbox-blobdraw').appendTo(toolboxPanel().empty()).css('minWidth', '');
                    // colors

                    if (colors) {
                        var colorPalette = $div('app-color-palette').appendTo(toolboxContainer);
                        colors.forEach(function (c) {
                            var colorElem = $span('app-color').css('background-color', '#' + c).appendTo(colorPalette);
                            if (c === toolInfo.config.color)
                                colorElem.addClass('app-selected');
                        });
                        //toolboxContainer.css('maxWidth', colorPalette.width());
                    }
                    else
                        toolboxContainer.css('minWidth', 200);
                    // width
                    if (width && minWidth) {
                        var slider = _app.input.slider('create', {
                            //value: 37,
                            value: width,
                            min: minWidth,
                            max: toolInfo.settings.maxWidth,
                            event: 'blobdrawtoolboxwidth.app',
                            container: $div('app-width').appendTo(toolboxContainer)
                        });
                        var sample = getCanvas(slider.width(), toolInfo.settings.maxWidth * 2).addClass('app-width-sample').css('margin', '.5em 0').insertBefore(slider);
                        drawSampleLine(sample);

                    }
                }
                toolboxPanel('toggle');
            }
        }
        else
            toolboxPanel('hide');
    }

    function drawSampleLine(canvas) {
        var toolName = toolbox()._active,
            toolInfo = toolbox()[toolName],
            ctx = getContext(canvas),
            r = getBoundingClientRect(canvas),
            stepX = Math.round(r.width / 6),
            stepY = Math.round(r.height / 2),
            points = [
                { x: 0, y: stepY },
                { x: stepX, y: 0 },
                { x: stepX * 2, y: stepY },
                { x: stepX * 3, y: stepY * 2 },
                { x: stepX * 4, y: stepY },
                { x: stepX * 5, y: 0 },
                { x: stepX * 6, y: stepY }
            ],
            i0 = 0, i1, i2;

        ctx.fillStyle = 'transparent';
        ctx.clearRect(0, 0, r.width, r.height);
        ctx.strokeStyle = toColor(toolInfo.config.color);
        ctx.lineWidth = toolInfo.config.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        while (i0 < points.length - 2) {
            i1 = i0 + 1;
            i2 = i1 + 1;
            ctx.beginPath();
            ctx.moveTo(points[i0].x, points[i0].y);
            ctx.quadraticCurveTo(points[i1].x, points[i1].y, points[i2].x, points[i2].y, .33);
            ctx.stroke();
            i0 = i2;
        }
    }

    function toolbox() {
        if (!_tools) {
            $document.trigger($.Event('blobdrawtoolbox.app', { toolbox: _toolbox }));
            _tools = { _active: _app.userVar('blobdrawtoolbox_active') || _toolbox._default };
            for (var name in _toolbox) {
                var tool = _toolbox[name];
                if (typeof tool == 'object')
                    _tools[name] = { opacity: tool.opacity, fill: tool.fill, blur: tool.blur, config: _app.userVar('blobdrawtoolbox_' + name) || tool.config, settings: tool.settings };
            }
        }
        return _tools;
    }


    function findLayers() {
        return activePage('.app-canvas canvas');
    }

    function updateTools() {
        var page = activePage(),
            layers = findLayers(),
            topLayer = layers.filter('.app-layer-top'),
            tools = page.find('.app-tools'),
            pen = tools.find('.app-tool-pen'),
            highlighter = tools.find('.app-tool-highlighter'),
            eraser = tools.find('.app-tool-eraser'),
            undo = tools.find('.app-tool-undo'),
            redo = tools.find('.app-tool-redo'),
            canUndo, canErase,
            activeTool;
        if (!tools.find('.app-selected').length) {
            activeTool = toolbox()._active;
            if (activeTool === 'eraser')
                activeTool = toolbox()._active = _toolbox._default;
            tools.find('.app-tool-' + activeTool).addClass('app-selected');
            ['pen', 'highlighter', 'blur'].forEach(function (toolName) {
                tools.find('.app-tool-' + toolName).find('.app-indicator').css('background-color', '#' + toolbox()[toolName].config.color);
            });
        }

        canErase = layers.filter(':visible').length > 2;

        layers = layers.filter('.app-layer-commit');
        layers = layers.add(layers.nextAll('canvas:visible,.app-layer-eraser'));

        canUndo = layers.length > 2 && (!topLayer.length || !topLayer.is('.app-layer-commit'));
        eraser.toggleClass('app-disabled', !canErase);
        undo.toggleClass('app-disabled', !canUndo);
        redo.toggleClass('app-disabled', !topLayer.length);
    }

    function performUndo() {
        var layers = findLayers(),
            topLayer = layers.filter('.app-layer-top'),
            restoreLayer,
            restore,
            redoList = [];
        if (topLayer.length)
            topLayer.removeClass('app-layer-top');
        else
            topLayer = layers.last().prev();
        restoreLayer = topLayer;
        topLayer = topLayer.hide().prev().addClass('app-layer-top');

        restore = restoreLayer.data('restore');
        if (restore) {
            restore.forEach(function (layer) {
                var undoLayer = layer.data('undo');
                layer.insertBefore(undoLayer).show();
                if (undoLayer.is('.app-layer-top')) {
                    undoLayer.removeClass('app-layer-top');
                    layer.addClass('app-layer-top');
                }
                layer.data('redo', undoLayer.detach());
                redoList.push(layer);
            });
            restoreLayer.data('restore', redoList);
        }
        updateTools();
    }

    function performRedo() {
        var layers = findLayers(),
            topLayer = layers.filter('.app-layer-top'),
            restoreLayer,
            restore;
        topLayer = topLayer.removeClass('app-layer-top').next().show();
        restoreLayer = topLayer;
        restore = restoreLayer.data('restore');
        if (!topLayer.next().is('[data-draggable="blobimagecanvas"]'))
            topLayer.addClass('app-layer-top');
        if (restore) {
            restore.forEach(function (layer) {
                var redo = layer.data('redo');
                redo.insertBefore(layer);
                layer.fadeOut('fast', function () {
                    $(this).detach();
                });
            });
            restoreLayer.fadeOut('fast', updateTools);
        }
        else
            updateTools();
    }

    function performErase(eraser, dragMan) {
        var logicalCanvas = eraser.closest('.app-canvas'),
            saveTransform = logicalCanvas.css('transform');
        logicalCanvas.css('transform', 'none');

        var eraserRect = getBoundingClientRect(eraser.addClass('app-layer-eraser').show()),
            layer = eraser.prev(),
            layerRect,
            newLayer,
            newLayerCtx,
            erased = [],
            points = dragMan._points;

        eraser.data('restore', erased).hide();
        while (layer.length && layer.prev().length) {
            if (layer.is(':visible')) {
                layerRect = getBoundingClientRect(layer);
                if (_app.intersect(eraserRect, layerRect)) {
                    newLayer = getCanvas(layerRect.width, layerRect.height);
                    var layerLeft = parseFloat(layer.css('left')),
                        layerTop = parseFloat(layer.css('top'));
                    newLayer.css({ left: layerLeft, top: layerTop, opacity: layer.css('opacity') });

                    // create a new layer composed from the original and trace the eraser line on top of it.
                    newLayerCtx = getContext(newLayer);
                    newLayerCtx.drawImage(layer[0], 0, 0);

                    //var eraserCanvas = getCanvas(layerRect.width, layerRect.height),
                    //    eraserCtx = getContext(eraserCanvas);

                    newLayerCtx.globalCompositeOperation = "destination-out";

                    newLayerCtx.lineCap = 'round';
                    newLayerCtx.lineJoin = 'round';
                    newLayerCtx.lineWidth = dragMan._ctx.lineWidth;
                    newLayerCtx.strokeStyle = 'red';

                    newLayerCtx.beginPath();
                    newLayerCtx.moveTo(points[0].x - layerLeft, points[0].y - layerTop);
                    for (var i = 1; i < points.length; i++)
                        newLayerCtx.lineTo(points[i].x - layerLeft, points[i].y - layerTop);
                    newLayerCtx.stroke();

                    newLayerCtx.globalCompositeOperation = "source-over";

                    //newLayerCtx.drawImage(eraserCanvas[0], 0, 0);


                    newLayer.insertBefore(layer);//.hide();

                    if (layer.is('.app-layer-commit'))
                        newLayer.addClass('app-layer-commit');
                    erased.push(layer.data('undo', newLayer).hide().detach());
                    layer = newLayer;
                }
            }
            layer = layer.prev();
        }
        if (!erased.length) {
            eraser.remove();
        }
        logicalCanvas.css('transform', saveTransform);
        updateTools();
    }

    function getCanvas(width, height, attributes) {
        var canvas = $htmlTag('canvas', '', attributes),
            devicePixelRatio = 1;//window.devicePixelRatio;
        // https://www.semicolonworld.com/question/14619/canvas-circle-looks-blurry
        width = Math.floor(width);
        height = Math.floor(height);
        canvas[0].width = width * devicePixelRatio;
        canvas[0].height = height * devicePixelRatio;
        canvas.css({ width: width, height: height });
        return canvas;
    }

    function getContext(canvas) {
        var ctx = ctx = canvas[0].getContext('2d'),
            devicePixelRatio = 1;//window.devicePixelRatio;
        if (!canvas.data('scaled')) {
            canvas.data('scaled', true);
            ctx.scale(devicePixelRatio, devicePixelRatio);
        }
        return ctx;
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function refreshToolsToolbar() {
        var buttons = activePage('.app-bar-buttons'),
            tools = buttons.find('.app-tools'),
            lastTool = tools.find('.app-tool').last(),
            firstButton = buttons.find('[data-action-path]').first(),
            isFullWidth = tools.is('.app-fullwidth');
        tools.removeClass('app-fullwidth').css('text-align', '');
        if (firstButton.length)
            if (getBoundingClientRect(firstButton).left - getBoundingClientRect(lastTool).right < 32) {
                tools.css('text-align', 'left');
                if (getBoundingClientRect(firstButton).left - getBoundingClientRect(lastTool).right < 32)
                    tools.addClass('app-fullwidth');
            }
        if (tools.is('.app-fullwidth') !== isFullWidth)
            _touch.pageResized();
    }

    function syncDrawingWithThePageSize() {
        var drawing = activePage('.app-drawing'),
            drawingRect,
            canvas,
            canvasWidth, canvasHeight,
            maxWidth, maxHeight,
            scale = 1,
            padding = 16;
        if (drawing.data('layers')) {
            toolboxPanel('hide');
            refreshToolsToolbar();
            canvas = drawing.find('.app-canvas');
            if (canvas.length) {
                canvasWidth = drawing.data('width');
                canvasHeight = drawing.data('height');
                drawingRect = getBoundingClientRect(drawing);
                maxWidth = drawingRect.width - padding * 2;
                maxHeight = drawingRect.height - padding * 2;
                if (canvasWidth > maxWidth) {
                    scale = maxWidth / canvasWidth;
                    canvasHeight *= scale;
                }
                if (canvasHeight > maxHeight)
                    scale *= maxHeight / canvasHeight;
                canvas.css('transform', scale === 1 ? '' : 'scale(' + scale + ')');
                drawing.data('scale', scale);
            }
        }
    }

    function toColor(color) {
        if (color.length === 6 /*&& !color.match(/^(salmon|tomato|orange|yellow|violet|orchid|purple|indigo|bisque|sienna|maroon)$/i)*/)
            color = '#' + color;
        return color;
    }

    _app.dragMan['blobimagecanvas'] = {
        options: {
            taphold: false,
            immediate: true
        },
        start: function (drag) {
            var that = this,
                dragTarget = drag.target,
                canvas,
                crect,
                p,
                ctx;

            if (dragTarget.is('.app-drawing'))
                drag.target = dragTarget = dragTarget.find('.app-canvas canvas').last();//.removeAttr('data-draggable');
            canvas = dragTarget,
                crect = getBoundingClientRect(canvas),
                // shared scroll target properties
                drag.dir = 'all';
            that._scale = canvas.closest('.app-drawing').data('scale');
            that._time = new Date().getTime();
            that._crect = crect;
            p = that._addPoint(drag); // { x: Math.round(drag.x - crect.left), y: Math.round(drag.y - crect.top) };
            that._xOffset = 0;
            that._yOffset = 0;
            that._rect = { left: p.x, top: p.y, right: p.x, bottom: p.y }
            that._points = [p, p];
            that._lastCompressedAt = 0;

            ctx = that._ctx = getContext(canvas);


            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            var activeTool = that._tool = toolbox()._active,
                tool = toolbox()[activeTool],
                toolConfig = tool.config,
                toolColor = toColor(toolConfig.color);

            if (tool.fill)
                ctx.fillStyle = toolColor;
            else
                ctx.strokeStyle = toolColor;

            if (activeTool === 'blur') {
                var image = _touch.dataView().survey().context.image;
                ctx.strokeStyle = ctx.createPattern(image[0], 'no-repeat');
                that._blur = Math.round(Math.max(image[0].naturalHeight, image[0].naturalWidth) / 640 * 5);
            }
            else
                that._blur = null;

            ctx.lineWidth = toolConfig.width;
            //that._blur = tool.blur;
            ctx.filter = that._blur ? 'blur(' + that._blur + 'px)' : 'none';
            that._lineDensity = toolConfig.density;
            canvas.css('opacity', tool.opacity)

            // pen
            //ctx.strokeStyle = 'red';
            //that._ctx.lineWidth = 3;

            // highlighter
            //ctx.strokeStyle = 'yellow';
            //that._ctx.lineWidth = 12;
            //canvas.css('opacity', .7);

            // eraser
            //ctx.fillStyle = '#000';
            //that._ctx.lineWidth = 20;
            //canvas.css('opacity', .65);
            //that._erase = true;

            // pencil
            //ctx.fillStyle = 'purple';
            //that._ctx.lineWidth = 6;
            //canvas.css('opacity', .65);
            //that._erase = true;


            that._drawLine(0);
            that._points.splice(1, 1);

            toolboxPanel('hide');

            //that._originalPoints = []; // DEBUG
        },
        move: function (drag) {
            var that = this,
                time = new Date().getTime(),
                rect = that._rect,
                points = that._points,
                compressedPoints,
                lastCompressedAt = that._lastCompressedAt,
                i = lastCompressedAt,
                p, cp, lastPoint, cpi,
                ctx = that._ctx,
                lineWidth = ctx.lineWidth,
                p = that._addPoint(drag), //{ x: Math.round(drag.x - that._crect.left), y: Math.round(drag.y - that._crect.top) },
                sensitivity = Math.max(2, Math.ceil(window.devicePixelRatio / that._scale)); // <= sensitivity

            if (p.x < rect.left)
                rect.left = p.x;
            if (p.y < rect.top)
                rect.top = p.y;
            if (p.x > rect.right)
                rect.right = p.x;
            if (p.y > rect.bottom)
                rect.bottom = p.y;

            points.push(p);
            //that._originalPoints.push(p); // DEBUG

            if (that._tool === 'eraser' || ctx.filter !== 'none')
                that._drawLine(0);
            else
                that._drawCurve();
        },
        cancel: function (drag) {
            this.end(drag);
        },
        end: function (drag) {
            var that = this,
                canvas = drag.target,
                logicalCanvas = canvas.closest('.app-canvas'),
                saveTransform = logicalCanvas.css('transform');

            logicalCanvas.css('transform', 'none');

            var crect = getBoundingClientRect(canvas),
                cprect = getBoundingClientRect(canvas.parent()),
                rect = that._rect,
                layer,// = $htmlTag('canvas'),
                ctx = that._ctx,
                blurWidth = that._blur || 0,
                lineWidth = ctx.lineWidth + blurWidth,
                layerCtx,
                logicalCanvas = canvas.closest('.app-canvas'),
                topLayer = logicalCanvas.find('.app-layer-top'),
                layersToRemove = [];

            if (topLayer.length) {
                topLayer = topLayer.removeClass('app-layer-top').next();
                while (!topLayer.is('[data-draggable="blobimagecanvas"]')) {
                    layersToRemove.push(topLayer);
                    topLayer = topLayer.next();
                }
                layersToRemove.forEach(function (layer) {
                    layer.remove();
                });
            }


            rect.width = rect.right - rect.left + 1 + lineWidth * 2;
            rect.height = rect.bottom - rect.top + 1 + lineWidth * 2;

            rect.left -= lineWidth;
            rect.top -= lineWidth;
            rect.right += lineWidth;
            rect.bottom += lineWidth;

            that._xOffset = rect.left;
            that._yOffset = rect.top;

            // var dummyOriginalPoints = that._originalPoints; // DEBUG

            var destRect,
                sourceRect,
                absoluteRect = {
                    left: rect.left + crect.left + lineWidth / 2,
                    top: rect.top + crect.top + lineWidth / 2,
                    right: rect.right + crect.left - lineWidth / 2,
                    bottom: rect.bottom + crect.top - lineWidth / 2
                };

            if (_app.intersect(absoluteRect, crect)) {
                _app.input.execute({ changed: true });

                layer = getCanvas(rect.width, rect.height);
                layer.css('opacity', canvas.css('opacity'));

                layerCtx = getContext(layer);

                destRect = { left: 0, top: 0, width: rect.width, height: rect.height };
                sourceRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width - 1, bottom: rect.top + rect.height - 1 };

                // Fit the sourceRect withing the canvas. Safari will not draw the source image if the rect specification outside of the image boundaries
                if (sourceRect.left < 0) {
                    destRect.left = -sourceRect.left;
                    destRect.width += sourceRect.left;
                    sourceRect.width += sourceRect.left;
                    sourceRect.left = 0;
                }

                if (sourceRect.top < 0) {
                    destRect.top = - sourceRect.top;
                    destRect.height += sourceRect.top;
                    sourceRect.height += sourceRect.top;
                    sourceRect.top = 0;
                }

                if (sourceRect.right > crect.width) {
                    sourceRect.width -= sourceRect.right - crect.width + 1;
                    destRect.width -= sourceRect.right - crect.width + 1;
                }

                if (sourceRect.bottom > crect.height) {
                    sourceRect.height -= sourceRect.bottom - crect.height + 1;
                    destRect.height -= sourceRect.bottom - crect.height + 1;
                }

                // copy the image from the top-leve canvas to the new layer
                layerCtx.drawImage(canvas[0], sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, destRect.left, destRect.top, destRect.width, destRect.height);

                layer[0].style.left = Math.round(crect.left - cprect.left + rect.left) + 'px';
                layer[0].style.top = Math.round(crect.top - cprect.top + rect.top) + 'px';

                layer.insertBefore(canvas);
                ctx.clearRect(rect.left - lineWidth, rect.top - lineWidth, rect.width + lineWidth, rect.height + lineWidth);

                if (that._tool === 'eraser') {
                    layer.fadeOut('fast', function () {
                        performErase(layer, that);
                    });
                }
                else
                    updateTools();
            }
            logicalCanvas.css('transform', saveTransform);
        },
        _addPoint: function (drag) {
            var that = this,
                scale = that._scale,
                crect = that._crect,
                p = { x: Math.round(drag.x - crect.left), y: Math.round(drag.y - crect.top) };
            if (scale !== 1) {
                p.x *= 1 / scale;
                p.y *= 1 / scale;
            }
            return p;

        },
        _drawCurve: function () {
            var that = this,
                ctx = that._ctx,
                rect = that._rect,
                lineWidth = ctx.lineWidth,
                points = that._points,
                p1 = points[0],
                p2 = points[1],
                mp,
                i = 1;

            ctx.clearRect(rect.left - lineWidth, rect.top - lineWidth, rect.right - rect.left + 1 + lineWidth * 2, rect.bottom - rect.top + 1 + lineWidth * 2);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            while (i < points.length - 1) {
                mp = getMiddlePoint(p1, p2);
                ctx.quadraticCurveTo(p1.x, p1.y, mp.x, mp.y);
                p1 = points[i];
                p2 = points[i + 1];
                i++;
            }
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        },
        _drawLine: function (offset) {
            var that = this,
                ctx = that._ctx,
                points = that._points,
                i1 = points.length - 1 - offset,
                i0 = i1 - 1,
                xOffset = that._xOffset,
                yOffset = that._yOffset,
                radius;
            if (that._tool === 'eraser') {
                radius = that._ctx.lineWidth / 2;
                for (var i = 0; i < that._lineDensity; i++) {
                    var offsetX = getRandomInt(-radius, radius);
                    var offsetY = getRandomInt(-radius, radius);
                    ctx.fillRect(points[i1].x - yOffset + offsetX, points[i1].y - yOffset + offsetY, 1, 1);
                }
            }
            else if (i0 >= 0) {
                ctx.beginPath();
                ctx.moveTo(points[i0].x - xOffset, points[i0].y - yOffset);
                ctx.lineTo(points[i1].x - xOffset, points[i1].y - yOffset);
                ctx.stroke();
            }
        }
    };

    function getMiddlePoint(p1, p2) {
        return {
            x: p1.x + (p2.x - p1.x) / 2,
            y: p1.y + (p2.y - p1.y) / 2
        };
    }

})();