
import axios from 'axios';
import { WhoisData } from '@/hooks/use-whois-lookup';

// RDAP服务器列表
const RDAP_SERVERS: Record<string, string[]> = {
  'com': [
    'https://rdap.verisign.com/com/v1',
    'https://rdap.org'
  ],
  'net': [
    'https://rdap.verisign.com/net/v1',
    'https://rdap.org'
  ],
  'org': ['https://rdap.org'],
  'info': ['https://rdap.afilias.net/rdap'],
  'biz': ['https://rdap.nic.biz'],
  'io': ['https://rdap.nic.io'],
  'ai': ['https://rdap.nic.ai'],
  'co': ['https://rdap.nic.co'],
  'me': ['https://rdap.nic.me'],
  'tv': ['https://rdap.nic.tv']
};

// 通用RDAP服务器备选列表
const FALLBACK_RDAP_SERVERS = [
  'https://rdap.org',
  'https://rdap.iana.org'
];

export interface RDAPResponse {
  success: boolean;
  data?: WhoisData;
  message?: string;
}

// 从RDAP数据提取信息
function parseRDAPData(rdapData: any, domain: string): WhoisData {
  try {
    console.log('解析RDAP数据:', rdapData);
    
    const result: WhoisData = {
      domain: domain,
      whoisServer: "RDAP查询",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "未知",
      rawData: JSON.stringify(rdapData, null, 2),
      protocol: "rdap"
    };

    // 提取注册商信息
    if (rdapData.entities) {
      for (const entity of rdapData.entities) {
        if (entity.roles && entity.roles.includes('registrar')) {
          if (entity.vcardArray && entity.vcardArray[1]) {
            for (const vcard of entity.vcardArray[1]) {
              if (vcard[0] === 'fn') {
                result.registrar = vcard[3];
                break;
              }
            }
          }
          if (result.registrar === "未知" && entity.handle) {
            result.registrar = entity.handle;
          }
          break;
        }
      }
    }

    // 提取日期信息
    if (rdapData.events) {
      for (const event of rdapData.events) {
        if (event.eventAction === 'registration') {
          result.registrationDate = event.eventDate;
        } else if (event.eventAction === 'expiration') {
          result.expiryDate = event.eventDate;
        }
      }
    }

    // 提取DNS服务器
    if (rdapData.nameservers) {
      result.nameServers = rdapData.nameservers.map((ns: any) => 
        ns.ldhName || ns.unicodeName || ns.handle || ''
      ).filter(Boolean);
    }

    // 提取状态
    if (rdapData.status && Array.isArray(rdapData.status)) {
      result.status = rdapData.status.join(', ');
    }

    // 提取注册人信息
    if (rdapData.entities) {
      for (const entity of rdapData.entities) {
        if (entity.roles && entity.roles.includes('registrant')) {
          if (entity.vcardArray && entity.vcardArray[1]) {
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

    console.log('RDAP解析结果:', result);
    return result;
  } catch (error) {
    console.error('RDAP数据解析错误:', error);
    return {
      domain: domain,
      whoisServer: "RDAP错误",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "解析错误",
      rawData: JSON.stringify(rdapData, null, 2),
      protocol: "rdap",
      message: `RDAP数据解析失败: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
}

// 查询单个RDAP服务器
async function queryRDAPServer(domain: string, server: string): Promise<RDAPResponse> {
  try {
    const url = `${server}${server.endsWith('/') ? '' : '/'}domain/${domain}`;
    console.log(`查询RDAP服务器: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'Accept': 'application/rdap+json, application/json',
        'User-Agent': 'Domain-Lookup-Tool/1.0'
      }
    });

    if (response.status === 200 && response.data) {
      const parsedData = parseRDAPData(response.data, domain);
      
      // 检查数据质量
      const hasValidData = 
        parsedData.registrar !== "未知" || 
        parsedData.registrationDate !== "未知" ||
        parsedData.nameServers.length > 0;

      if (hasValidData) {
        return {
          success: true,
          data: parsedData,
          message: `RDAP查询成功 (${server})`
        };
      }
    }
    
    return {
      success: false,
      message: `RDAP服务器返回了无效数据 (${server})`
    };
  } catch (error: any) {
    console.error(`RDAP服务器查询失败 ${server}:`, error);
    return {
      success: false,
      message: `RDAP查询失败: ${error.message || '网络错误'}`
    };
  }
}

// 主要的RDAP查询函数
export async function queryRDAP(domain: string): Promise<RDAPResponse> {
  console.log(`开始RDAP查询: ${domain}`);
  
  // 获取顶级域名
  const tld = domain.split('.').pop()?.toLowerCase();
  if (!tld) {
    return {
      success: false,
      message: "无法识别域名的顶级域名"
    };
  }

  // 获取该TLD的RDAP服务器列表
  const servers = RDAP_SERVERS[tld] || FALLBACK_RDAP_SERVERS;
  
  // 依次尝试每个服务器
  for (const server of servers) {
    const result = await queryRDAPServer(domain, server);
    if (result.success) {
      return result;
    }
  }

  // 如果TLD特定服务器都失败，尝试通用服务器
  if (RDAP_SERVERS[tld]) {
    console.log('TLD特定服务器失败，尝试通用RDAP服务器');
    for (const server of FALLBACK_RDAP_SERVERS) {
      const result = await queryRDAPServer(domain, server);
      if (result.success) {
        return result;
      }
    }
  }

  return {
    success: false,
    message: "所有RDAP服务器查询均失败"
  };
}

// 查询多个RDAP服务器
export async function queryMultipleRDAP(domain: string): Promise<RDAPResponse> {
  return await queryRDAP(domain);
}
