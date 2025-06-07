import { useState } from "react";
import { WhoisData } from "./use-whois-lookup";
import axios from 'axios';
import { useToast } from "@/hooks/use-toast";
import { getPopularDomainData } from "@/utils/popularDomainsService";
import { extractErrorDetails, isDomainAvailable, isDomainReserved } from "@/utils/domainUtils";

export interface ApiLookupResult {
  domain: string;
  isAvailable?: boolean;
  isReserved?: boolean;
  registrar?: string;
  creationDate?: string;
  expiryDate?: string;
  price?: {
    currency: string;
    symbol: string;
    registration: string;
    renewal: string;
  };
  rawData?: string;
  error?: string;
  suggestedServer?: string;
  message?: string;
  data?: any;
}

export function useApiLookup() {
  const [result, setResult] = useState<ApiLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const handleLookup = async (domain: string, server?: string): Promise<ApiLookupResult> => {
    if (!domain) return { domain: '', error: 'No domain provided' };
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    console.log(`开始API查询域名: ${domain}`);
    
    try {
      // 获取域名价格信息
      let priceData = null;
      try {
        priceData = await queryDomainPrice(domain);
        console.log('价格数据:', priceData);
      } catch (priceError) {
        console.error('价格查询失败:', priceError);
        // 价格查询失败不影响继续
      }
      
      // 查询WHOIS信息
      const whoisData = await queryWhoisAPI(domain, server);
      console.log('WHOIS API结果:', whoisData);
      
      // 检查数据完整性
      let isComplete = whoisData.registrar !== "未知" && 
                      whoisData.registrationDate !== "未知" &&
                      whoisData.nameServers.length > 0;
                      
      // 如果API结果不完整，检查是否为已知的流行域名
      if (!isComplete) {
        console.log('API查询结果不完整，检查是否为已知流行域名');
        const popularInfo = await getPopularDomainData(domain);
        
        if (popularInfo) {
          console.log('找到流行域名信息:', popularInfo);
          // 合并信息
          if (popularInfo.registrar && whoisData.registrar === "未知") {
            whoisData.registrar = popularInfo.registrar;
          }
          
          if ((popularInfo.created || popularInfo.registrationDate || popularInfo.creationDate) && whoisData.registrationDate === "未知") {
            whoisData.registrationDate = popularInfo.created || popularInfo.registrationDate || popularInfo.creationDate || "";
          }
          
          if ((popularInfo.expires || popularInfo.expiryDate) && whoisData.expiryDate === "未知") {
            whoisData.expiryDate = popularInfo.expires || popularInfo.expiryDate;
          }
          
          if ((popularInfo.nameServers || popularInfo.nameservers) && 
              (popularInfo.nameServers?.length > 0 || popularInfo.nameservers?.length > 0) && 
              whoisData.nameServers.length === 0) {
            whoisData.nameServers = popularInfo.nameServers || popularInfo.nameservers || [];
          }
        }
      }
      
      // 尝试从原始数据提取额外信息
      const rawData = whoisData.rawData;
      let isAvailable = isDomainAvailable(rawData);
      let isReserved = isDomainReserved(rawData);
      
      // 解析附加数据
      const additionalData = {
        domain,
        registrar: whoisData.registrar,
        creationDate: whoisData.registrationDate,
        expiryDate: whoisData.expiryDate,
        isAvailable,
        isReserved,
        suggestedServer: whoisData.whoisServer !== "未知" ? whoisData.whoisServer : undefined,
        message: whoisData.message
      };
      
      if (priceData && priceData.code === 200) {
        additionalData['price'] = {
          currency: priceData.currency || 'USD',
          symbol: priceData.currency_symbol || '$',
          registration: priceData.new || '未知',
          renewal: priceData.renew || '未知'
        };
      }
      
      console.log('成功解析附加数据:', additionalData);
      
      // Create a result object with data field to match the expected structure
      const result: ApiLookupResult = {
        ...additionalData,
        rawData: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
        data: whoisData
      };
      
      // 设置最终结果
      setResult(result);
      
      // 根据可用性显示通知
      if (isAvailable) {
        toast({
          title: "域名可注册",
          description: `域名 ${domain} 当前可注册`,
          variant: "default",
        });
      } else if (isReserved) {
        toast({
          title: "域名已保留",
          description: `域名 ${domain} 为保留域名，无法注册`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "域名已注册",
          description: `域名 ${domain} 已被注册`,
          variant: "default",
        });
      }
      
      return result;
    } catch (err: any) {
      console.error('API查询出错:', err);
      const errorDetails = extractErrorDetails(err);
      setError(errorDetails);
      
      toast({
        title: "查询失败",
        description: errorDetails,
        variant: "destructive",
      });
      
      // 设置错误结果
      const errorResult: ApiLookupResult = {
        domain,
        error: errorDetails,
        rawData: err.message
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  };

  return {
    result,
    loading,
    error,
    handleLookup
  };
}
