
import axios from 'axios';
import { WhoisData } from '@/hooks/use-whois-lookup';

// RDAP服务器映射
const RDAP_SERVERS: Record<string, string> = {
  'com': 'https://rdap.verisign.com/com/v1',
  'net': 'https://rdap.verisign.com/net/v1',
  'org': 'https://rdap.publicinterestregistry.org',
  'info': 'https://rdap.afilias.net',
  'biz': 'https://rdap.nic.biz',
  'io': 'https://rdap.nic.io',
  'ai': 'https://rdap.nic.ai',
  'co': 'https://rdap.nic.co',
  'me': 'https://rdap.nic.me',
  'tv': 'https://rdap.nic.tv',
  'cc': 'https://rdap.nic.cc',
  'ly': 'https://rdap.nic.ly'
};

// WHOIS服务器映射
const WHOIS_SERVERS: Record<string, string> = {
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'info': 'whois.afilias.net',
  'biz': 'whois.nic.biz',
  'io': 'whois.nic.io',
  'ai': 'whois.nic.ai',
  'co': 'whois.nic.co',
  'me': 'whois.nic.me',
  'tv': 'whois.nic.tv',
  'cc': 'whois.nic.cc',
  'ly': 'whois.nic.ly'
};

export interface DomainQueryResult {
  success: boolean;
  data?: WhoisData;
  error?: string;
  protocol: 'rdap' | 'whois' | 'error';
}

export class LocalDomainQuery {
  private domain: string;
  private tld: string;

  constructor(domain: string) {
    this.domain = this.cleanDomain(domain);
    this.tld = this.extractTLD(this.domain);
  }

  private cleanDomain(domain: string): string {
    return domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '');
  }

  private extractTLD(domain: string): string {
    const parts = domain.split('.');
    return parts[parts.length - 1];
  }

  // RDAP查询
  async queryRDAP(): Promise<DomainQueryResult> {
    const rdapServer = RDAP_SERVERS[this.tld];
    if (!rdapServer) {
      return {
        success: false,
        error: `不支持的TLD: ${this.tld}`,
        protocol: 'error'
      };
    }

    try {
      const url = `${rdapServer}/domain/${this.domain}`;
      console.log(`RDAP查询: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/rdap+json',
          'User-Agent': 'DomainQuery/1.0'
        }
      });

      if (response.status === 200 && response.data) {
        const parsedData = this.parseRDAPResponse(response.data);
        return {
          success: true,
          data: parsedData,
          protocol: 'rdap'
        };
      }

      return {
        success: false,
        error: 'RDAP服务器返回无效数据',
        protocol: 'error'
      };
    } catch (error: any) {
      console.error('RDAP查询失败:', error);
      return {
        success: false,
        error: `RDAP查询失败: ${error.message}`,
        protocol: 'error'
      };
    }
  }

  // WHOIS查询
  async queryWHOIS(): Promise<DomainQueryResult> {
    const whoisServer = WHOIS_SERVERS[this.tld];
    if (!whoisServer) {
      return {
        success: false,
        error: `不支持的TLD: ${this.tld}`,
        protocol: 'error'
      };
    }

    try {
      // 使用本地API端点进行WHOIS查询
      const response = await axios.post('/api/whois', {
        domain: this.domain,
        server: whoisServer
      }, {
        timeout: 15000
      });

      if (response.data && response.data.success !== false) {
        const parsedData = this.parseWHOISResponse(response.data);
        return {
          success: true,
          data: parsedData,
          protocol: 'whois'
        };
      }

      return {
        success: false,
        error: response.data?.error || 'WHOIS查询失败',
        protocol: 'error'
      };
    } catch (error: any) {
      console.error('WHOIS查询失败:', error);
      return {
        success: false,
        error: `WHOIS查询失败: ${error.message}`,
        protocol: 'error'
      };
    }
  }

  // 自动查询（RDAP优先，WHOIS备用）
  async query(): Promise<DomainQueryResult> {
    console.log(`开始查询域名: ${this.domain}`);

    // 优先尝试RDAP
    const rdapResult = await this.queryRDAP();
    if (rdapResult.success) {
      return rdapResult;
    }

    console.log('RDAP查询失败，尝试WHOIS');
    
    // RDAP失败后尝试WHOIS
    const whoisResult = await this.queryWHOIS();
    if (whoisResult.success) {
      return whoisResult;
    }

    // 都失败了
    return {
      success: false,
      error: `RDAP和WHOIS查询均失败`,
      protocol: 'error'
    };
  }

  private parseRDAPResponse(data: any): WhoisData {
    const result: WhoisData = {
      domain: this.domain,
      whoisServer: 'RDAP',
      registrar: '未知',
      registrationDate: '未知',
      expiryDate: '未知',
      nameServers: [],
      registrant: '未知',
      status: '未知',
      rawData: JSON.stringify(data, null, 2),
      protocol: 'rdap'
    };

    try {
      // 解析注册商
      if (data.entities) {
        for (const entity of data.entities) {
          if (entity.roles?.includes('registrar')) {
            if (entity.vcardArray?.[1]) {
              for (const vcard of entity.vcardArray[1]) {
                if (vcard[0] === 'fn') {
                  result.registrar = vcard[3];
                  break;
                }
              }
            }
            break;
          }
        }
      }

      // 解析日期
      if (data.events) {
        for (const event of data.events) {
          if (event.eventAction === 'registration') {
            result.registrationDate = event.eventDate;
          } else if (event.eventAction === 'expiration') {
            result.expiryDate = event.eventDate;
          }
        }
      }

      // 解析DNS服务器
      if (data.nameservers) {
        result.nameServers = data.nameservers.map((ns: any) => 
          ns.ldhName || ns.unicodeName || ''
        ).filter(Boolean);
      }

      // 解析状态
      if (data.status && Array.isArray(data.status)) {
        result.status = data.status.join(', ');
      }

      // 解析注册人
      if (data.entities) {
        for (const entity of data.entities) {
          if (entity.roles?.includes('registrant')) {
            if (entity.vcardArray?.[1]) {
              for (const vcard of entity.vcardArray[1]) {
                if (vcard[0] === 'fn') {
                  result.registrant = vcard[3];
                  break;
                }
              }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error('RDAP数据解析错误:', error);
    }

    return result;
  }

  private parseWHOISResponse(data: any): WhoisData {
    return {
      domain: this.domain,
      whoisServer: data.whoisServer || 'WHOIS',
      registrar: data.registrar || '未知',
      registrationDate: data.registrationDate || '未知',
      expiryDate: data.expiryDate || '未知',
      nameServers: data.nameServers || [],
      registrant: data.registrant || '未知',
      status: data.status || '未知',
      rawData: data.rawData || '',
      protocol: 'whois'
    };
  }
}

// 导出便捷函数
export async function queryDomain(domain: string): Promise<DomainQueryResult> {
  const service = new LocalDomainQuery(domain);
  return await service.query();
}
