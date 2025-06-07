
import axios from 'axios';
import { WhoisData } from '@/hooks/use-whois-lookup';
import { buildApiUrl, retryRequest, formatDomain, extractTLD, getMockWhoisResponse } from '@/utils/apiUtils';
import { getWhoisServer } from '@/utils/whoisServers';

// API查询配置
interface ApiEndpoint {
  url: string;
  method: 'get' | 'post';
  data?: any;
  headers?: Record<string, string>;
  process: (response: any) => WhoisData;
}

/**
 * WhoisAPI服务 - 提供多种方式获取域名数据
 */
export class WhoisApiService {
  private domain: string;
  private tld: string | null;
  private querySources: string[] = [];
  
  constructor(domainInput: string) {
    this.domain = formatDomain(domainInput);
    this.tld = extractTLD(this.domain);
  }
  
  /**
   * 执行多源查询 - 使用多个API和方法查询域名信息
   */
  async lookup(preferredProtocol: "auto" | "rdap" | "whois" = "auto"): Promise<WhoisData> {
    console.log(`开始为${this.domain}执行多源查询，首选协议: ${preferredProtocol}`);
    
    try {
      // 根据首选协议调整查询顺序
      if (preferredProtocol === "rdap") {
        // 1. 首先尝试RDAP查询
        const rdapResult = await this.tryRdapLookup();
        if (rdapResult) return rdapResult;
        
        console.log("用户选择仅使用RDAP，但RDAP查询失败");
        return this.createErrorResponse("RDAP查询失败，无法获取信息");
      } 
      else if (preferredProtocol === "whois") {
        // 1. 首先尝试本地API端点 (WHOIS)
        const localApiResult = await this.tryLocalApis();
        if (localApiResult) return localApiResult;
        
        // 2. 尝试远程公共WHOIS API
        const publicApiResult = await this.tryPublicApis();
        if (publicApiResult) return publicApiResult;
      }
      else {
        // 自动模式: 同时尝试RDAP和WHOIS
        
        // 1. 尝试RDAP查询
        const rdapResult = await this.tryRdapLookup();
        if (rdapResult) return rdapResult;
        
        // 2. 尝试本地API端点
        const localApiResult = await this.tryLocalApis();
        if (localApiResult) return localApiResult;
        
        // 3. 尝试远程公共WHOIS API
        const publicApiResult = await this.tryPublicApis();
        if (publicApiResult) return publicApiResult;
      }
      
      // 如果所有查询都失败，返回错误
      console.log("所有查询方法均失败");
      this.querySources.push('all-failed');
      return this.createErrorResponse("无法获取域名信息，所有查询方法均失败");
    } catch (error) {
      console.error("WhoisApiService查询失败:", error);
      
      return this.createErrorResponse(
        `查询失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * 尝试本地API端点
   */
  private async tryLocalApis(): Promise<WhoisData | null> {
    const apiPaths = [
      '/api/whois',
      '/api/direct-whois'
    ];
    
    for (const path of apiPaths) {
      try {
        console.log(`尝试本地API: ${path}`);
        const apiUrl = buildApiUrl(path);
        this.querySources.push(`local-api:${path}`);
        
        const response = await retryRequest(() => 
          axios.post(apiUrl, {
            domain: this.domain,
            server: getWhoisServer(this.domain),
            timeout: 10000,
            mode: 'auto'
          }, {
            timeout: 12000
          }),
          2, // 重试次数
          500, // 初始延迟
          2,   // 退避因子
          3000 // 最大延迟
        );
        
        if (response.data && response.data.domain && response.data.domain === this.domain) {
          console.log(`本地API ${path} 查询成功`);
          const apiData = response.data;
          
          // 确保protocol字段使用正确的联合类型
          const protocol = (apiData.protocol === 'rdap' || apiData.protocol === 'whois') 
            ? apiData.protocol as "rdap" | "whois" 
            : "whois" as "rdap" | "whois" | "error";
          
          return {
            domain: this.domain,
            whoisServer: apiData.whoisServer || "本地API",
            registrar: apiData.registrar || "未知",
            registrationDate: apiData.registrationDate || apiData.creationDate || "未知",
            expiryDate: apiData.expiryDate || "未知",
            nameServers: apiData.nameServers || [],
            registrant: apiData.registrant || "未知",
            status: apiData.status || "未知",
            rawData: apiData.rawData || `从本地API (${path}) 获取的数据`,
            protocol,
            message: `通过本地API (${path}) 成功获取数据`
          };
        }
      } catch (error) {
        console.error(`本地API ${path} 查询失败:`, error);
      }
    }
    
    return null;
  }
  
  /**
   * 尝试RDAP查询
   */
  private async tryRdapLookup(): Promise<WhoisData | null> {
    try {
      this.querySources.push('rdap');
      console.log("尝试RDAP查询");
      
      const tld = this.tld;
      if (!tld) return null;
      
      // RDAP服务器映射
      const rdapServers: Record<string, string> = {
        'com': 'https://rdap.verisign.com/com/v1',
        'net': 'https://rdap.verisign.com/net/v1',
        'org': 'https://rdap.org',
        'io': 'https://rdap.nic.io',
        'ai': 'https://rdap.nic.ai'
      };
      
      const servers = [
        rdapServers[tld],
        'https://rdap.org'
      ].filter(Boolean);
      
      for (const baseServer of servers) {
        try {
          const rdapUrl = `${baseServer}${baseServer.endsWith('/') ? '' : '/'}domain/${this.domain}`;
          console.log(`尝试RDAP服务器: ${rdapUrl}`);
          
          const response = await axios.get(rdapUrl, {
            timeout: 8000,
            headers: {
              'Accept': 'application/rdap+json, application/json',
              'User-Agent': 'Domain-Lookup-Tool/1.0'
            }
          });
          
          if (response.data && response.status === 200) {
            console.log(`RDAP查询成功: ${baseServer}`);
            
            const rdapData = response.data;
            let registrar = "未知";
            let registrationDate = "未知";
            let expiryDate = "未知";
            let nameServers: string[] = [];
            let status = "未知";
            
            // 解析注册商
            if (rdapData.entities) {
              for (const entity of rdapData.entities) {
                if (entity.roles?.includes('registrar')) {
                  if (entity.vcardArray?.[1]) {
                    for (const vcard of entity.vcardArray[1]) {
                      if (vcard[0] === 'fn') {
                        registrar = vcard[3];
                        break;
                      }
                    }
                  }
                  if (registrar === "未知" && entity.handle) {
                    registrar = entity.handle;
                  }
                  break;
                }
              }
            }
            
            // 解析日期
            if (rdapData.events) {
              for (const event of rdapData.events) {
                if (event.eventAction === 'registration') {
                  registrationDate = event.eventDate;
                } else if (event.eventAction === 'expiration') {
                  expiryDate = event.eventDate;
                }
              }
            }
            
            // 解析DNS服务器
            if (rdapData.nameservers) {
              nameServers = rdapData.nameservers.map((ns: any) => 
                ns.ldhName || ns.unicodeName || ''
              ).filter(Boolean);
            }
            
            // 解析状态
            if (rdapData.status && Array.isArray(rdapData.status)) {
              status = rdapData.status.join(', ');
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
              rawData: JSON.stringify(rdapData, null, 2),
              protocol: "rdap" as "rdap" | "whois" | "error",
              message: `通过RDAP协议成功获取数据 (${baseServer})`
            };
          }
        } catch (error) {
          console.error(`RDAP服务器 ${baseServer} 查询失败:`, error);
        }
      }
    } catch (error) {
      console.error("RDAP查询过程中出错:", error);
    }
    
    return null;
  }
  
  /**
   * 尝试公共WHOIS API
   */
  private async tryPublicApis(): Promise<WhoisData | null> {
    this.querySources.push('public-apis');
    console.log("尝试公共WHOIS API");
    
    const endpoints: ApiEndpoint[] = [
      {
        url: `https://api.whoapi.com/?domain=${this.domain}&r=whois&apikey=demo`,
        method: 'get',
        process: (data: any) => {
          return {
            domain: this.domain,
            whoisServer: data.whois_server || "whoapi.com",
            registrar: data.registrar || "未知",
            registrationDate: data.date_created || "未知",
            expiryDate: data.date_expires || "未知", 
            nameServers: data.nameservers || [],
            registrant: data.owner || "未知",
            status: data.status || "未知",
            rawData: data.whois_raw || `从whoapi.com获取 ${this.domain} 的数据`,
            protocol: "whois" as "rdap" | "whois" | "error",
            message: "通过whoapi.com获取的数据"
          };
        }
      }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await retryRequest(() => {
          return axios.get(endpoint.url, {
            timeout: 10000,
            headers: endpoint.headers
          });
        }, 2);
        
        if (response.data && response.data.status === 1) {
          console.log(`公共API查询成功: ${endpoint.url}`);
          return endpoint.process(response.data);
        }
      } catch (error) {
        console.error(`公共API查询失败 ${endpoint.url}:`, error);
      }
    }
    
    return null;
  }
  
  /**
   * 创建错误响应对象
   */
  private createErrorResponse(errorMessage: string): WhoisData {
    return {
      domain: this.domain,
      whoisServer: "查询失败",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "查询失败",
      rawData: `域名查询失败: ${this.domain}\n错误: ${errorMessage}\n\n尝试的查询源: ${this.querySources.join(', ')}`,
      protocol: "error" as "rdap" | "whois" | "error",
      message: errorMessage
    };
  }
  
  /**
   * 获取已尝试的查询源
   */
  getQuerySources(): string[] {
    return this.querySources;
  }
}

/**
 * 创建统一的域名查询函数
 */
export async function lookupDomain(domain: string, preferredProtocol: "auto" | "rdap" | "whois" = "auto"): Promise<WhoisData> {
  const service = new WhoisApiService(domain);
  return await service.lookup(preferredProtocol);
}
