Hey, WiFi
=========

![](https://voice-engine.github.io/hey-wifi/img/scenario.svg)

Send WiFi settings through sound wave.
The project is based on [quiet](https://github.com/quiet)

### Supported Hardware
+ [VOICEN Linear 4 Mic Array Kit](https://www.makerfabs.com/voicen-linear-4-mic-array-kit.html)
+ Raspberry Pi (with NetworkManager utils)

### Requirements
+ quiet.py
+ numpy
+ voice-engine
+ pycryptodome

```
sudo apt install python3-numpy python3-pycryptodome
pip3 install voice-engine
pip3 install --no-deps quiet.py    # for ARM platform
```

>For x86, go to https://github.com/xiongyihui/quiet.py to install `quiet.py`

### Demo
1. run `main.py` on your device
2. go to https://voice-engine.github.io/hey-wifi/ using a computer or a phone
