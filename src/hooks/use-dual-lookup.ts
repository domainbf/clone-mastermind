
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhoisData } from "./use-whois-lookup";
import { FastDomainLookup } from "@/services/FastDomainLookup";
import { extractTLD } from "@/utils/apiUtils";
import { WHOIS_SERVERS } from "@/utils/whoisServers";
import { useQueryStats } from "@/utils/lookupStats";
import { queryDomain } from "@/api/domainApiClient";

export function useDualLookup() {
  const [whoisData, setWhoisData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specificServer, setSpecificServer] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<"RDAP" | "WHOIS" | null>(null);
  const [serversAttempted, setServersAttempted] = useState<string[]>([]);
  const { toast } = useToast();
  
  // 查询统计数据
  const { queryStats, updateStats, getQueryStats } = useQueryStats();
  
  // 使用常用WHOIS服务器列表
  const [whoisServers, setWhoisServers] = useState<Record<string, string>>(WHOIS_SERVERS);
  
  useEffect(() => {
    // 初始化WHOIS服务器列表
    setWhoisServers(WHOIS_SERVERS);
    console.log("已加载WHOIS服务器列表", Object.keys(WHOIS_SERVERS).length);
  }, []);

  // 高性能双协议查询函数
  const handleDualLookup = async (domain: string, server?: string) => {
    setLoading(true);
    setError(null);
    setWhoisData(null);
    setLastDomain(domain);
    setServersAttempted([]);
    
    try {
      console.log(`开始高性能查询: ${domain}`);
      
      toast({
        title: "查询中",
        description: `正在使用高性能并行查询域名 ${domain}...`,
      });

      // 使用新的快速域名查询服务
      const result = await FastDomainLookup.lookup(domain);
      
      if (result && result.protocol !== 'error') {
        setWhoisData(result);
        setProtocol(result.protocol === 'rdap' ? "RDAP" : "WHOIS");
        updateStats(result.protocol === 'rdap' ? 'rdapSuccess' : 'whoisSuccess');
        
        toast({
          title: "查询成功",
          description: result.message || "域名查询成功",
        });
      } else {
        // 如果快速查询失败，回退到原有的查询逻辑
        console.log("快速查询失败，使用传统方法");
        await performTraditionalLookup(domain, server);
      }
    } catch (error: any) {
      console.error("高性能查询失败:", error);
      // 回退到传统查询方法
      await performTraditionalLookup(domain, server);
    } finally {
      setLoading(false);
    }
  };

  // 传统查询方法（作为后备）
  const performTraditionalLookup = async (domain: string, server?: string) => {
    try {
      if (server) {
        setSpecificServer(server);
        setProtocol("WHOIS");
        setServersAttempted(prev => [...prev, server]);
        
        try {
          const apiResult = await queryDomain(domain, 'whois');
          setWhoisData(apiResult);
          updateStats('whoisSuccess');
          toast({
            title: "WHOIS查询成功",
            description: `使用服务器 ${server} 查询成功`,
          });
          return;
        } catch (e: any) {
          setError(`查询失败: ${e.message}`);
          updateStats('whoisFailed');
          toast({
            title: "WHOIS查询失败",
            description: `查询失败: ${e.message}`,
            variant: "destructive",
          });
        }
        return;
      }
      
      // 尝试使用统一API客户端
      try {
        const apiResult = await queryDomain(domain, 'auto');
        
        if (apiResult && apiResult.protocol !== 'error') {
          setWhoisData(apiResult);
          setProtocol(apiResult.protocol === 'rdap' ? "RDAP" : "WHOIS");
          updateStats(apiResult.protocol === 'rdap' ? 'rdapSuccess' : 'whoisSuccess');
          
          toast({
            title: `${apiResult.protocol === 'rdap' ? 'RDAP' : 'WHOIS'}查询成功`,
            description: apiResult.message || "域名查询成功",
          });
          return;
        }
      } catch (apiError) {
        console.error("API客户端查询失败:", apiError);
      }
      
      // 创建错误响应
      const errorData: WhoisData = {
        domain: domain,
        whoisServer: "查询失败",
        registrar: "未知",
        registrationDate: "未知",
        expiryDate: "未知",
        nameServers: [],
        registrant: "未知",
        status: "未知",
        rawData: `无法获取域名 ${domain} 的信息。所有查询方法均失败。`,
        protocol: 'error',
        message: "所有查询方法失败"
      };
      
      setWhoisData(errorData);
      setError("所有查询方法均失败");
      updateStats('whoisFailed');
      
      toast({
        title: "查询失败",
        description: "所有可用查询方法均失败",
        variant: "destructive",
      });
      
    } catch (error: any) {
      setError(error.message || "未知错误");
      updateStats('whoisFailed');
      
      toast({
        title: "查询失败",
        description: error.message || "未知错误",
        variant: "destructive",
      });
    }
  };

  const retryLookup = async () => {
    if (lastDomain) {
      await handleDualLookup(lastDomain);
    }
  };

  return {
    whoisData,
    loading,
    error,
    specificServer,
    lastDomain,
    protocol,
    serversAttempted,
    handleDualLookup,
    retryLookup,
    queryStats: getQueryStats()
  };
}
