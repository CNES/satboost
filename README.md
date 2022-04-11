# SATboost Add-on

Multiplatform Firefox Add-on allowing to:

* Check the quota used by the machine (bits and bits/s)
* Collect QoE measurements for satellite/access providers and users: Page Load Time (and other W3C metrics) and YouTube metrics.
* Customise HTTP parameters for clients and enable Web Boost feature (from http://webboost.fse.guru/).

The add-on has proved to reduce Page Load Time down to 30-50% on a real satellite access, mainly thanks to Web Boost.
The plugin can be used on Linux, Windows and Android OS. The Linux and Windows versions include all the features while the Android version does not include the Youtube metrics.

This plugin is a PoC (Proof of Concept) resulting from an R&D project. Check LICENSE.md for further information about the guarantees provided.

## Add-on Features

You find below the complete list of features:

* Collected QoS metrics:
  - Upload/download rate (bits/s)
  - Data volume/consumption (bits)
* Collected QoS metrics:
  - Web browsing: Page Load Time (PLT) and W3C metrics.
  - VoD YouTube: Number of freezings, video buffer size, received video quality, etc.
* HTTP optimizations:
  - Apply different HTTP profiles (with HTTP optimisations: caching size, parallel connections, etc.)
  - Integrate Web Boost (from http://webboost.fse.guru/): caching generic web elements (.css, .js, etc.) and blocks ads/trackers.
* Parameters:
  - Monitoring granularity
  - Apply a daily time slot where data consumption is taken into account.
* Additional features:
  - Alerts on data consumptions.
  - Send metrics to distant IP/port addresses (to be used by service providers).

New features could be added in the future.

## How to Install 

### Linux 

The add-on has been tested on Ubuntu 16.04 and 18.04.

Install latest version of Firefox and daemon dependencies (Python 3.5 or 3.6, pip3 and apscheduler):

```
# apt install python3.6
# apt install python3-pip
# pip3 install --upgrade python-iptables apscheduler
```

Clone the source code from `https://github.com/CNES/satboost`.

Launch the daemon (with root permissions):
```
$ python3 controller.py <options>
```

Add the add-on under xpi format (available in `https://github.com/CNES/satboost/tree/master/installation_package_files/Linux_Windows`) 
to Firefox. Choose the option 'Install Add-on from file' and accept permissions.


### Windows

The add-on has been tested on Windows 8 and Windows 10.

Install lastest version of Firefox and daemon dependencies (Python 3.7) from:
* https://www.python.org/ftp/python/3.7.3/python-3.7.3-amd64.exe (64 bits)
* https://www.python.org/ftp/python/3.7.3/python-3.7.3.exe (32 bits)

Download Python apscheduler module from https://files.pythonhosted.org/packages/21/59/20a05dfa5525df11144f68a972b9b25aeeca4933dcbf23510c07955117e4/APScheduler-3.6.1.tar.gz and install it using the following command:
```
py setup.py install 
```

Clone the source code from `https://github.com/CNES/satboost`.

Launch daemon:
```
py controller.py <options>
```

Add the add-on under xpi format (available in `https://github.com/CNES/satboost/tree/master/installation_package_files/Linux_Windows`) 
to Firefox. Choose the option 'Install Add-on from file' and accept permissions.

### Android

Install the latest version of Firefox for Android.

Download and install the apk packet: `https://github.com/CNES/satboost/tree/master/installation_package_files/Android/satboost-daemon-1.0.apk`

Open the application named `SATboost daemon`, and click on `Click to start the daemon` to launch the daemon.

Disable the `Signatures required` requirement:
* Go to `about:config` in Firefox
* Set `xpinstall.signatures.required` to false

Finally download and open the xpi **from Android Firefox** to install it: `https://github.com/CNES/satboost/tree/master/installation_package_files/Android/satboost-1.0-an.xpi`
