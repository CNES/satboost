#!/usr/bin/env python3

#
# Copyright (c) Viveris Technologies.
# Licensed under the MIT license. See LICENSE file in the project root for details.
#

# kivy modules
import kivy
kivy.require('1.11.0')
from kivy.app import App
from kivy.lang import Builder
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.clock import Clock, mainthread
from kivy.uix.gridlayout import GridLayout
from kivy.properties import NumericProperty

# Android monitoring modules
import threading
import android_monitoring

# Controller modules
import re
import os
import glob
import json
import time
import socket
import subprocess
import urllib.parse
from threading import Thread, Lock
from http.server import HTTPServer, BaseHTTPRequestHandler


PORT = 8123
URL_PARAMS = {'type': ['tsValues', 'tsConf', 'plt'],
              'action': ['clearTrafficStats', 'applyProfile', 'setConf']}


class HttpHandler(BaseHTTPRequestHandler):
    # List of detailed PLTs
    plt = []

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
                'downlinkRate': daemon.monitor.rates['downlink'],
                'uplinkRate': daemon.monitor.rates['uplink'],
                'downlinkData': daemon.monitor.data['downlink'],
                'uplinkData': daemon.monitor.data['uplink']
            }).encode())
        elif http_params['type'] == 'tsConf':
            self.wfile.write(json.dumps(daemon.monitor.settings).encode())

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

        # PLT processing
        if http_params['type'] == 'plt':
            if len(self.plt) == 1000:
                self.plt.pop(0)
            self.plt.append(data)
            # Send through UDP socket
            if broadcast:
                udp_socket.sendto(body.encode(), (broadcast['ip'], broadcast['port']))

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
            daemon.monitor.clear_traffic_stats()
        # Set configuration for data consumption counting
        elif action == 'setConf':
            body = self.get_body()
            settings = json.loads(body)
            granularity = float(settings['granularity'])
            if not 'enable' in settings['broadcast'].keys():
                settings['broadcast'] = {}
            else:
                settings['broadcast'].pop('enable')
                settings['broadcast']['port'] = int(settings['broadcast']['port'])

            daemon.set_broadcast(settings['broadcast'])
            daemon.monitor.set_broadcast(settings['broadcast'])
            daemon.monitor.settings = settings
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
    def __init__(self, granularity=1, broadcast={}):
        self.monitor = android_monitoring.AndroidMonitoring(granularity, broadcast)
        self.monitor_t = Thread(target=self.monitor.start)

    def set_broadcast(self, params):
        global broadcast, udp_socket
        broadcast = params
        if params:
            udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        elif udp_socket:
            udp_socket.close()

    def start_monitoring(self):
        if not self.monitor_t.is_alive():
            self.monitor_t = Thread(target=self.monitor.start)
        self.monitor_t.start()

    def stop_monitoring(self):
        self.monitor.stop()
        self.monitor_t.join()


Builder.load_string("""
<DaemonForAndroid>:
    cols: 1
    but_1: but_1
    lab_1: lab_1

    Label:
        id: lab_1
        text: 'SATboost Daemon'
    Button:
        id: but_1
        text: 'Click to start the daemon'
""")


class DaemonForAndroid(GridLayout):
    def __init__(self, **kwargs):
        super(DaemonForAndroid, self).__init__(**kwargs)
        self.but_1.bind(on_release=self.start_daemon_thread)

    def start_daemon_thread(self, *args):
        global daemon, server
        daemon = Controller(broadcast=broadcast)
        server = HTTPServer(('0.0.0.0', PORT), HttpHandler)
        threading.Thread(target=self.start_daemon).start()

    def start_daemon(self, *args):
        self.prepare_button_to_stop()
        print('Daemon : starting monitoring')
        daemon.start_monitoring()
        print('Daemon : Starting HTTP Server on port ', PORT)
        server.serve_forever()

    def stop_daemon(self, *args):
        self.prepare_button_to_start()
        print('Stopping server')
        server.server_close()
        server.shutdown()
        print('Stopping monitoring')
        daemon.stop_monitoring()

    @mainthread
    def prepare_button_to_stop(self, *args):
        self.but_1.text = 'Daemon is running. Click to STOP it.'
        self.but_1.unbind(on_release=self.start_daemon_thread)
        self.but_1.bind(on_release=self.stop_daemon)

    @mainthread
    def prepare_button_to_start(self, *args):
        self.but_1.text = 'Daemon is stopped. Click to START it.'
        self.but_1.unbind(on_release=self.stop_daemon)
        self.but_1.bind(on_release=self.start_daemon_thread)


class MyApp(App):
    def build(self):
        return DaemonForAndroid()
    

# Global variables
daemon = None
server = None
udp_socket = None
broadcast = {}

if __name__ == '__main__':
    MyApp().run()

