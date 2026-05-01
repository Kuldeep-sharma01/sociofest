import ipaddr from 'ipaddr.js';

// ✅ Simplify — don't parse X-Forwarded-For in the utility; let Express handle it
export const isIPInRange = (ip, range) => {
  if (!ip || !range) return false;

  // Normalize IPv6-mapped IPv4
  const normalized = String(ip).replace(/^::ffff:/, '').trim();
  try {
    const addr = ipaddr.process(normalized);
    const [rangeAddr, prefixLen] = ipaddr.parseCIDR(range);
    return addr.kind() === rangeAddr.kind() && addr.match([rangeAddr, prefixLen]);
  } catch {
    return false;
  }
};
