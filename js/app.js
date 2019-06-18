var TextTransmitter = (function () {
    var host = "voice-engine.github.io";
    if ((host == window.location.host) && (window.location.protocol != "https:")) {
        window.location.protocol = "https";
    }

    function onDOMLoad() {
        var btn = document.getElementById('broadcast');
        var ssid = document.getElementById('ssid');
        var password = document.getElementById('password');

        var onClick = function (e) {
            if (btn.innerText != 'BROADCAST') {
                btn.innerText = 'BROADCAST';
                return;
            }

            if (ssid.value) {
                btn.innerText = 'STOP';
                var payload = String.fromCharCode(ssid.value.length) + ssid.value + String.fromCharCode(password.value.length) + password.value;
                var buffer = Quiet.str2ab(payload);
                var onFinish = function () {
                    if (btn.innerText != 'BROADCAST') {
                        setTimeout(function () {
                            console.log('repeat tx: ' + payload);
                            window.transmit.transmit(buffer);
                        }, 1000);
                    } else {
                        console.log('finished');
                    }
                };

                if (!window.transmit) {
                    window.transmit = Quiet.transmitter({ profile: 'wave', onFinish: onFinish, clampFrame: false });
                }
                window.transmit.transmit(buffer);
                console.log('tx: ' + payload);
            }
        };

        btn.addEventListener('click', onClick, false);
        btn.disabled = true;

        var onQuietReady = function () {
            btn.disabled = false;
        };
        var onQuietFail = function (reason) {
            console.log("quiet failed to initialize: " + reason);
        };

        Quiet.addReadyCallback(onQuietReady, onQuietFail);

        Quiet.init({
            profilesPath: "quiet-profiles.json",
            memoryInitializerPath: "js/quiet-emscripten.js.mem",
            emscriptenPath: "js/quiet-emscripten.js"
        });
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
