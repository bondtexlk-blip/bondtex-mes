import os from 'os';

export function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const candidateIps = [];
  let primaryIp = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isVirtual =
          name.toLowerCase().includes('vethernet') ||
          name.toLowerCase().includes('virtual') ||
          name.toLowerCase().includes('docker') ||
          name.toLowerCase().includes('wsl');

        candidateIps.push({
          interface: name,
          ip: iface.address,
          isVirtual,
        });
      }
    }
  }

  // Prioritize physical interface (Wi-Fi or Ethernet)
  const physical = candidateIps.find((c) => !c.isVirtual);
  if (physical) {
    primaryIp = physical.ip;
  } else if (candidateIps.length > 0) {
    primaryIp = candidateIps[0].ip;
  }

  return {
    primaryIp,
    candidateIps,
  };
}
