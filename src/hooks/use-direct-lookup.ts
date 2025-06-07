
import { useState } from "react";
import { WhoisData } from "./use-whois-lookup";
import axios from 'axios';
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl, getMockWhoisResponse, retryRequest, fetchFromMultipleAPIs, formatDomain } from "@/utils/apiUtils";
import { getPopularDomainData } from "@/utils/popularDomainsService";
import { clientFallbackLookup } from "@/utils/clientFallback";

export const useDirectLookup = () => {
  const { toast } = useToast();
  const [lastStatus, setLastStatus] = useState<{success: boolean, source: string} | null>(null);
  
  const performDirectLookup = async (domain: string): Promise<WhoisData> => {
    console.log("开始直接WHOIS查询:", domain);
    setLastStatus(null);
    
    try {
      // 通知用户查询开始
      toast({
        title: "直接查询中",
        description: `正在使用多个API服务查询域名 ${domain}...`,
      });
      
      // 确保域名格式正确
      const formattedDomain = formatDomain(domain);
      console.log(`格式化后的域名: ${formattedDomain}`);
      
      // 构建正确的API URL - 先尝试相对路径
      let apiUrl = buildApiUrl('/api/direct-whois');
      console.log(`使用API路径: ${apiUrl}`);
      
      try {
        // 首先尝试简单的API请求
        const simpleResponse = await axios.post(apiUrl, { 
          domain: formattedDomain,
          timeout: 10000
        }, {
          timeout: 12000
        }).catch(e => {
          console.log("简单API请求失败，尝试替代方法:", e.message);
          throw e;  // 传递错误
        });
        
        // 如果API成功返回数据
        if (simpleResponse && simpleResponse.data && simpleResponse.data.success && simpleResponse.data.data) {
          console.log("直接WHOIS查询成功:", simpleResponse.data);
          setLastStatus({success: true, source: simpleResponse.data.source || "api"});
          
          toast({
            title: "查询成功",
            description: `成功从 ${simpleResponse.data.source || "API"} 获取域名信息`,
          });
          
          // 确保protocol字段是正确的类型
          const protocol = simpleResponse.data.data.protocol as "rdap" | "whois" | "error";
          
          return {
            ...simpleResponse.data.data,
            protocol
          };
        }
        
        // API返回错误
        if (simpleResponse && simpleResponse.data && simpleResponse.data.error) {
          console.log("直接WHOIS查询返回错误:", simpleResponse.data.error);
          setLastStatus({success: false, source: "api-error"});
          
          toast({
            title: "API查询错误",
            description: simpleResponse.data.error,
            variant: "destructive",
          });
          
          // 如果有数据，还是尝试使用
          if (simpleResponse.data.data) {
            const protocol = simpleResponse.data.data.protocol as "rdap" | "whois" | "error";
            return {
              ...simpleResponse.data.data,
              protocol
            };
          }
        }
        
        throw new Error("直接API查询未返回有效数据");
      } catch (apiError: any) {
        // 第一次API调用失败，尝试其他API路径
        console.warn("主API调用失败，尝试替代路径:", apiError.message);
        setLastStatus({success: false, source: "api-failed"});
        
        // 尝试其他可能的API路径
        const possiblePaths = [
          '/direct-whois',
          '/api/whois',
          '/whois',
          '/api/domain',
          '/domain'
        ];
        
        for (const path of possiblePaths) {
          try {
            apiUrl = buildApiUrl(path);
            console.log(`尝试替代API路径: ${apiUrl}`);
            
            const altResponse = await axios.post(apiUrl, { 
              domain: formattedDomain,
              timeout: 8000
            }, {
              timeout: 10000
            });
            
            if (altResponse && altResponse.data && altResponse.data.success && altResponse.data.data) {
              console.log(`通过替代路径 ${path} 成功获取数据:`, altResponse.data);
              setLastStatus({success: true, source: altResponse.data.source || "alt-api"});
              
              toast({
                title: "查询成功",
                description: `通过替代API获取了域名信息`,
              });
              
              // 确保protocol字段是正确的类型
              const protocol = altResponse.data.data.protocol as "rdap" | "whois" | "error";
              
              return {
                ...altResponse.data.data,
                protocol
              };
            }
          } catch (altError) {
            console.log(`替代路径 ${path} 也失败:`, altError);
          }
        }
        
        // 尝试客户端后备机制 - 针对Lovable环境添加的特殊处理
        console.log("尝试客户端后备机制...");
        const clientFallbackResult = await clientFallbackLookup(formattedDomain);
        
        if (clientFallbackResult && clientFallbackResult.success) {
          console.log("使用客户端后备机制成功:", clientFallbackResult.source);
          setLastStatus({success: true, source: clientFallbackResult.source});
          
          toast({
            title: "查询成功",
            description: "使用客户端后备机制获取了域名信息",
          });
          
          return clientFallbackResult.data;
        }
        
        // 如果客户端后备也失败，尝试使用外部公开API
        console.log("客户端后备失败，尝试公开API...");
        const publicApiResult = await fetchFromMultipleAPIs(formattedDomain);
        
        if (publicApiResult && publicApiResult.success && publicApiResult.data) {
          console.log("通过公开API成功获取数据:", publicApiResult.source);
          setLastStatus({success: true, source: publicApiResult.source || "public-api"});
          
          toast({
            title: "查询成功",
            description: `使用公开API (${publicApiResult.source}) 获取了域名信息`,
          });
          
          return publicApiResult.data;
        }
        
        // 尝试使用预定义域名数据作为后备
        const popularDomainInfo = getPopularDomainData(formattedDomain);
        if (popularDomainInfo) {
          console.log("直接查询失败，但找到预定义域名数据:", popularDomainInfo);
          setLastStatus({success: true, source: "predefined"});
          
          toast({
            title: "使用预定义数据",
            description: "API查询失败，但找到了预定义数据",
          });
          
          // 从热门域名数据创建WhoisData对象
          return {
            domain: formattedDomain,
            whoisServer: "预定义数据库",
            registrar: popularDomainInfo.registrar || "未知",
            registrationDate: popularDomainInfo.registrationDate || "未知",
            expiryDate: popularDomainInfo.expiryDate || "未知",
            nameServers: popularDomainInfo.nameServers || [],
            registrant: "未知",
            status: popularDomainInfo.status || "未知",
            rawData: `Fallback data for ${formattedDomain}. Popular domain information retrieved from predefined database.`,
            message: "使用预定义的域名数据",
            protocol: "whois" as "rdap" | "whois" | "error"
          };
        }
        
        // 如果以上方法都失败了，使用模拟数据
        console.warn("所有直接查询方法均失败，使用模拟数据:", apiError.message);
        setLastStatus({success: false, source: "mock"});
        
        // 获取模拟响应
        const mockResponse = getMockWhoisResponse(formattedDomain);
        console.log("使用模拟数据:", mockResponse);
        
        toast({
          title: "使用模拟数据",
          description: "所有查询方法都失败，使用模拟数据进行演示",
        });
        
        return mockResponse.data;
      }
    } catch (error: any) {
      console.error("直接WHOIS查询出错:", error);
      setLastStatus({success: false, source: "error"});
      
      toast({
        title: "查询失败",
        description: error.message || "未知错误",
        variant: "destructive",
      });
      
      // 创建最小响应
      return {
        domain,
        whoisServer: "直接查询失败",
        registrar: "未知",
        registrationDate: "未知",
        expiryDate: "未知",
        nameServers: [],
        registrant: "未知",
        status: "未知",
        rawData: `Fallback response for ${domain}. ${error.message || "Direct WHOIS query failed."}`,
        message: `直接查询失败: ${error.message || "未知错误"}`,
        protocol: "error" as "rdap" | "whois" | "error"
      };
    }
  };

  return { 
    performDirectLookup,
    lastStatus
  };
};
