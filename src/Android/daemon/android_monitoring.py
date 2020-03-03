#!/usr/bin/env python3

#
# Copyright (c) Viveris Technologies.
# Licensed under the MIT license. See LICENSE file in the project root for details.
#

import time
import socket
import datetime
import threading
from jnius import autoclass


LINKS = ('downlink', 'uplink')


class AndroidMonitoring(object):

    def __init__(self, granularity, broadcast):
        self._offsets = dict()
        self.rates = dict()
        self.data = dict()
        self.settings = dict()  # Manage counting, alerting, and broadcasting settings
        self._shutdown = False
        self._udp_socket = None
        # Attributes to manage the interval data counting
        self._base = dict()
        self._extra = dict()
        self._counting = True
        self._init_dicts(granularity, broadcast)

    # Get traffic stats using Android API
    def get_stats(self):
        stats = {}
        TrafficStats = autoclass('android.net.TrafficStats')
        stats['downlink'] = int(TrafficStats.getTotalRxBytes()) * 8
        stats['uplink'] = int(TrafficStats.getTotalTxBytes()) * 8
        return stats

    def _init_dicts(self, granularity=None, broadcast={}, keep_settings=False):
        if not keep_settings:
            self.settings['count'] = {'interval': 'always', 'start-time': '', 'end-time': ''}
            self.settings['granularity'] = granularity
            self.settings['broadcast'] = {}
            if broadcast:
                self.settings['broadcast'] = broadcast
                self._udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        for link in LINKS:
            self._base[link] = 0
            self._extra[link] = 0
            self.rates[link] = 0  # Prevent exception if plugin is started before daemon
            self.data[link] = 0  # Prevent exception if plugin is started before daemon
        self._offsets = self.get_stats()

    def set_broadcast(self, broadcast):
        self.settings['broadcast'] = broadcast
        if broadcast:
            self._udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        elif self._udp_socket:
            self._udp_socket.close()

    def _can_count(self):
        if self.settings['count']['interval'] == 'limited':
            now = datetime.datetime.now().time()
            start_time = datetime.datetime.strptime(self.settings['count']['start-time'], '%H:%M').time()
            end_time = datetime.datetime.strptime(self.settings['count']['end-time'], '%H:%M').time()
            if (now < start_time) or (now > end_time):
                return False
        return True

    def stop(self):
        self._shutdown = True

    def clear_traffic_stats(self):
        self._init_dicts(keep_settings=True)

    def monitor(self, mutex, previous):
        bits_count = dict()

        # Get the stats
        timestamp = int(time.perf_counter() * 1000)
        stats = self.get_stats()
        for link in LINKS:
            bits_count[link] = stats[link] - self._offsets[link]

        # Get previous stats and update them
        with mutex:
            previous_timestamp, previous_bits_count = previous
            previous[:] = timestamp, bits_count
    
        diff_timestamp = (timestamp - previous_timestamp) / 1000  # in seconds

        # Store the rates stats
        for link in LINKS:
            self.rates[link] = int((bits_count[link] - previous_bits_count[link]) / diff_timestamp)

        # Check counting interval and store data stats if OK
        if not self._can_count():  # Out of interval
            if not self._counting:  # It wasn't counting already, do nothing ...
                return
            # It was counting before this loop
            for link in LINKS:
                self._extra[link] = bits_count[link]
                self.data[link] = self._extra[link] + self._base[link]
                self._base[link] += self._extra[link]
            self._counting = False
            return

        if not self._counting:
            # Enter inside the interval
            self._counting = True
            # Reset offset
            self._offsets = self.get_stats()
            return

        # Inside the interval
        for link in LINKS:
            self._extra[link] = bits_count[link]
            self.data[link] = self._extra[link] + self._base[link]

        line = '{}:     {}     {}     {}     {}\n'.format(timestamp, self.rates['downlink'], self.rates['uplink'], self.data['downlink'], self.data['uplink'])

        # Send stats
        if self.settings['broadcast']:
            self._udp_socket.sendto(line.encode(), (self.settings['broadcast']['ip'], self.settings['broadcast']['port']))

    def start(self):
        print('Start Monitoring')
        # Save the first stats for computing the rate
        mutex = threading.Lock()
        counters = self.get_stats()
        for link in LINKS:
            counters[link] -= self._offsets[link]

        previous = [int(time.perf_counter() * 1000), counters]
    
        # Monitoring
        while not self._shutdown:
            time.sleep(float(self.settings['granularity']))
            self.monitor(mutex, previous)
