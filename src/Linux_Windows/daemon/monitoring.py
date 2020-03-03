#!/usr/bin/env python3

#
# Copyright (c) Viveris Technologies.
# Licensed under the MIT license. See LICENSE file in the project root for details.
#


__author__ = 'Viveris Technologies'
__credits__ = '''Contributors:
 * Adrien THIBAUD <adrien.thibaud@toulouse.viveris.com>
 * Mathias ETTINGER <mathias.ettinger@toulouse.viveris.com>
 * Joaquin MUGUERZA <joaquin.muguerza@toulouse.viveris.com>
 * David FERNANDES <david.fernandes@toulouse.viveris.com>
'''

import time
import socket
import datetime
import threading

import iptc
from apscheduler.schedulers.blocking import BlockingScheduler


CHAINS_NAMES = ('INPUT', 'OUTPUT')
LINKS = ('downlink', 'uplink')


class Monitoring(object):

    def __init__(self, args):
        self._directory = args.write  # Directory to save the stats
        self.rates = dict()
        self.data = dict()
        self.settings = dict()  # Manage granularity, counting, alerting and broadcasting settings
        self._chains = dict()
        self._rules = dict()
        self._shutdown = False
        self._scheduler = None
        self._udp_socket = None
        # Attributes to manage the interval data counting
        self._base = dict()
        self._extra = dict()
        self._counting = True
        self._init_dicts(args)

    def _init_dicts(self, args=None, keep_settings=False):
        if not keep_settings:
            self.settings['count'] = {'interval': 'always', 'start-time': '', 'end-time': ''}
            self.settings['granularity'] = args.interval
            self.settings['broadcast'] = {}
            if args.broadcast:
                self.settings['broadcast']['ip'] = args.destip
                self.settings['broadcast']['port'] = args.destport
                self._udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        for link in LINKS:
            self._base[link] = 0
            self._extra[link] = 0
            self.rates[link] = 0  # Prevent exception if plugin is started before daemon
            self.data[link] = 0  # Prevent exception if plugin is started before daemon
        
    def set_broadcast(self, broadcast):
        self.settings['broadcast'] = broadcast
        if broadcast:
            self._udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        elif self._udp_socket:
            self._udp_socket.close()
    
    def _create_rules(self):
        table = iptc.Table(iptc.Table.FILTER)
        for chain in table.chains:
            if chain.name in CHAINS_NAMES:
                self._chains[chain.name] = chain
                # Creation of the Rules
                self._rules[chain.name] = iptc.Rule(chain=self._chains[chain.name])
                # Add the Target
                self._rules[chain.name].create_target('')
                self._chains[chain.name].insert_rule(self._rules[chain.name])
        print('Added iptables rules for monitoring')

    def _delete_rules(self):
        for chain_name, chain in self._chains.items():
            chain.delete_rule(self._rules[chain_name])

    def _reset_iptables(self):
        self._delete_rules()
        self._create_rules()

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
        self._reset_iptables()
        self._init_dicts(keep_settings=True)

    def monitor(self, mutex, previous):
        if self._shutdown:
            self._scheduler.shutdown(wait=False)
            return

        bits_count = dict()
        rates = dict()
        # Refresh the table (allowing to update the stats)
        table = iptc.Table(iptc.Table.FILTER)
        table.refresh()

        # Get the rules (Attention, the rules shall be in first position)
        for chain in CHAINS_NAMES:
            self._rules[chain] = self._chains[chain].rules[0]
    
        # Get the stats
        timestamp = int(time.perf_counter() * 1000)
        for chain in CHAINS_NAMES:
            bits_count[chain] = self._rules[chain].get_counters()[1] * 8
    
        # Get previous stats and update them
        with mutex:
            previous_timestamp, previous_bits_count = previous
            previous[:] = timestamp, bits_count
    
        diff_timestamp = (timestamp - previous_timestamp) / 1000  # in seconds

        for chain in CHAINS_NAMES:
            rates[chain] = (bits_count[chain] - previous_bits_count[chain]) / diff_timestamp
    
        # Store the rates stats
        self.rates['downlink'] = int(rates['INPUT'])
        self.rates['uplink'] = int(rates['OUTPUT'])

        # Check counting interval and store data stats if OK
        if not self._can_count():  # Out of interval
            if not self._counting:  # It wasn't counting already, do nothing ...
                return
            # It was counting before this loop
            self._extra['downlink'] = bits_count['INPUT']
            self._extra['uplink'] = bits_count['OUTPUT']
            for link in LINKS:
                self.data[link] = self._extra[link] + self._base[link]
                self._base[link] += self._extra[link]
            self._counting = False
            return

        if not self._counting:
            # Enter inside the interval
            self._counting = True
            self._reset_iptables()
            return

        # Inside the interval
        self._extra['downlink'] = bits_count['INPUT']
        self._extra['uplink'] = bits_count['OUTPUT']
        for link in LINKS:
            self.data[link] = self._extra[link] + self._base[link]
            
        line = '{}:     {}     {}     {}     {}\n'.format(timestamp, self.rates['downlink'], self.rates['uplink'], self.data['downlink'], self.data['uplink'])

        # Write the stats in the file
        if self._directory:
            ts_file = open('{}traffic_stats.dat'.format(self._directory), 'a')
            ts_file.write(line)
            ts_file.close()

        # Send stats
        if self.settings['broadcast']:
            self._udp_socket.sendto(line.encode(), (self.settings['broadcast']['ip'], self.settings['broadcast']['port']))

    def start(self):
        print('Start Monitoring')
        counters = {}
        # Create the rules
        self._create_rules()
        # Save the first stats for computing the rate
        mutex = threading.Lock()
        for chain in CHAINS_NAMES:
            counters[chain] = self._rules[chain].get_counters()[1]

        previous = [int(time.perf_counter() * 1000), counters]
    
        # Monitoring
        interval = self.settings['granularity']
        self._scheduler = BlockingScheduler()
        self._scheduler.add_job(
                self.monitor, 'interval',
                seconds=interval, id='monitoring',
                args=(mutex, previous))
        self._scheduler.start()
        # Delete the rules
        self._delete_rules()
