
import { WhoisData } from '@/hooks/use-whois-lookup';
import { getPopularDomainData } from '@/utils/popularDomainsService';
import { queryRDAP } from '@/utils/rdapClient';
import axios from 'axios';

/**
 * 高性能域名查询服务
 * 优化查询速度和准确性
 */
export class FastDomainLookup {
  private static cache = new Map<string, { data: WhoisData; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 并行查询多个数据源，返回最快且准确的结果
   */
  static async lookup(domain: string): Promise<WhoisData> {
    const cleanDomain = domain.toLowerCase().trim();
    
    // 检查缓存
    const cached = this.getCachedResult(cleanDomain);
    if (cached) {
      console.log(`从缓存获取域名 ${cleanDomain} 的数据`);
      return cached;
    }

    console.log(`开始并行查询域名: ${cleanDomain}`);
    
    // 并行启动多个查询
    const queryPromises = [
      this.queryPopularDomains(cleanDomain),
      this.queryRDAPFast(cleanDomain),
      this.queryPublicAPIs(cleanDomain)
    ];

    try {
      // 使用 Promise.race 获取最快的结果
      const result = await Promise.race(queryPromises.map(async (promise, index) => {
        try {
          const data = await promise;
          if (data && this.isValidResult(data)) {
            console.log(`查询源 ${index} 返回有效结果`);
            return { data, source: index };
          }
          return null;
        } catch (error) {
          console.log(`查询源 ${index} 失败:`, error);
          return null;
        }
      }));

      if (result && result.data) {
        // 缓存结果
        this.cacheResult(cleanDomain, result.data);
        return result.data;
      }

      // 如果并行查询都失败，等待所有结果并选择最佳的
      const allResults = await Promise.allSettled(queryPromises);
      const validResults = allResults
        .filter((result): result is PromiseFulfilledResult<WhoisData> => 
          result.status === 'fulfilled' && 
          result.value && 
          this.isValidResult(result.value)
        )
        .map(result => result.value);

      if (validResults.length > 0) {
        // 选择数据最完整的结果
        const bestResult = this.selectBestResult(validResults);
        this.cacheResult(cleanDomain, bestResult);
        return bestResult;
      }

      // 最后的后备方案
      return this.createFallbackResult(cleanDomain);

    } catch (error) {
      console.error('并行查询失败:', error);
      return this.createFallbackResult(cleanDomain);
    }
  }

  /**
   * 查询热门域名数据（最快）
   */
  private static async queryPopularDomains(domain: string): Promise<WhoisData | null> {
    const popularData = getPopularDomainData(domain);
    
    if (popularData) {
      return {
        domain,
        whoisServer: "热门域名数据库",
        registrar: popularData.registrar,
        registrationDate: popularData.registrationDate,
        expiryDate: popularData.expiryDate,
        nameServers: popularData.nameServers,
        registrant: "未知",
        status: popularData.status,
        rawData: `热门域名预定义数据`,
        protocol: "static",
        message: "从热门域名数据库获取"
      };
    }
    
    return null;
  }

  /**
   * 快速RDAP查询
   */
  private static async queryRDAPFast(domain: string): Promise<WhoisData | null> {
    try {
      const rdapResult = await Promise.race([
        queryRDAP(domain),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('RDAP查询超时')), 8000)
        )
      ]);

      if (rdapResult.success && rdapResult.data) {
        return {
          ...rdapResult.data,
          message: "RDAP快速查询成功"
        };
      }
    } catch (error) {
      console.log('快速RDAP查询失败:', error);
    }
    
    return null;
  }

  /**
   * 查询公共API
   */
  private static async queryPublicAPIs(domain: string): Promise<WhoisData | null> {
    const apis = [
      {
        url: `https://rdap.org/domain/${domain}`,
        parser: this.parseRDAPResponse
      },
      {
        url: `https://api.whoapi.com/?domain=${domain}&r=whois&apikey=demo`,
        parser: this.parseWhoAPIResponse
      }
    ];

    for (const api of apis) {
      try {
        const response = await axios.get(api.url, { timeout: 6000 });
        if (response.data) {
          const parsed = api.parser(response.data, domain);
          if (parsed && this.isValidResult(parsed)) {
            return parsed;
          }
        }
      } catch (error) {
        console.log(`API ${api.url} 查询失败:`, error);
      }
    }

    return null;
  }

  /**
   * 解析RDAP响应
   */
  private static parseRDAPResponse(data: any, domain: string): WhoisData | null {
    try {
      let registrar = "未知";
      let registrationDate = "未知";
      let expiryDate = "未知";
      const nameServers: string[] = [];

      // 解析实体信息
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
          }
        }
      }

      // 解析事件信息
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
        for (const ns of data.nameservers) {
          if (ns.ldhName) nameServers.push(ns.ldhName);
        }
      }

      return {
        domain,
        whoisServer: "RDAP.org",
        registrar,
        registrationDate,
        expiryDate,
        nameServers,
        registrant: "未知",
        status: data.status ? data.status.join(', ') : "未知",
        rawData: JSON.stringify(data, null, 2),
        protocol: "rdap",
        message: "公共RDAP服务查询成功"
      };
    } catch (error) {
      console.error('解析RDAP响应失败:', error);
      return null;
    }
  }

  /**
   * 解析WhoAPI响应
   */
  private static parseWhoAPIResponse(data: any, domain: string): WhoisData | null {
    try {
      if (data.status !== 1) return null;

      return {
        domain,
        whoisServer: data.whois_server || "whoapi.com",
        registrar: data.registrar || "未知",
        registrationDate: data.date_created || "未知",
        expiryDate: data.date_expires || "未知",
        nameServers: data.nameservers || [],
        registrant: data.owner || "未知",
        status: data.status_list?.join(', ') || "未知",
        rawData: data.whois_raw || "无原始数据",
        protocol: "whois",
        message: "WhoAPI查询成功"
      };
    } catch (error) {
      console.error('解析WhoAPI响应失败:', error);
      return null;
    }
  }

  /**
   * 检查结果是否有效
   */
  private static isValidResult(data: WhoisData): boolean {
    if (!data || !data.domain) return false;
    
    // 至少要有注册商或注册日期或名称服务器之一
    return (
      (data.registrar && data.registrar !== "未知") ||
      (data.registrationDate && data.registrationDate !== "未知") ||
      (data.nameServers && data.nameServers.length > 0)
    );
  }

  /**
   * 选择最佳结果
   */
  private static selectBestResult(results: WhoisData[]): WhoisData {
    // 按数据完整度排序
    return results.sort((a, b) => {
      const scoreA = this.calculateDataScore(a);
      const scoreB = this.calculateDataScore(b);
      return scoreB - scoreA;
    })[0];
  }

  /**
   * 计算数据完整度分数
   */
  private static calculateDataScore(data: WhoisData): number {
    let score = 0;
    
    if (data.registrar && data.registrar !== "未知") score += 3;
    if (data.registrationDate && data.registrationDate !== "未知") score += 2;
    if (data.expiryDate && data.expiryDate !== "未知") score += 2;
    if (data.nameServers && data.nameServers.length > 0) score += 2;
    if (data.status && data.status !== "未知") score += 1;
    
    return score;
  }

  /**
   * 缓存结果
   */
  private static cacheResult(domain: string, data: WhoisData): void {
    this.cache.set(domain, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 获取缓存结果
   */
  private static getCachedResult(domain: string): WhoisData | null {
    const cached = this.cache.get(domain);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(domain);
    }
    
    return null;
  }

  /**
   * 创建后备结果
   */
  private static createFallbackResult(domain: string): WhoisData {
    return {
      domain,
      whoisServer: "查询失败",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "查询失败",
      rawData: `域名 ${domain} 查询失败，所有数据源均无响应`,
      protocol: "error",
      message: "所有查询方法均失败"
    };
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
