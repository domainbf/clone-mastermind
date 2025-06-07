
import { WhoisData } from '@/hooks/use-whois-lookup';
import { formatDomain } from '@/utils/domainUtils';
import { queryMultipleRDAP } from '@/utils/rdapClient';
import { WhoisApiService } from '@/services/WhoisApiService';

/**
 * 主要的域名查询服务
 * 使用RDAP和WHOIS双系统确保查询可用性
 */
export async function lookupDomain(domain: string, protocol: 'auto' | 'rdap' | 'whois' = 'auto'): Promise<WhoisData> {
  try {
    console.log(`[DomainQueryService] 开始查询域名: ${domain}, 协议: ${protocol}`);
    
    // 格式化域名
    const cleanDomain = formatDomain(domain);
    if (!cleanDomain) {
      return createErrorResponse('无效的域名格式');
    }

    // 根据协议选择查询策略
    if (protocol === 'rdap') {
      return await queryWithRdapOnly(cleanDomain);
    } else if (protocol === 'whois') {
      return await queryWithWhoisOnly(cleanDomain);
    } else {
      return await queryWithAutoProtocol(cleanDomain);
    }
    
  } catch (error) {
    console.error(`[DomainQueryService] 查询失败:`, error);
    return createErrorResponse(error instanceof Error ? error.message : '未知错误');
  }
}

// 仅使用RDAP协议查询
async function queryWithRdapOnly(domain: string): Promise<WhoisData> {
  console.log(`[DomainQueryService] 使用RDAP协议查询: ${domain}`);
  
  const rdapResult = await queryMultipleRDAP(domain);
  
  if (rdapResult.success && rdapResult.data) {
    console.log(`[DomainQueryService] RDAP查询成功`);
    return rdapResult.data;
  }
  
  return createErrorResponse(`RDAP查询失败: ${rdapResult.message}`);
}

// 仅使用WHOIS协议查询
async function queryWithWhoisOnly(domain: string): Promise<WhoisData> {
  console.log(`[DomainQueryService] 使用WHOIS协议查询: ${domain}`);
  
  const whoisService = new WhoisApiService(domain);
  return await whoisService.lookup('whois');
}

// 自动协议选择（优先RDAP，后备WHOIS）
async function queryWithAutoProtocol(domain: string): Promise<WhoisData> {
  console.log(`[DomainQueryService] 自动协议查询: ${domain}`);
  
  // 1. 优先尝试RDAP
  try {
    const rdapResult = await queryMultipleRDAP(domain);
    
    if (rdapResult.success && rdapResult.data) {
      // 检查RDAP数据质量
      const data = rdapResult.data;
      const hasGoodData = 
        data.registrar !== "未知" || 
        data.registrationDate !== "未知" || 
        data.nameServers.length > 0;
      
      if (hasGoodData) {
        console.log(`[DomainQueryService] RDAP查询成功，数据质量良好`);
        return data;
      } else {
        console.log(`[DomainQueryService] RDAP查询成功但数据质量不佳，尝试WHOIS补充`);
      }
    }
  } catch (rdapError) {
    console.warn(`[DomainQueryService] RDAP查询失败:`, rdapError);
  }
  
  // 2. 后备使用WHOIS
  try {
    console.log(`[DomainQueryService] 使用WHOIS作为后备查询`);
    const whoisService = new WhoisApiService(domain);
    const whoisResult = await whoisService.lookup('whois');
    
    if (whoisResult.protocol !== 'error') {
      return whoisResult;
    }
  } catch (whoisError) {
    console.error(`[DomainQueryService] WHOIS查询也失败:`, whoisError);
  }
  
  return createErrorResponse('RDAP和WHOIS查询均失败');
}

// 创建错误响应
function createErrorResponse(errorMessage: string): WhoisData {
  return {
    domain: "",
    whoisServer: "查询失败",
    registrar: "未知",
    registrationDate: "未知",
    expiryDate: "未知",
    nameServers: [],
    registrant: "未知",
    status: "查询失败",
    protocol: "error",
    rawData: errorMessage,
    message: `错误: ${errorMessage}`
  };
}
