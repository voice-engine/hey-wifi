(function () {
    var hostname = ["127.0.0.1", "localhost"];
    if ((window.location.protocol != "https:") && (hostname.indexOf(window.location.host) < 0)) {
        window.location.protocol = "https";
    }

    function onDOMLoad() {
        var btn = document.getElementById('broadcast');
        var ssidInput = document.getElementById('ssid');
        var passwordInput = document.getElementById('password');
        var devicesTable = document.getElementById('devicesTable');
        var devicesElement = document.getElementById('devices');
        var ringElement = document.getElementById('ring');
        var rippleElement = document.getElementById('ripple');
        var logoImage = document.getElementById('logo');
        var devices = [];
        var payload = null;
        var encoder = new TextEncoder();
        var channel = Math.floor(Math.random() * (1 << 16));

        function str2array(str) {
            var buf = new Uint8Array(str.length);
            for (var i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i);
            }
            return buf;
        }

        function array2str(bytes) {
            return String.fromCharCode.apply(null, bytes);
        }

        async function fixKey(key) {
            const hash = await crypto.subtle.digest('SHA-256', key);
            var rawKey = new Uint8Array(hash).slice(0, 16);
            console.log(rawKey);

            return await crypto.subtle.importKey(
                "raw",
                rawKey,
                "AES-CTR",
                true,
                ["encrypt", "decrypt"]
            );
        }

        function getCounter(n) {
            var counter = new Uint8Array(16);
            for (var i = 15; i >= 0; --i) {
                counter[i] = n % 256;
                n = n / 256;
            }
            return counter;
        }

        async function decrypt(n, key, b64str) {
            var counter = getCounter(n);
            var array = str2array(atob(b64str));

            var k = await fixKey(key);
            var decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "AES-CTR",
                    counter,
                    length: 64
                },
                k,
                array,
            );

            return array2str(new Uint8Array(decrypted));
        }

        async function encrypt(n, key, str) {
            var counter = getCounter(n)
            var array = str2array(str);

            var k = await fixKey(key);
            var encrypetd = await window.crypto.subtle.encrypt(
                {
                    name: "AES-CTR",
                    counter,
                    length: 64
                },
                k,
                array
            );

            return btoa(array2str(new Uint8Array(encrypetd)));
        }

        var onClick = function (e) {
            if (btn.innerText != 'BROADCAST') {
                btn.innerText = 'BROADCAST';
                rippleElement.hidden = true;
                logoImage.hidden = false;
                return;
            }

            var ssid = encoder.encode(ssidInput.value);
            var password = encoder.encode(passwordInput.value);

            if (ssid) {
                btn.innerText = 'STOP';
                logoImage.hidden = true;
                rippleElement.hidden = false;
                devicesTable.hidden = true;
                devices = []

                payload = new Uint8Array(1 + ssid.length + 1 + password.length + 2);
                payload[0] = ssid.length;
                payload.set(ssid, 1);
                payload[1 + ssid.length] = password.length;
                payload.set(password, 1 + ssid.length + 1);
                payload[1 + ssid.length + 1 + password.length] = channel & 0xFF;
                payload[1 + ssid.length + 1 + password.length + 1] = channel >> 8;

                console.log('tx: ', array2str(payload), payload);

                var onFinish = function () {
                    if (btn.innerText != 'BROADCAST') {
                        setTimeout(function () {
                            if (btn.innerText != 'BROADCAST') {
                                console.log('repeat', payload);
                                window.transmit.transmit(payload);
                            }
                        }, 1000);
                    } else {
                        console.log('finished');
                    }
                };

                if (!window.transmit) {
                    window.transmit = Quiet.transmitter({ profile: 'wave', onFinish: onFinish, clampFrame: false });
                }
                window.transmit.transmit(payload);
            }
        };

        btn.addEventListener('click', onClick, false);
        btn.disabled = true;

        var onQuietReady = function () {
            btn.disabled = false;
            ringElement.hidden = true;
            logoImage.hidden = false;
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
                    html = html + `<tr><td>${i}</td><td><a target="_blank" href="http://${devices[i]}">${devices[i]}</a></td></tr>`;

                }
                devicesElement.innerHTML = html;
                devicesTable.hidden = false;
            }
        }

        var clientId = Math.random().toString().substring(2);
        console.log(clientId);
        var client = new Paho.Client("q.voicen.io", Number(443), "/ws", clientId);
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect({ onSuccess: onConnect, useSSL: true, keepAliveInterval: 50 });
        function onConnect() {
            console.log("onConnect");
            client.subscribe(`/voicen/hey_wifi/${channel}`);
            // payload = str2array('xyz');
            // var data = JSON.stringify({ id: channel, data: '10.10.10.10' });
            // encrypt(channel, payload, data).then(encrypted => {
            //     console.log(encrypted, data);
            //     var message = new Paho.Message(encrypted);
            //     message.destinationName = `/voicen/hey_wifi/${channel}`;
            //     client.send(message);
            // });
        }
        function onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log("onConnectionLost:" + responseObject.errorMessage);
                setTimeout(function () {
                    client.connect({ onSuccess: onConnect, useSSL: true, keepAliveInterval: 50 });
                }, 1000);
            }
        }
        function onMessageArrived(message) {
            console.log("onMessageArrived:" + message.payloadString);
            if (!payload) {
                return;
            }

            decrypt(channel, payload, message.payloadString).then(decrypted => {
                console.log(decrypted);
                try {
                    var data = JSON.parse(decrypted);
                    var value = data['data'];
                } catch (e) {
                    console.log(e)
                    return;
                }
                var ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (value.match(ipformat)) {
                    if (devices.indexOf(value) < 0) {
                        devices.push(value);
                        showDevices(devices);
                    }
                }
            });
        }
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
