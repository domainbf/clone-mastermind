import axios from 'axios';
import whoisServers from '../data/whois-servers.json'; // 导入 JSON 文件

// Mapping of domain statuses to Chinese translations
const DOMAIN_STATUS_TRANSLATIONS: Record<string, string> = {
  'active': '正常',
  'clientTransferProhibited': '注册商禁止转移',
  'pendingDelete': '待删除',
  'redemptionPeriod': '赎回期',
  'serverHold': '注册局暂停',
};

// Get domain age tags based on renewal period
function getDomainAgeTags(renewalYears: number): string[] {
  if (renewalYears >= 10) return ['10年老米'];
  if (renewalYears >= 5) return ['5年老米'];
  if (renewalYears >= 2) return ['2年域名'];
  if (renewalYears >= 1) return ['1年域名'];
  return ['新注册'];
}

async function queryRDAP(domain: string): Promise<any> {
  try {
    const response = await axios.get(`https://rdap.org/domain/${domain}`);
    if (response.data) {
      console.log('RDAP query successful:', response.data);
      return response.data;
    }
  } catch (error) {
    console.error('RDAP query failed:', error.message);
  }
  return null;
}

async function queryWHOIS(domain: string): Promise<any> {
  try {
    const tld = domain.split('.').pop();
    const whoisServer = whoisServers[tld || ''];

    if (!whoisServer) {
      throw new Error(`No WHOIS server found for TLD: ${tld}`);
    }

    const response = await axios.get(`https://${whoisServer}/whois?domain=${domain}`);
    if (response.data) {
      console.log('WHOIS query successful:', response.data);
      return response.data;
    }
  } catch (error) {
    console.error('WHOIS query failed:', error.message);
  }
  return null;
}

function translateDomainStatus(status: string): string {
  return DOMAIN_STATUS_TRANSLATIONS[status] || '未知状态';
}

export async function lookupDomain(domain: string): Promise<any> {
  const rdapResult = await queryRDAP(domain);
  if (rdapResult) {
    return {
      source: 'RDAP',
      domain,
      status: rdapResult.status ? rdapResult.status.map(translateDomainStatus) : ['未知状态'],
      tags: rdapResult.events ? getDomainAgeTags(rdapResult.events.length) : [],
    };
  }
  console.log('whoisServers:', whoisServers);
  console.log('tld:', tld, 'whoisServer:', whoisServer);
  console.log('Falling back to WHOIS query...');
  const whoisResult = await queryWHOIS(domain);

  if (whoisResult) {
    return {
      source: 'WHOIS',
      domain,
      status: whoisResult.status ? whoisResult.status.map(translateDomainStatus) : ['未知状态'],
      tags: whoisResult.renewalYears ? getDomainAgeTags(whoisResult.renewalYears) : [],
    };
  }

  return {
    domain,
    status: ['域名尚未注册或被保留'],
    tags: ['未注册'],
  };
}
