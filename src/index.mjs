import { docopt } from 'docopt';
import { publicIpv4 } from 'public-ip';
import { ok } from 'node:assert';
import { readFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile(`./package.json`));

const doc = `
Cloudflare A Record Updater.

Usage:
  cloudflare-dns-updater -t <token> -r <zone>:<record> [-r <zone>:<record>...]
  cloudflare-dns-updater (-h | --help)
  cloudflare-dns-updater --version

Options:
  -h --help           Show this screen.
  --version           Show version.
  -t <token>          Cloudflare API token.
  -r <zone>:<record>  Cloudflare zone name and A record name to update (can be used multiple times).
`;

const options = docopt(doc, { version });

const cloudflareToken = options['-t'];
const records = options['-r'];
const ip = await publicIpv4();

for (const record of records) {
    const [zoneName, aRecordName] = record.split(':', 2);

    try {
        const zoneId = await getZoneId(zoneName);
        const recordId = await getARecordId(zoneId, aRecordName);
        await updateARecord(zoneId, recordId, aRecordName, ip);
        console.log(`Successfully updated A record '${aRecordName}' with IP ${ip}`);
    } catch (error) {
        console.error(`Failed to update A record '${aRecordName}': ${error.message}`);
    }
}

async function getZoneId(zoneName) {
    const url = `https://api.cloudflare.com/client/v4/zones?name=${zoneName}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
        },
    });

    ok(response.ok, `Failed to fetch zone information for ${zoneName}. Status: ${response.status}`);

    const data = await response.json();
    const zoneRecord = data.result[0];
    ok(zoneRecord, `Zone '${zoneName}' not found.`);

    return zoneRecord.id;
}

async function getARecordId(zoneId, aRecordName) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${aRecordName}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
        },
    });

    ok(response.ok, `Failed to fetch A record information for '${aRecordName}'. Status: ${response.status}`);

    const data = await response.json();
    const aRecord = data.result[0];
    ok(aRecord, `A record '${aRecordName}' not found.`);

    return aRecord.id;
}

async function updateARecord(zoneId, recordId, recordName, ipAddress) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: ipAddress,
        }),
    });

    ok(response.ok, `Failed to update A record '${recordName}'. Status: ${response.status}`);
}
