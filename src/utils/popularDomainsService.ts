
export interface PopularDomainInfo {
  registrar: string;
  registrationDate?: string;
  created?: string;
  creationDate?: string;
  expiryDate?: string;
  expires?: string;
  nameServers?: string[];
  nameservers?: string[];
  status?: string;
}

// 知名域名的静态数据库
const POPULAR_DOMAINS: Record<string, PopularDomainInfo> = {
  'google.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '1997-09-15',
    expiryDate: '2028-09-14',
    nameServers: ['ns1.google.com', 'ns2.google.com', 'ns3.google.com', 'ns4.google.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'baidu.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '1999-10-11',
    expiryDate: '2026-10-11',
    nameServers: ['ns1.baidu.com', 'ns2.baidu.com', 'ns3.baidu.com', 'ns4.baidu.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'microsoft.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '1991-05-02',
    expiryDate: '2025-05-03',
    nameServers: ['ns1.msft.net', 'ns2.msft.net', 'ns3.msft.net', 'ns4.msft.net'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'apple.com': {
    registrar: 'CSC Corporate Domains, Inc.',
    registrationDate: '1987-02-19',
    expiryDate: '2025-02-20',
    nameServers: ['a.ns.apple.com', 'b.ns.apple.com', 'c.ns.apple.com', 'd.ns.apple.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'amazon.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '1994-11-01',
    expiryDate: '2024-10-31',
    nameServers: ['ns1.p31.dynect.net', 'ns2.p31.dynect.net', 'ns3.p31.dynect.net', 'ns4.p31.dynect.net'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'facebook.com': {
    registrar: 'RegistrarSafe, LLC',
    registrationDate: '1997-03-29',
    expiryDate: '2025-03-30',
    nameServers: ['a.ns.facebook.com', 'b.ns.facebook.com', 'c.ns.facebook.com', 'd.ns.facebook.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'youtube.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '2005-02-15',
    expiryDate: '2025-02-15',
    nameServers: ['ns1.google.com', 'ns2.google.com', 'ns3.google.com', 'ns4.google.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'twitter.com': {
    registrar: 'CSC Corporate Domains, Inc.',
    registrationDate: '2000-01-21',
    expiryDate: '2025-01-21',
    nameServers: ['a1.verisigndns.com', 'a2.verisigndns.com', 'a3.verisigndns.com'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'github.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '2007-10-09',
    expiryDate: '2025-10-09',
    nameServers: ['ns-1283.awsdns-32.org', 'ns-1707.awsdns-21.co.uk', 'ns-421.awsdns-52.com', 'ns-520.awsdns-01.net'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  },
  'stackoverflow.com': {
    registrar: 'MarkMonitor Inc.',
    registrationDate: '2003-12-26',
    expiryDate: '2024-12-26',
    nameServers: ['ns-1029.awsdns-00.org', 'ns-1681.awsdns-18.co.uk', 'ns-421.awsdns-52.com', 'ns-925.awsdns-51.net'],
    status: 'clientDeleteProhibited clientTransferProhibited clientUpdateProhibited'
  }
};

export async function getPopularDomainInfo(domain: string): Promise<PopularDomainInfo | null> {
  try {
    const cleanDomain = domain.toLowerCase().trim();
    const domainInfo = POPULAR_DOMAINS[cleanDomain];
    
    if (domainInfo) {
      console.log(`找到预定义域名数据: ${cleanDomain}`);
      return domainInfo;
    }
    
    return null;
  } catch (error) {
    console.error('获取预定义域名数据失败:', error);
    return null;
  }
}

export function getAllPopularDomains(): string[] {
  return Object.keys(POPULAR_DOMAINS);
}
