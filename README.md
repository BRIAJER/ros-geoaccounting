## ros-geoaccounting
This is a script that will help you to see where your internet traffic is coming
from. You will need a MaxMind database (probably packaged in your Linux distro,
e. g. in ArchLinux, `geoip-database` package installs it to
`/usr/share/GeoIP/GeoIP.dat`) and Node.js for it to work.

This script knows nothing about IPv6 addresses, it only works with IPv4.

### Sample Output
```
## 192.168.1.10

Country                     RX        TX  RX %
----------------------------------------------
Europe              3912974241  70722123   94%
United States        123051161  20234725    3%
France                42658554  46677498    1%
United Kingdom        23491634  25482762    1%
Germany               21606878  25443782    1%
Czech Republic         7212784   6637088    0%
Poland                 5049088   4109936    0%
```

### Usage
This script processes RouterOS [accounting](https://wiki.mikrotik.com/wiki/Manual:IP/Accounting)
files.

1. Clone this repo:
   ```
   git clone https://github.com/cutiful/ros-geoaccounting && cd ros-geoaccounting
   ```
2. Install the dependencies:
   ```
   npm i
   ```
3. Enable accounting on your Mikrotik router:
   ```
   /ip accounting set enabled=yes
   /ip accounting web-access set accessible-via-web=yes
   ```
4. Download accounting files to the script folder:
   ```
   wget http://<router ip>/accounting/ip.cgi
   ```
5. They will be saved as `ip.cgi`, `ip.cgi.1`, `ip.cgi.2`... Don't rename them,
   this script will process each of them.
6. Run the script:
   ```
   node script.js -p <your network IP prefix, as a string, e. g.: 192.168.1.>
   ```
