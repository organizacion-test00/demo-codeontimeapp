/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework  - Universal Input / QR Code 
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
        $ul = htmlUtilities.$ul;

    function toColor(color) {
        if (color.length === 6 && !color.match(/^(salmon|tomato|orange|yellow|violet|orchid|purple|indigo|bisque|sienna|maroon)$/i))
            color = '#' + color;
        return color;
    }

    _input.methods.qrcode = {
        _init: function (field, value, text, placeholder) {
            _app.getScript('~/js/lib/qrcode.min.js', function () {
                // this hack is required to allow QRCode rendering on Android devices
                QRCode.prototype.makeImage = function () {
                    if (typeof this._oDrawing.makeImage == "function") {
                        this._oDrawing.makeImage();
                    }
                };
                _input.methods.qrcode.makeCode(field, value, text, placeholder);
            })
        },
        makeCode: function (field, value, text, placeholder) {
            var qrCodeDef = field.tagged(/input-qrcode-(size\-)?(\d+)x(\d+)/),
                width = qrCodeDef ? parseInt(qrCodeDef[2]) : 128,
                height = qrCodeDef ? parseInt(qrCodeDef[3]) : 128,
                colorDarkDef = field.tagged(/input-qrcode-color-dark-(\w+)/),
                colorLightDef = field.tagged(/input-qrcode-color-light-(\w+)/),
                colorLight = toColor(colorLightDef ? colorLightDef[1] : 'ffffff'),
                correctLevelDef = field.tagged(/input-qrcode-correct-level-(L|M|Q|H)/i),
                img,
                parentPage,
                scrollIntoView;
            placeholder.css({ width: width, height: height, display: 'inline-block', padding: $('body').is('.app-theme-dark') ? 5 : 1, 'background-color': colorLight });
            if (value != null) {
                try {
                    new QRCode(placeholder.empty()[0], {
                        text: text,
                        width: width * Math.ceil(_window.devicePixelRatio),
                        height: height * Math.ceil(_window.devicePixelRatio),
                        colorDark: toColor(colorDarkDef ? colorDarkDef[1] : '000000'),
                        colorLight: colorLight,
                        correctLevel: QRCode.CorrectLevel[correctLevelDef ? correctLevelDef[1].toUpperCase() : 'H']
                    })
                    if (field.is('input-qrcode-tooltip-hidden'))
                        placeholder.removeAttr('title');
                    placeholder.find('canvas').css('visibility', 'hidden');
                    img = placeholder.css('visibility', '').find('img').css({
                        'maxWidth': '100%', 'maxHeight': '100%'
                    });
                    scrollIntoView = field.is('input-qrcode-scroll-into-view');
                    parentPage = scrollIntoView ? img.closest('.ui-page') : img.closest('.app-page-modal-fit-content');
                    if (parentPage.length) {
                        if (scrollIntoView)
                            _touch.pageInfo(parentPage.attr('id')).autoFocus = false;
                        img.on('load', function () {
                            if (!_touch.isInTransition() && parentPage.is('.ui-page-active'))
                                _touch.resetPageHeight();
                            if (scrollIntoView)
                                _touch.scrollIntoView(img);
                        });
                    }
                }
                catch (ex) {
                    placeholder.text(ex.message).css({ display: '', width: '' });
                }
            }
            else {
                placeholder.parent().remove();
                _touch.syncEmbeddedViews();
            }
        }
    };

})();