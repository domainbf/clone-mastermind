
import axios from 'axios';
import { WhoisData } from '@/hooks/use-whois-lookup';

export interface DomainQueryResult {
  success: boolean;
  data?: WhoisData;
  error?: string;
  protocol?: 'rdap' | 'whois';
}

export class DomainLookupService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = window.location.origin;
  }

  async queryDomain(domain: string): Promise<DomainQueryResult> {
    try {
      console.log(`开始查询域名: ${domain}`);
      
      const response = await axios.post(`${this.baseUrl}/api/whois`, {
        domain: domain.toLowerCase().trim()
      }, {
        timeout: 15000
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          protocol: response.data.protocol
        };
      } else {
        return {
          success: false,
          error: response.data.error || '查询失败'
        };
      }
    } catch (error: any) {
      console.error('域名查询错误:', error);
      return {
        success: false,
        error: `查询失败: ${error.message || '网络错误'}`
      };
    }
  }
}

export const domainLookupService = new DomainLookupService();
