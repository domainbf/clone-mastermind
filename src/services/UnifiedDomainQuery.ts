
import { WhoisData } from '@/hooks/use-whois-lookup';
import { getPopularDomainData } from '@/utils/popularDomainsService';
import { formatDomain, extractTLD } from '@/utils/apiUtils';
import axios from 'axios';

export interface QueryResult {
  success: boolean;
  data?: WhoisData;
  error?: string;
  source: string;
}

/**
 * 统一域名查询服务 - 提供健壮的双协议查询
 */
export class UnifiedDomainQuery {
  private domain: string;
  private tld: string | null;
  
  constructor(domain: string) {
    this.domain = formatDomain(domain);
    this.tld = extractTLD(this.domain);
  }

  /**
   * 执行双协议查询 - RDAP优先，WHOIS备用
   */
  async query(protocol: "auto" | "rdap" | "whois" = "auto"): Promise<QueryResult> {
    console.log(`开始查询域名: ${this.domain}, 协议: ${protocol}`);

    try {
      // 1. 首先检查热门域名数据库（最快）
      const popularResult = await this.queryPopularDomains();
      if (popularResult.success) {
        return popularResult;
      }

      // 2. 根据协议选择查询策略
      if (protocol === "rdap") {
        return await this.queryRDAP();
      } else if (protocol === "whois") {
        return await this.queryTraditionalWhois();
      } else {
        // 自动模式：并行尝试RDAP和WHOIS
        const results = await Promise.allSettled([
          this.queryRDAP(),
          this.queryTraditionalWhois()
        ]);

        // 返回第一个成功的结果
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            return result.value;
          }
        }

        // 如果都失败，返回最后一个错误
        const lastError = results[results.length - 1];
        if (lastError.status === 'rejected') {
          return {
            success: false,
            error: lastError.reason?.message || "所有查询方法均失败",
            source: "unified-query"
          };
        }

        return {
          success: false,
          error: "无法获取域名信息",
          source: "unified-query"
        };
      }
    } catch (error) {
      console.error("统一查询服务错误:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        source: "unified-query"
      };
    }
  }

  /**
   * 查询热门域名数据库
   */
  private async queryPopularDomains(): Promise<QueryResult> {
    const popularData = getPopularDomainData(this.domain);
    
    if (popularData) {
      return {
        success: true,
        data: {
          domain: this.domain,
          whoisServer: "热门域名数据库",
          registrar: popularData.registrar,
          registrationDate: popularData.registrationDate,
          expiryDate: popularData.expiryDate,
          nameServers: popularData.nameServers,
          registrant: "未知",
          status: popularData.status,
          rawData: "热门域名预定义数据",
          protocol: "static",
          message: "从热门域名数据库获取"
        },
        source: "popular-domains"
      };
    }

    return {
      success: false,
      error: "未在热门域名数据库中找到",
      source: "popular-domains"
    };
  }

  /**
   * RDAP协议查询
   */
  private async queryRDAP(): Promise<QueryResult> {
    if (!this.tld) {
      return {
        success: false,
        error: "无法识别域名的顶级域名",
        source: "rdap"
      };
    }

    const rdapServers = this.getRdapServers(this.tld);
    
    for (const server of rdapServers) {
      try {
        const url = `${server}${server.endsWith('/') ? '' : '/'}domain/${this.domain}`;
        console.log(`尝试RDAP查询: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            'Accept': 'application/rdap+json',
            'User-Agent': 'Domain-Lookup-Tool/1.0'
          }
        });

        if (response.data && response.status === 200) {
          const parsedData = this.parseRDAPData(response.data);
          if (parsedData) {
            return {
              success: true,
              data: parsedData,
              source: "rdap"
            };
          }
        }
      } catch (error) {
        console.error(`RDAP服务器 ${server} 查询失败:`, error);
      }
    }

    return {
      success: false,
      error: "所有RDAP服务器查询失败",
      source: "rdap"
    };
  }

  /**
   * 传统WHOIS查询
   */
  private async queryTraditionalWhois(): Promise<QueryResult> {
    try {
      // 尝试公共WHOIS API
      const publicApiResult = await this.queryPublicWhoisAPI();
      if (publicApiResult.success) {
        return publicApiResult;
      }

      // 最后的后备方案
      return {
        success: false,
        error: "传统WHOIS查询失败",
        source: "whois"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "WHOIS查询错误",
        source: "whois"
      };
    }
  }

  /**
   * 公共WHOIS API查询
   */
  private async queryPublicWhoisAPI(): Promise<QueryResult> {
    const apis = [
      {
        url: `https://api.whoapi.com/?domain=${this.domain}&r=whois&apikey=demo`,
        parser: this.parseWhoAPIResponse.bind(this)
      }
    ];

    for (const api of apis) {
      try {
        const response = await axios.get(api.url, { timeout: 10000 });
        
        if (response.data && response.data.status === 1) {
          const parsedData = api.parser(response.data);
          if (parsedData) {
            return {
              success: true,
              data: parsedData,
              source: "public-whois-api"
            };
          }
        }
      } catch (error) {
        console.error(`公共API ${api.url} 查询失败:`, error);
      }
    }

    return {
      success: false,
      error: "公共WHOIS API查询失败",
      source: "public-whois-api"
    };
  }

  /**
   * 获取RDAP服务器列表
   */
  private getRdapServers(tld: string): string[] {
    const rdapMapping: Record<string, string[]> = {
      'com': ['https://rdap.verisign.com/com/v1'],
      'net': ['https://rdap.verisign.com/net/v1'],
      'org': ['https://rdap.org'],
      'io': ['https://rdap.nic.io'],
      'ai': ['https://rdap.nic.ai']
    };

    return rdapMapping[tld] || ['https://rdap.org'];
  }

  /**
   * 解析RDAP数据
   */
  private parseRDAPData(data: any): WhoisData | null {
    try {
      let registrar = "未知";
      let registrationDate = "未知";
      let expiryDate = "未知";
      let nameServers: string[] = [];
      let status = "未知";

      // 解析注册商
      if (data.entities) {
        for (const entity of data.entities) {
          if (entity.roles?.includes('registrar')) {
            if (entity.vcardArray?.[1]) {
              for (const vcard of entity.vcardArray[1]) {
                if (vcard[0] === 'fn') {
                  registrar = vcard[3];
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
            registrationDate = event.eventDate;
          } else if (event.eventAction === 'expiration') {
            expiryDate = event.eventDate;
          }
        }
      }

      // 解析名称服务器
      if (data.nameservers) {
        nameServers = data.nameservers.map((ns: any) => ns.ldhName || ns.unicodeName || '').filter(Boolean);
      }

      // 解析状态
      if (data.status && Array.isArray(data.status)) {
        status = data.status.join(', ');
      }

      return {
        domain: this.domain,
        whoisServer: "RDAP协议",
        registrar,
        registrationDate,
        expiryDate,
        nameServers,
        registrant: "未知",
        status,
        rawData: JSON.stringify(data, null, 2),
        protocol: "rdap",
        message: "RDAP协议查询成功"
      };
    } catch (error) {
      console.error("RDAP数据解析失败:", error);
      return null;
    }
  }

  /**
   * 解析WhoAPI响应
   */
  private parseWhoAPIResponse(data: any): WhoisData | null {
    try {
      return {
        domain: this.domain,
        whoisServer: data.whois_server || "whoapi.com",
        registrar: data.registrar || "未知",
        registrationDate: data.date_created || "未知",
        expiryDate: data.date_expires || "未知",
        nameServers: data.nameservers || [],
        registrant: data.owner || "未知",
        status: data.status || "未知",
        rawData: data.whois_raw || "无原始数据",
        protocol: "whois",
        message: "WhoAPI查询成功"
      };
    } catch (error) {
      console.error("WhoAPI数据解析失败:", error);
      return null;
    }
  }
}

// 导出便捷函数
export async function queryDomainUnified(domain: string, protocol: "auto" | "rdap" | "whois" = "auto"): Promise<QueryResult> {
  const service = new UnifiedDomainQuery(domain);
  return await service.query(protocol);
}
