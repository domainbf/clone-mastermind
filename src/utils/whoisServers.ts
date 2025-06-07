
// WHOIS服务器配置
export const WHOIS_SERVERS: Record<string, string> = {
  // 通用顶级域名
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'info': 'whois.afilias.net',
  'biz': 'whois.nic.biz',
  'name': 'whois.nic.name',
  'mobi': 'whois.dotmobiregistry.net',
  
  // 新通用顶级域名
  'io': 'whois.nic.io',
  'ai': 'whois.nic.ai',
  'co': 'whois.nic.co',
  'me': 'whois.nic.me',
  'tv': 'whois.nic.tv',
  'cc': 'whois.nic.cc',
  'ly': 'whois.nic.ly',
  'app': 'whois.nic.google',
  'dev': 'whois.nic.google',
  
  // 国家代码顶级域名
  'cn': 'whois.cnnic.cn',
  'tw': 'whois.twnic.net.tw',
  'hk': 'whois.hkirc.hk',
  'jp': 'whois.jprs.jp',
  'kr': 'whois.kr',
  'sg': 'whois.sgnic.sg',
  'my': 'whois.mynic.my',
  'th': 'whois.thnic.co.th',
  'in': 'whois.registry.in',
  
  'uk': 'whois.nic.uk',
  'de': 'whois.denic.de',
  'fr': 'whois.nic.fr',
  'it': 'whois.nic.it',
  'es': 'whois.nic.es',
  'nl': 'whois.domain-registry.nl',
  'be': 'whois.dns.be',
  'ch': 'whois.nic.ch',
  'at': 'whois.nic.at',
  'pl': 'whois.dns.pl',
  'ru': 'whois.tcinet.ru',
  
  'ca': 'whois.cira.ca',
  'us': 'whois.nic.us',
  'mx': 'whois.mx',
  'br': 'whois.registro.br',
  'ar': 'whois.nic.ar',
  'cl': 'whois.nic.cl',
  'au': 'whois.auda.org.au',
  'nz': 'whois.srs.net.nz'
};

// 获取域名对应的WHOIS服务器
export function getWhoisServer(domain: string): string | null {
  const tld = domain.split('.').pop()?.toLowerCase();
  return tld ? WHOIS_SERVERS[tld] || null : null;
}

// RDAP服务器配置
export const RDAP_SERVERS: Record<string, string> = {
  'com': 'https://rdap.verisign.com/com/v1',
  'net': 'https://rdap.verisign.com/net/v1',
  'org': 'https://rdap.org',
  'info': 'https://rdap.afilias.net/rdap',
  'biz': 'https://rdap.nic.biz',
  
  'io': 'https://rdap.nic.io',
  'ai': 'https://rdap.nic.ai',
  'co': 'https://rdap.nic.co',
  'me': 'https://rdap.nic.me',
  'tv': 'https://rdap.nic.tv',
  
  'cn': 'https://rdap.cnnic.cn',
  'jp': 'https://rdap.jprs.jp',
  'kr': 'https://rdap.kr',
  'uk': 'https://rdap.nominet.uk',
  'de': 'https://rdap.denic.de'
};

// 获取域名对应的RDAP服务器
export function getRdapServer(domain: string): string | null {
  const tld = domain.split('.').pop()?.toLowerCase();
  return tld ? RDAP_SERVERS[tld] || 'https://rdap.org' : 'https://rdap.org';
}
