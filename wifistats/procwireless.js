const exec = require('child_process').exec;

const cmdLine = 'cat /proc/net/wireless';

/**
 * Parses the output of the {@link cmdLine}.
 * $ cat /proc/net/wireless
 * Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE
 * face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22
 * wlp6s0: 0000   48.  -62.  -256        0      0      0      0      0        0
 * We report link, level and noise.
 *
 * @param {string} str - the string which is output of the command.
 * @return {Promise}
 */
function parseOutput(str) {
    return new Promise((resolve, reject) => {
        try {
            const lines = str.split('\n');

            if (lines.length <= 2) {
                reject(new Error('No wifi interface'));
                return;
            }

            // we take the third line
            const line = lines[2];

            const elements = line.split(':');
            if (elements.length < 2) {
                reject(new Error('No wifi interface - wrong format'));
                return;
            }

            const iface = elements[0];
            const stats = elements[1].trim().split(/[ ]+/);

            const resultObj = {
                interface: iface,
                signal: parseInt(stats[1], 10),
                rssi: parseInt(stats[2], 10),
                noise: parseInt(stats[3], 10),
                timestamp: Date.now()
            };

            // now let's get that interface address
            // The output should be like
            // inet 192.168.1.102/24 brd..... scope global ...
            // inet6 2605:...... scope global ...
            exec('ip address show dev ' + iface, function (err, str) {
                if (err) {
                    // cannot get interface address, lets submit whatever we have
                    resolve(resultObj);
                    return;
                }

                try {
                    const lines = str.split('\n');
                    const addresses = [];
                    for (let line of lines) {
                        line = line.trim();

                        if (line.indexOf('scope global') == -1) {
                            continue;
                        }

                        let addr;
                        if (line.startsWith('inet6')) {
                            addr = extractAddress(line.substring(5));
                        } else if (line.startsWith('inet')) {
                            addr = extractAddress(line.substring(4));
                        }

                        if (addr) {
                            addresses.push(addr);
                        }
                    }

                    resultObj.addresses = addresses;
                    resolve(resultObj);
                } catch (ex) {
                    // cannot get interface address, lets submit whatever we have
                    resolve(resultObj);
                }
            });
        } catch (ex) {
            reject(ex);
        }
    });
}

/**
 * Extracts ip address from the line that may contain it:
 * inet 192.168.1.102/22 brd .....
 *
 * @param str the string containing the address.
 * @returns {string} the ipv4 or ipv6 address.
 */
function extractAddress(str) {
    const elements = str.trim().split(' ');
    const addr = elements[0];
    return addr.substring(0, addr.indexOf('/'));
}

module.exports = {
    parseOutput,
    cmdLine
};
