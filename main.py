

import os
import sys
import time

if sys.version_info[0] < 3:
    import Queue as queue
else:
    import queue

import threading
import signal

import numpy as np
import quiet
from voice_engine.source import Source


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
            raise ValueError('bits per sample not supported')

    def start(self):
        self.done = False
        if not (self.thread and self.thread.is_alive()):
            self.thread = threading.Thread(target=self.run)
            self.thread.start()

    def put(self, data):
        self.queue.put(data)

    def run(self):
        decoder = quiet.Decoder(sample_rate=48000, profile_name='wave', profiles='quiet-profiles.json')

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


def main():
    src = Source(rate=48000, channels=4, device_name='ac108', bits_per_sample=32)
    decoder = Decoder(channels=src.channels, select=0, bits_per_sample=32)


    def on_data(data):
        ssid_length = data[0]
        ssid = data[1:ssid_length+1].tostring().decode('utf-8')
        password_length = data[ssid_length+1]
        password = data[ssid_length+2:ssid_length+password_length+2].tostring().decode('utf-8')
        print('SSID: {}\nPassword: {}'.format(ssid, password))

        if os.system('which nmcli >/dev/null') == 0:
            cmd = 'nmcli device wifi rescan'
            os.system(cmd)
            
            cmd = 'nmcli connection delete "{}"'.format(ssid)
            os.system(cmd)
            
            cmd = 'nmcli device wifi connect {} password {}'.format(ssid, password)
            if os.system(cmd) == 0:
                print('Wi-Fi is connected')
                decoder.done = True
            else:
                print('Failed')
        else:
            print('to do')


    # def int_handler(sig, frame):
    #     listener.stop()
    #signal.signal(signal.SIGINT, int_handler)

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
    