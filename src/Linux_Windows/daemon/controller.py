#!/usr/bin/env python3

#
# Copyright (c) Viveris Technologies.
# Licensed under the MIT license. See LICENSE file in the project root for details.
#

__author__ = 'Viveris Technologies'
__credits__ = '''Contributors:
 * David FERNANDES <david.fernandes@toulouse.viveris.com>
'''

import re
import os
import glob
import json
import time
import signal
import socket
import argparse
import subprocess
import urllib.parse
from platform import system
from functools import partial
from threading import Thread, Lock
from http.server import HTTPServer, BaseHTTPRequestHandler

SYSTEM = system()
PORT = 8123
URL_PARAMS = {'type': ['tsValues', 'tsConf', 'ytStats', 'plt'],
              'action': ['clearTrafficStats', 'clearYtStats', 'applyProfile', 'setConf']}

if SYSTEM == 'Windows':
    import wmonitoring as monitoring
    PLATFORM_SEPARATOR = '\\'
else:
    import monitoring
    PLATFORM_SEPARATOR = '/'


def signal_handler(daemon, signal, frame):
    daemon.stop()
    print('Daemon stopped')


# Get string representation of JS boolean
def get_js_bool(boolean):
    if boolean:
        return 'true'
    else:
        return 'false'


# Write firefox parameter settings in user.js
def set_profile_params(params):
    try:
        if SYSTEM == 'Windows':
            path = '~\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\*.default*\\'
        else:
            path = '~/.mozilla/firefox/*.default/'
        default_dir = glob.glob(os.path.expanduser(path))[0]
        filepath = os.path.join(default_dir, 'user.js')
        with open(filepath, 'w') as openfile:
            for param, value in params.items():
                if type(value) is str:
                    line = 'user_pref("{}", "{}");\n'.format(param, value)
                elif type(value) is bool:
                    line = 'user_pref("{}", {});\n'.format(param, get_js_bool(value))
                else:
                    line = 'user_pref("{}", {});\n'.format(param, value)
                openfile.write(line)
    except IndexError:
        print('Error: default Firefox profile directory does not exist')


# Set uid and guid. Useful to start Firefox as regular user.
def demote(user_uid, user_gid):
    def set_ids():
        os.setpgrp()  # Don't forward signals
        os.setgid(user_gid)
        os.setuid(user_uid)

    return set_ids


# Remove unnecessary characters. Useful to write and broadcast stats as integers instead of strings.
def format_youtube_stats(youtube_stats):
    formatted = dict(youtube_stats)
    formatted['sentFrames'] = None
    for stat in formatted.keys():
        if stat in ('currentRes', 'optimalRes'):
            value = formatted[stat]
            match = re.search('x([0-9]+)@', value)
            formatted[stat] = match.group(1)
            match = re.search('x([0-9]+)@', value)
            formatted[stat] = match.group(1)
        elif stat == 'connectionSpeed':
            formatted[stat] = formatted[stat][:-5]
        elif stat == 'networkActivity':
            formatted[stat] = formatted[stat][:-3]
        elif stat == 'bufferHealth':
            formatted[stat] = formatted[stat][:-2]
        elif stat == 'droppedFrames':
            dropped, sent = formatted[stat].split('/')
            formatted[stat] = dropped
            formatted['sentFrames'] = sent
    return formatted


class HttpHandler(BaseHTTPRequestHandler):
    """
    ## YouTube Stats units list ##
        - Current Resolution:   ppp
        - Optimal Resolution:   ppp
        - Connection Speed:     Kbps
        - Network Activity:     KB
        - Buffer Health:        seconds
    """
    # List of detailed PLT
    plt = []

    # Dict to store YouTube Stats as example.
    # Stats will be sent to any REST API in the future.
    youtube_stats = {'freezings': 0}

    # _youtube_state represents last state of player used for freezings counting :
    # state => 'OK' : Not freezed, 'NOK': freezed
    # s_mt => last value of mystery text status code
    # playing_ad: true if it's playing an advertisement
    _youtube_state = {'state': 'OK', 's_mt': '', 'playing_ad': False}

    # Access to the controller stats and methods
    ctlr = None

    # Helper method to set status code and common headers
    def set_status_and_headers(self, code):
        # Set response code
        self.send_response(code)
        # Set response headers
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    # Helper method to get body of request
    def get_body(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length).decode()
        return body

    # Helper method to get variables passed in the URL
    def get_url_params(self):
        parsed_path = urllib.parse.urlparse(self.path)
        http_params = urllib.parse.parse_qs(parsed_path.query)
        for param, values in http_params.items():
            http_params[param] = values[0]
        return http_params

    # Helper method to check URL has the right parameters
    def check_url_params(self, http_params):
        return 'type' in http_params and http_params['type'] in URL_PARAMS['type']

    # Handler for GET requests
    def do_GET(self):
        # Check URL parameters
        http_params = self.get_url_params()
        right_params = self.check_url_params(http_params)
        if not right_params:
            print('Error : URL has invalid parameters.')
            self.set_status_and_headers(400)
            return
        self.set_status_and_headers(200)
        # Set response body according to the 'type' of the request
        if http_params['type'] == 'tsValues':
            self.wfile.write(json.dumps({
                'downlinkRate': HttpHandler.ctlr.monitor.rates['downlink'],
                'uplinkRate': HttpHandler.ctlr.monitor.rates['uplink'],
                'downlinkData': HttpHandler.ctlr.monitor.data['downlink'],
                'uplinkData': HttpHandler.ctlr.monitor.data['uplink']
            }).encode())
        elif http_params['type'] == 'tsConf':
            self.wfile.write(json.dumps(HttpHandler.ctlr.monitor.settings).encode())
        elif http_params['type'] == 'ytStats':
            freezings = {'freezings': self.youtube_stats['freezings']}
            self.wfile.write(json.dumps(freezings).encode())

    # Handler for POST requests
    def do_POST(self):
        # Get body and parse as JSON
        body = self.get_body()
        data = json.loads(body)

        # Check URL parameters
        http_params = self.get_url_params()
        right_params = self.check_url_params(http_params)
        if not right_params:
            print('Error : URL has invalid parameters.')
            self.set_status_and_headers(400)
            return

        # Process according to the 'type' of the request
        # PLT processing
        if http_params['type'] == 'plt':
            if len(self.plt) == 1000:
                self.plt.pop(0)
            self.plt.append(data)
            # Send through UDP socket
            if args.broadcast:
                udp_sock.sendto(body.encode(), (args.destip, args.destport))

        # YouTube Stats Processing
        elif http_params['type'] == 'ytStats':
            # Check potential freezings
            # Parse Buffer Health
            bh = data['bufferHealth']
            re_bh = re.search('([0-9]+\.[0-9]+) s', bh)
            bh = float(re_bh.group(1))
            # Parse Mystery Text
            mt = data['mysteryText']
            re_mt = re.search('s:([0-9]*) t:(.+) b:(.+)', mt)
            try:
                s_mt = int(re_mt.group(1))
            except AttributeError:
                # Youtube video is not yet started
                # Then the status code is not valid
                pass
            else:
                # Regular freeze happens. Freezings due to ads are not counted.
                # (Other types of freezings are not counted for the moment...)
                if (s_mt == 9 and bh < 1 and self._youtube_state['state'] == 'OK'
                        and self._youtube_state['playing_ad'] == data['isPlayingAd']
                        and self._youtube_state['s_mt'] == 8):
                    self.youtube_stats['freezings'] += 1
                    self._youtube_state['state'] = 'NOK'
            # Displaying is no longer freezed
            if bh > 1 and self._youtube_state['state'] == 'NOK':
                self._youtube_state['state'] = 'OK'
            # Store YouTube stats in class variable
            # Code can be adapted to send stats to any REST API instead
            for stat, value in data.items():
                self.youtube_stats[stat] = value

            # Update youtube state
            self._youtube_state['playing_ad'] = data['isPlayingAd']
            try:
                self._youtube_state['s_mt'] = s_mt
            except NameError:
                # Youtube video is not yet started
                # Status code hasn't be retrieved
                pass

            self.set_status_and_headers(200)

            if not args.write and not args.broadcast:
                return
            
            timestamp = int(time.perf_counter() * 1000)
            format_stats = format_youtube_stats(self.youtube_stats)
            try:
                line = '{}:     {currentRes}     {optimalRes}     {connectionSpeed}     {networkActivity}     {bufferHealth}     {freezings}     {droppedFrames}     {sentFrames}\n'.format(timestamp, **format_stats)
            except Exception as ex:
                print('ERROR : {}'.format(ex))
                return

            # Write the stats in a file
            if args.write:
                ys_file = open('{}youtube_stats.dat'.format(args.write), 'a')
                ys_file.write(line)
                ys_file.close()

            # Send stats
            if args.broadcast:
                udp_sock.sendto(line.encode(), (args.destip, args.destport))

    # Handler for PUT requests
    def do_PUT(self):
        # Check URL parameters
        http_params = self.get_url_params()
        if (not 'action' in http_params or
                not http_params['action'] in URL_PARAMS['action']):
            print('Error : URL has invalid parameters.')
            self.set_status_and_headers(400)
            return
        action = http_params['action']
        # Clear traffic stats
        if action == 'clearTrafficStats':
            HttpHandler.ctlr.monitor.clear_traffic_stats()
        # Clear Youtube stats (freezings)
        elif action == 'clearYtStats':
            self.youtube_stats['freezings'] = 0
        # Apply Optimization profile
        elif action == 'applyProfile':
            # Get body and parse as JSON
            body = self.get_body()
            params = json.loads(body)
            # Apply profile parameters
            HttpHandler.ctlr.apply_profile(params)
        # Set configuration for data consumption counting
        elif action == 'setConf':
            body = self.get_body()
            settings = json.loads(body)
            granularity = float(settings['granularity'])
            if granularity != HttpHandler.ctlr.monitor.settings['granularity']:
                HttpHandler.ctlr.monitor._scheduler.reschedule_job(
                    'monitoring', trigger='interval', seconds=granularity)

            if not 'enable' in settings['broadcast'].keys():
                settings['broadcast'] = {}
            else:
                settings['broadcast'].pop('enable')
                settings['broadcast']['port'] = int(settings['broadcast']['port'])

            HttpHandler.ctlr.set_broadcast(settings['broadcast'])
            HttpHandler.ctlr.monitor.set_broadcast(settings['broadcast'])
            HttpHandler.ctlr.monitor.settings = settings
        else:
            self.set_status_and_headers(400)
            return

        self.set_status_and_headers(200)

    # Handler for OPTIONS requests
    # Necessary due to CORS issues
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Accept,Origin')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()


class Controller(object):

    def __init__(self, args):
        self.monitor = monitoring.Monitoring(args)
        self.monitor_t = Thread(target=self.monitor.start)
        self.server = None
        self.server_t = None
        self._init_server()
        self._reset_files(args.write)

    def _reset_files(self, path):
        if path is not None:
            ts_file = open('{}traffic_stats.dat'.format(path), 'w')
            ts_file.write('timestamp:     download_rate(b/s)     upload_rate(b/s)     download_data(bits)     upload_data(bits)\n')
            ts_file.close()
            ys_file = open('{}youtube_stats.dat'.format(path), 'w')
            ys_file.write('timestamp:     current_resolution     optimal_resolution     connection_speed(Kbps)     network_activity(KB)     buffer_health(s)     freezings     total_sent_frames     dropped_frames\n')
            ys_file.close()

    def _init_server(self):
        self.server = HTTPServer(('0.0.0.0', PORT), HttpHandler)
        HttpHandler.ctlr = self
        self.server_t = Thread(target=self.server.serve_forever)

    def set_broadcast(self, broadcast):
        global args, udp_sock
        if broadcast:
            args.broadcast = True
            args.destip = broadcast['ip']
            args.destport = broadcast['port']
            udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        elif udp_sock:
            args.broadcast = False
            udp_sock.close()

    def run(self):
        self.monitor_t.start()
        self.server_t.start()

    def stop(self):
        self.monitor.stop()
        self.server.shutdown()
        self.server.socket.close()
        self.monitor_t.join()
        self.server_t.join()

    def apply_profile(self, params):
        # Write parameters settings in user.js
        set_profile_params(params)
        # Restart Firefox
        if SYSTEM == 'Windows':
            cmd_kill = ['taskkill', '/IM', 'firefox.exe']
            cmd_start = '"C:\\Program Files\\Mozilla Firefox\\firefox.exe"'
        else:
            cmd_kill = ['killall', 'firefox']
            cmd_start = ['firefox']

        p = subprocess.run(cmd_kill)
        if p.returncode:
            message = 'WARNING: \'{}\' returned non-zero code'.format(' '.join(cmd_kill))
            print(message)
        time.sleep(1)

        if SYSTEM == 'Windows':
            p = subprocess.Popen(cmd_start)
        else:
            sudo_uid = int(os.getenv('SUDO_UID'))
            sudo_gid = int(os.getenv('SUDO_GID'))
            # Start Firefox as regular user
            p = subprocess.Popen(cmd_start, preexec_fn=demote(sudo_uid, sudo_gid))

        if p.returncode:
            message = 'WARNING: \'{}\' returned non-zero code'.format(' '.join(cmd_start))
            print(message)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument(
        '-i', '--interval', type=float, default=1,
        help='The monitoring interval')
    parser.add_argument(
        '-w', '--write', type=str,
        help='The directory to save the stats')
    parser.add_argument(
        '-b', '--broadcast', action='store_true',
        help='Flag to send the stats to a destination UPD IP/port')
    parser.add_argument(
        '-d', '--destip', type=str, default='127.0.0.1',
        help='Destination IP to send the stats to')
    parser.add_argument(
        '-p', '--destport', type=int, default=8321,
        help='Destination port to send the stats to')

    args = parser.parse_args()

    if args.write and args.write[-1:] is not PLATFORM_SEPARATOR:
        args.write += PLATFORM_SEPARATOR

    if args.broadcast:
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    else:
        udp_sock = None

    # Create a daemon which calculates traffic stats every 1 second by default
    daemon = Controller(args)
    # Start the monitoring daemon
    daemon.run()
    signal.signal(signal.SIGTERM, partial(signal_handler, daemon))
    signal.signal(signal.SIGINT, partial(signal_handler, daemon))

