#!/usr/bin/node
const fs = require("fs/promises");
const maxmind = require("maxmind");
const { program } = require("commander");

program
  .version("1.0.0")
  .option("-p, --network-prefix <prefix>", "internal IP addresses prefix (matched as a string)", "192.168.1.")
  .option("-d, --geoip-database <path>", "path to the (legacy) MaxMind .dat file, probably packaged in your distro", "/usr/share/GeoIP/GeoIP.dat")
  .parse(process.argv);

const countryLookup = maxmind.init(program.geoipDatabase);

async function read() {
  const mapping = {};
  for (let num = 0; true; num++) {
    let fname = "ip.cgi" + (num !== 0 ? "." + num : "");
    let fcontents;

    try {
      fcontents = await fs.readFile(fname);
    } catch(e) {
      if (e.code == "ENOENT")
        break;
      else
        console.error("ERROR!", e.code);
    }

    const lines = fcontents.toString().split("\n");
    for (const line of lines) {
      const fields = line.split(" ");
      if (fields.length != 6)
        continue;

      if (!mapping[fields[0]])
        mapping[fields[0]] = {};
      if (!mapping[fields[0]][fields[1]]) {
        mapping[fields[0]][fields[1]] = {
          bytes: parseInt(fields[2]),
          packets: parseInt(fields[3]),
        };
      } else {
        mapping[fields[0]][fields[1]].bytes += parseInt(fields[2]);
        mapping[fields[0]][fields[1]].packets += parseInt(fields[3]);
      }
    }
  }

  return mapping;
}

async function reorder(mapping) {
  const newMapping = {};
  for (const ip in mapping) {
    if (ip.startsWith(program.networkPrefix)) {
      // local
      for (const extIP in mapping[ip]) {
        if (!newMapping[ip]) newMapping[ip] = {};
        if (!newMapping[ip][extIP]) newMapping[ip][extIP] = {};
        newMapping[ip][extIP]["out"] = JSON.parse(JSON.stringify(mapping[ip][extIP]));
      }
    } else {
      // external
      for (const intIP in mapping[ip]) {
        if (!newMapping[intIP]) newMapping[intIP] = {};
        if (!newMapping[intIP][ip]) newMapping[intIP][ip] = {};
        newMapping[intIP][ip]["in"] = JSON.parse(JSON.stringify(mapping[ip][intIP]));
      }
    }
  }

  return newMapping;
}

async function addGeo(mapping) {
  const newMapping = JSON.parse(JSON.stringify(mapping));
  for (const intIP in newMapping) {
    for (const extIP in newMapping[intIP]) {
      newMapping[intIP][extIP]["country"] = maxmind.getCountry(extIP);
    }
  }

  return newMapping;
}

async function mapGeo(mapping) {
  const countries = { network: {} };
  for (const intIP in mapping) {
    countries[intIP] = {};
    for (const extIP in mapping[intIP]) {
      addTraffic(countries, intIP, mapping[intIP][extIP]);
      addTraffic(countries, "network", mapping[intIP][extIP]);
    }
  }

  return countries;
}

async function report(mapping) {
  for (const entry in mapping) {
    const sumIn = Object.values(mapping[entry]).reduce((a, el) => a + el.in.bytes, 0);
    const sumOut = Object.values(mapping[entry]).reduce((a, el) => a + el.out.bytes, 0);
    const all = Object.keys(mapping[entry]).map(el => [el, mapping[entry][el].in.bytes, mapping[entry][el].out.bytes]);
    const sortIn = [...all].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0);
    const sortOut = [...all].sort((a, b) => a[2] > b[2] ? -1 : a[2] < b[2] ? 1 : 0);

    const countryLength = all.reduce((a, el) => el[0].length > a ? el[0].length : a, 0);
    // https://stackoverflow.com/a/28203456
    // thought i could do it myself, but i don't know math, so..
    const countDigits = x => Math.max(Math.floor(Math.log10(Math.abs(x))), 0) + 1;
    const inLength = countDigits(sumIn); 
    const outLength = countDigits(sumOut);

    const makeLine = (country, rx, tx, percent) =>
  `${country.padEnd(countryLength, " ")} ${rx.toString().padStart(inLength, " ")} ${tx.toString().padStart(outLength, " ")} ${percent.toString().padStart(4, " ")}%`;

    console.log("##", entry);
    console.log();

    const header = makeLine("Country", "RX", "TX", "RX ");
    console.log(header);
    console.log("".padEnd(header.length, "-"));
    for (const el of sortIn) {
      console.log(makeLine(el[0], el[1], el[2], Math.round(el[1] / sumIn * 100)));
    }
    console.log("".padEnd(header.length, "-"));
    console.log(makeLine("Total", sumIn, sumOut, 100));

    console.log();
  }
}

function addTraffic(mapObj, name, ipObj) {
  const country = ipObj.country.name;
  if (!mapObj[name][country])
    mapObj[name][country] = {};
  if (!mapObj[name][country].in)
    mapObj[name][country].in = {
      packets: 0,
      bytes: 0,
    };
  if (!mapObj[name][country].out)
    mapObj[name][country].out = {
      packets: 0,
      bytes: 0,
    };

  if (ipObj.in) {
    mapObj[name][country].in.packets += ipObj.in.packets;
    mapObj[name][country].in.bytes += ipObj.in.bytes;
  }

  if (ipObj.out) {
    mapObj[name][country].out.packets += ipObj.out.packets;
    mapObj[name][country].out.bytes += ipObj.out.bytes;
  }
}

read()
  .then(reorder)
  .then(addGeo)
  .then(mapGeo)
  .then(report);
