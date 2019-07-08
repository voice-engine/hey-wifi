#!/usr/bin/python3
# -*- coding: utf-8 -*-

import os
import sys
import time

if sys.version_info[0] < 3:
    import Queue as queue
else:
    import queue

import base64
import hashlib
import json
import threading
import signal
import subprocess
import random

import numpy as np
from Cryptodome.Cipher import AES
from Cryptodome.Util import Counter
import quiet
from voice_engine.source import Source


PROFILES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'quiet-profiles.json')


class Decoder(object):
    def __init__(self, channels=1, select=0, bits_per_sample=16):
        self.channels = channels
        self.select = select
        self.done = None
        self.thread = None
        self.queue = queue.Queue()
        if bits_per_sample == 16:
            self.dtype = np.int16
        elif bits_per_sample == 32:
            self.dtype = np.int32
        else:
            raise ValueError('{} bits per sample is not supported'.format(bits_per_sample))

    def start(self):
        self.done = False
        if not (self.thread and self.thread.is_alive()):
            self.thread = threading.Thread(target=self.run)
            self.thread.start()

    def put(self, data):
        self.queue.put(data)

    def run(self):
        decoder = quiet.Decoder(sample_rate=48000, profile_name='wave', profiles=PROFILES)

        while not self.done:
            audio = self.queue.get()
            audio = np.fromstring(audio, dtype=self.dtype)
            if self.channels > 1:
                audio = audio[self.select::self.channels]
            audio = audio.astype('float32')
            data = decoder.decode(audio)
            if data is not None:
                self.on_data(data)


    def stop(self):
        self.done = True
        self.queue.put('')
        if self.thread and self.thread.is_alive():
            self.thread.join()

    def on_data(self, data):
        print(data)


def get_ip_info():
    ip_info = subprocess.check_output(r"ip a | sed -ne '/127.0.0.1/!{s/^[ \t]*inet[ \t]*\([0-9.]\+\)\/.*$/\1/p}'", shell=True)
    ip_info = ip_info.strip()
    # return ip_info.split('\n')
    return ip_info


def encrypt(key, data):
    m = hashlib.md5()
    m.update(data)
    counter = random.SystemRandom().randint(0, 1 << 15)
    aes = AES.new(m.digest(), AES.MODE_CTR, counter=Counter.new(128, initial_value=counter))
    encrypted = aes.encrypt(data)
    return { 'id': counter, 'data': base64.b64encode(encrypted).decode() }


def main():
    src = Source(rate=48000, channels=4, device_name='ac108', bits_per_sample=32)
    decoder = Decoder(channels=src.channels, select=0, bits_per_sample=32)

    def on_data(data):
        ssid_length = data[0]
        ssid = data[1:ssid_length+1].tostring().decode('utf-8')
        password_length = data[ssid_length+1]
        password = data[ssid_length+2:ssid_length+password_length+2].tostring().decode('utf-8')
        print('SSID: {}\nPassword: {}'.format(ssid, password))

        if os.system('which nmcli >/dev/null') != 0:
            print('nmcli is not found')
            return

        cmd = 'nmcli device wifi rescan'
        os.system(cmd)
        
        cmd = 'nmcli connection delete "{}"'.format(ssid)
        os.system(cmd)
        
        cmd = 'nmcli device wifi connect {} password {}'.format(ssid, password)
        if os.system(cmd) != 0:
            print('Failed to connect the Wi-Fi network')
            return

        print('Wi-Fi is connected')
        ip_info = get_ip_info()
        if not ip_info:
            print('Not find any IP address')
            return

        print(ip_info)
        decoder.done = True

        message = encrypt(data, ip_info)
        if os.system('which mosquitto_pub >/dev/null') != 0:
            print('mosquitto_pub is not found')

        cmd = "mosquitto_pub -h iot.eclipse.org -t '/voicen/channel' -m '{}'".format(json.dumps(message))
        print(cmd)
        if os.system(cmd) != 0:
            print('Failed to send message to the web page')
            return

        print('Done')


    decoder.on_data = on_data

    src.pipeline(decoder)
    src.pipeline_start()

    while not decoder.done:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            print('exit')
            break

    src.pipeline_stop()


if __name__ == '__main__':
    main()
    