
import axios from 'axios';
import { WhoisData } from '@/hooks/use-whois-lookup';
import { getRdapServer } from '@/utils/whoisServers';
import { formatDomain } from '@/utils/domainUtils';

interface RdapResponse {
  success: boolean;
  data?: WhoisData;
  message: string;
}

// 解析RDAP响应数据
function parseRdapData(rdapData: any, domain: string): WhoisData {
  // 提取注册商信息
  let registrar = "未知";
  if (rdapData.entities) {
    for (const entity of rdapData.entities) {
      if (entity.roles && entity.roles.includes("registrar")) {
        registrar = entity.vcardArray?.[1]?.find((vcard: any) => vcard[0] === "fn")?.[3] || 
                   entity.publicIds?.[0]?.identifier || 
                   entity.handle || 
                   registrar;
        break;
      }
    }
  }

  // 提取日期信息
  let registrationDate = "未知";
  let expiryDate = "未知";
  if (rdapData.events) {
    for (const event of rdapData.events) {
      if (event.eventAction === "registration") {
        registrationDate = event.eventDate.split('T')[0];
      }
      if (event.eventAction === "expiration") {
        expiryDate = event.eventDate.split('T')[0];
      }
    }
  }

  // 提取名称服务器
  const nameServers: string[] = [];
  if (rdapData.nameservers) {
    for (const ns of rdapData.nameservers) {
      if (ns.ldhName) {
        nameServers.push(ns.ldhName.toLowerCase());
      }
    }
  }

  // 提取状态信息
  let status = "未知";
  if (rdapData.status && Array.isArray(rdapData.status)) {
    status = rdapData.status.join(", ");
  }

  return {
    domain: domain,
    whoisServer: "RDAP",
    registrar: registrar,
    registrationDate: registrationDate,
    expiryDate: expiryDate,
    nameServers: nameServers,
    registrant: "未知", // RDAP通常不直接暴露注册人信息
    status: status,
    rawData: JSON.stringify(rdapData, null, 2),
    protocol: "rdap",
    message: "通过RDAP协议获取的数据"
  };
}

// 查询RDAP数据
export async function queryRDAP(domain: string): Promise<RdapResponse> {
  try {
    const cleanDomain = formatDomain(domain);
    console.log(`开始RDAP查询: ${cleanDomain}`);
    
    // 获取对应的RDAP服务器
    const rdapServer = getRdapServer(cleanDomain);
    console.log(`使用RDAP服务器: ${rdapServer}`);
    
    // 构建RDAP查询URL
    const rdapUrl = `${rdapServer}/domain/${cleanDomain}`;
    
    // 发送RDAP请求
    const response = await axios.get(rdapUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/rdap+json, application/json',
        'User-Agent': 'Domain-Lookup-Tool/1.0'
      }
    });

    console.log('RDAP响应:', response.data);

    // 检查响应状态
    if (response.status === 200 && response.data) {
      // 解析RDAP数据
      const whoisData = parseRdapData(response.data, cleanDomain);
      
      return {
        success: true,
        data: whoisData,
        message: "RDAP查询成功"
      };
    } else {
      return {
        success: false,
        message: "RDAP服务器返回无效响应"
      };
    }
  } catch (error: any) {
    console.error('RDAP查询失败:', error);
    
    // 检查是否是404错误（域名未注册）
    if (error.response?.status === 404) {
      return {
        success: false,
        message: "域名未注册或不存在"
      };
    }
    
    return {
      success: false,
      message: `RDAP查询失败: ${error.message}`
    };
  }
}

// 尝试多个RDAP服务器
export async function queryMultipleRDAP(domain: string): Promise<RdapResponse> {
  const cleanDomain = formatDomain(domain);
  
  // 备用RDAP服务器列表
  const fallbackServers = [
    'https://rdap.org',
    'https://rdap.arin.net',
    'https://rdap.apnic.net'
  ];
  
  // 首先尝试官方服务器
  try {
    const primaryResult = await queryRDAP(cleanDomain);
    if (primaryResult.success) {
      return primaryResult;
    }
  } catch (error) {
    console.warn('主RDAP服务器查询失败，尝试备用服务器');
  }
  
  // 尝试备用服务器
  for (const server of fallbackServers) {
    try {
      console.log(`尝试备用RDAP服务器: ${server}`);
      
      const response = await axios.get(`${server}/domain/${cleanDomain}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/rdap+json, application/json',
          'User-Agent': 'Domain-Lookup-Tool/1.0'
        }
      });
      
      if (response.status === 200 && response.data) {
        const whoisData = parseRdapData(response.data, cleanDomain);
        
        return {
          success: true,
          data: whoisData,
          message: `通过备用RDAP服务器 (${server}) 获取数据`
        };
      }
    } catch (error) {
      console.warn(`备用RDAP服务器 ${server} 查询失败:`, error);
    }
  }
  
  return {
    success: false,
    message: "所有RDAP服务器查询均失败"
  };
}
