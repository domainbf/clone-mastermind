
// 热门域名数据服务
export interface DomainInfo {
  domain: string;
  registrar: string;
  registrationDate: string;
  expiryDate: string;
  nameServers: string[];
  registrant: string;
  status: string;
  description?: string;
}

// 常见域名的WHOIS数据
export const POPULAR_DOMAINS_DATA: Record<string, DomainInfo> = {
  'whois.com': {
    domain: 'whois.com',
    registrar: 'NameCheap, Inc.',
    registrationDate: '1995-08-31T04:00:00.000Z',
    expiryDate: '2025-08-30T04:00:00.000Z',
    nameServers: [
      'dns1.registrar-servers.com',
      'dns2.registrar-servers.com'
    ],
    registrant: 'WHOIS.COM LLC',
    status: 'clientTransferProhibited https://icann.org/epp#clientTransferProhibited',
    description: 'WHOIS查询服务提供商'
  },
  'google.com': {
    domain: 'google.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '1997-09-15T04:00:00.000Z',
    expiryDate: '2028-09-14T04:00:00.000Z',
    nameServers: [
      'ns1.google.com',
      'ns2.google.com',
      'ns3.google.com',
      'ns4.google.com'
    ],
    registrant: 'Google LLC',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: '全球最大搜索引擎'
  },
  'github.com': {
    domain: 'github.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '2007-10-09T18:20:50.000Z',
    expiryDate: '2025-10-09T18:20:50.000Z',
    nameServers: [
      'dns1.p08.nsone.net',
      'dns2.p08.nsone.net',
      'dns3.p08.nsone.net',
      'dns4.p08.nsone.net',
      'ns-1283.awsdns-32.org',
      'ns-1707.awsdns-21.co.uk',
      'ns-421.awsdns-52.com',
      'ns-520.awsdns-01.net'
    ],
    registrant: 'GitHub, Inc.',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: '代码托管平台'
  },
  'microsoft.com': {
    domain: 'microsoft.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '1991-05-02T04:00:00.000Z',
    expiryDate: '2025-05-03T04:00:00.000Z',
    nameServers: [
      'ns1-205.azure-dns.com',
      'ns2-205.azure-dns.net',
      'ns3-205.azure-dns.org',
      'ns4-205.azure-dns.info'
    ],
    registrant: 'Microsoft Corporation',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: '微软公司官网'
  },
  'apple.com': {
    domain: 'apple.com',
    registrar: 'CSC Corporate Domains, Inc.',
    registrationDate: '1987-02-19T05:00:00.000Z',
    expiryDate: '2025-02-20T05:00:00.000Z',
    nameServers: [
      'adns1.apple.com',
      'adns2.apple.com',
      'adns3.apple.com',
      'adns4.apple.com',
      'adns5.apple.com',
      'adns6.apple.com'
    ],
    registrant: 'Apple Inc.',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: '苹果公司官网'
  },
  'amazon.com': {
    domain: 'amazon.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '1994-11-01T05:00:00.000Z',
    expiryDate: '2025-10-30T04:00:00.000Z',
    nameServers: [
      'pdns1.ultradns.net',
      'pdns6.ultradns.co.uk',
      'ns1.p31.dynect.net',
      'ns2.p31.dynect.net',
      'ns3.p31.dynect.net',
      'ns4.p31.dynect.net'
    ],
    registrant: 'Amazon Technologies, Inc.',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: '亚马逊电商平台'
  },
  'facebook.com': {
    domain: 'facebook.com',
    registrar: 'RegistrarSafe, LLC',
    registrationDate: '1997-03-29T05:00:00.000Z',
    expiryDate: '2025-03-30T04:00:00.000Z',
    nameServers: [
      'a.ns.facebook.com',
      'b.ns.facebook.com',
      'c.ns.facebook.com',
      'd.ns.facebook.com'
    ],
    registrant: 'Meta Platforms, Inc.',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: 'Facebook社交平台'
  },
  'youtube.com': {
    domain: 'youtube.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '2005-02-15T05:00:00.000Z',
    expiryDate: '2025-02-15T05:00:00.000Z',
    nameServers: [
      'ns1.google.com',
      'ns2.google.com',
      'ns3.google.com',
      'ns4.google.com'
    ],
    registrant: 'Google LLC',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: 'YouTube视频平台'
  },
  'twitter.com': {
    domain: 'twitter.com',
    registrar: 'CSC Corporate Domains, Inc.',
    registrationDate: '2000-01-21T16:28:17.000Z',
    expiryDate: '2025-01-21T16:28:17.000Z',
    nameServers: [
      'a.r06.twtrdns.net',
      'b.r06.twtrdns.net',
      'c.r06.twtrdns.net',
      'd.r06.twtrdns.net'
    ],
    registrant: 'Twitter, Inc.',
    status: 'clientTransferProhibited https://icann.org/epp#clientTransferProhibited',
    description: 'Twitter社交平台'
  },
  'netflix.com': {
    domain: 'netflix.com',
    registrar: 'MarkMonitor, Inc.',
    registrationDate: '1997-08-29T04:00:00.000Z',
    expiryDate: '2025-08-30T04:00:00.000Z',
    nameServers: [
      'ns-1371.awsdns-43.org',
      'ns-1984.awsdns-56.co.uk',
      'ns-407.awsdns-50.com',
      'ns-81.awsdns-10.net'
    ],
    registrant: 'Netflix, Inc.',
    status: 'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
    description: 'Netflix流媒体服务'
  }
};

// 获取热门域名数据
export function getPopularDomainData(domain: string): DomainInfo | null {
  const normalizedDomain = domain.toLowerCase().trim();
  return POPULAR_DOMAINS_DATA[normalizedDomain] || null;
}

// 检查是否为热门域名
export function isPopularDomain(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().trim();
  return normalizedDomain in POPULAR_DOMAINS_DATA;
}

// 获取所有热门域名列表
export function getAllPopularDomains(): string[] {
  return Object.keys(POPULAR_DOMAINS_DATA);
}

// 搜索热门域名
export function searchPopularDomains(query: string): DomainInfo[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  return Object.values(POPULAR_DOMAINS_DATA).filter(domainInfo => 
    domainInfo.domain.includes(normalizedQuery) ||
    domainInfo.registrant.toLowerCase().includes(normalizedQuery) ||
    domainInfo.description?.toLowerCase().includes(normalizedQuery)
  );
}
