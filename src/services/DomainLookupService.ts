
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
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('API响应:', response.data);

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
      
      let errorMessage = '查询失败';
      if (error.response) {
        errorMessage = `服务器错误: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else {
        errorMessage = error.message || '未知错误';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

export const domainLookupService = new DomainLookupService();
