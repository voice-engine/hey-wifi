(function () {
    var host = "voice-engine.github.io";
    if ((host == window.location.host) && (window.location.protocol != "https:")) {
        window.location.protocol = "https";
    }

    function onDOMLoad() {
        var btn = document.getElementById('broadcast');
        var ssidInput = document.getElementById('ssid');
        var passwordInput = document.getElementById('password');
        var devicesTable = document.getElementById('devicesTable');
        var devicesElement = document.getElementById('devices');
        var devices = [];
        var key = null;

        function toBytes(str) {
            var buf = new Uint8Array(str.length);
            for (var i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i);
            }
            return buf;
        }

        function toString(bytes) {
            return String.fromCharCode.apply(null, bytes);
        }


        var onClick = function (e) {
            if (btn.innerText != 'BROADCAST') {
                btn.innerText = 'BROADCAST';
                return;
            }

            var ssid = ssidInput.value;
            var password = passwordInput.value;

            if (ssid) {
                btn.innerText = 'STOP';
                devicesTable.hidden = true;
                devices = []

                var channel = Math.floor(Math.random() * (1 << 16));
                var payload = String.fromCharCode(ssid.length) + ssid +
                    String.fromCharCode(password.length) + password +
                    String.fromCharCode(channel & 0xFF) + String.fromCharCode(channel >> 8);
                var buffer = Quiet.str2ab(payload);

                key = toBytes(md5(payload, null, true));
                console.log(key);

                var onFinish = function () {
                    if (btn.innerText != 'BROADCAST') {
                        setTimeout(function () {
                            if (btn.innerText != 'BROADCAST') {
                                console.log('repeat tx: ' + payload);
                                window.transmit.transmit(buffer);
                            }
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

        function showDevices(devices) {
            if (devices) {
                var html = '';
                for (var i = 0; i < devices.length; i++) {
                    html = html + `<tr><td>${i}</td><td>${devices[i]}</td></tr>`;

                }
                devicesElement.innerHTML = html;
                devicesTable.hidden = false;
            }
        }

        // var clientId = Math.random().toString().substring(2);
        // console.log(clientId);
        var client = new Paho.Client("iot.eclipse.org", Number(443), "/wss");
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect({ onSuccess: onConnect, useSSL: true });
        function onConnect() {
            console.log("onConnect");
            client.subscribe("/voicen/channel");

            // key = toBytes(md5('1234567890', null, true));
            // var count = Math.floor(Math.random() * 10000);
            // var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(count));
            // var msg = '10.10.10.10'
            // var encrypted = aesCtr.encrypt(toBytes(msg));
            // var data = JSON.stringify({id: count, data: btoa(toString(encrypted))});
            // console.log(msg, encrypted, data);
            // var message = new Paho.Message(data);
            // message.destinationName = "/voicen/channel";
            // client.send(message);
        }
        function onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log("onConnectionLost:" + responseObject.errorMessage);
                setTimeout(function () {
                    client.connect({ onSuccess: onConnect, useSSL: true });
                }, 1000);
            }
        }
        function onMessageArrived(message) {
            console.log("onMessageArrived:" + message.payloadString);
            if (!key) {
                return;
            }
            try {
                var json = JSON.parse(message.payloadString);
                var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(json.id));
                var decrypted = aesCtr.decrypt(toBytes(atob(json.data)));
                var value = toString(decrypted);
                console.log(value);
                var ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (value.match(ipformat)) {
                    devices.push(value);
                    showDevices(devices);
                }
            } catch (e) {
                console.log(e)
                return;
            }

        }
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
