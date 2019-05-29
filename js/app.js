var TextTransmitter = (function () {
    var host = "voice-engine.github.io";
    if ((host == window.location.host) && (window.location.protocol != "https:")) {
        window.location.protocol = "https";
    }

    function onDOMLoad() {
        var btn = document.getElementById('send');
        var ssid = document.getElementById('ssid');
        var password = document.getElementById('password');

        var onFinish = function () {
            btn.disabled = false;
            console.log('finished');
        };

        var onClick = function (e) {
            if (ssid.value) {
                btn.disabled = true;

                var payload = String.fromCharCode(ssid.length) + ssid.value + password.value;
                var transmit = Quiet.transmitter({ profile: 'wave', onFinish: onFinish, clampFrame: false });
                transmit.transmit(Quiet.str2ab(payload));

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
            profilesPath: "/quiet-profiles.json",
            memoryInitializerPath: "/js/quiet-emscripten.js.mem",
            emscriptenPath: "/js/quiet-emscripten.js"
        });
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
