import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhoisData } from "./use-whois-lookup";
import { queryRDAP } from "@/utils/rdapClient";
import { extractTLD } from "@/utils/apiUtils";
import { getWhoisServer } from "@/utils/domainUtils";
import { directWhoisQuery, localWhoisQuery } from "@/utils/whoisQueries";
import { getWhoisServer as getLocalWhoisServer, WHOIS_SERVERS } from "@/utils/whoisServers";
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

  // 改进的双协议查询函数
  const handleDualLookup = async (domain: string, server?: string) => {
    setLoading(true);
    setError(null);
    setWhoisData(null);
    setLastDomain(domain);
    setServersAttempted([]);
    
    try {
      // 如果提供了特定的WHOIS服务器，直接使用WHOIS协议
      if (server) {
        setSpecificServer(server);
        setProtocol("WHOIS");
        console.log(`使用特定服务器进行WHOIS查询: ${server}`);
        
        // 添加到尝试服务器列表
        setServersAttempted(prev => [...prev, server]);
        
        try {
          // 尝试使用WHOIS协议查询
          const whoisResult = await localWhoisQuery(domain, server);
          
          setWhoisData(whoisResult);
          updateStats('whoisSuccess');
          toast({
            title: "WHOIS查询成功",
            description: `使用服务器 ${server} 查询成功`,
          });
        } catch (e: any) {
          // 如果指定服务器失败，尝试API查询
          console.log(`指定服务器失败，尝试API: ${e.message}`);
          
          try {
            const apiResult = await queryDomain(domain, 'whois');
            setWhoisData(apiResult);
            updateStats('whoisSuccess');
            toast({
              title: "WHOIS查询成功",
              description: `使用API查询成功`,
            });
          } catch (apiError: any) {
            setError(`查询失败: ${apiError.message}`);
            updateStats('whoisFailed');
            toast({
              title: "WHOIS查询失败",
              description: `查询失败: ${apiError.message}`,
              variant: "destructive",
            });
          }
        }
        
        setLoading(false);
        return;
      }
      
      // 首先尝试使用统一API客户端
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
          
          setLoading(false);
          return;
        }
      } catch (apiError) {
        console.error("API客户端查询失败:", apiError);
        // 失败后继续使用原有流程
      }
      
      // 首先尝试RDAP查询（更现代的协议）
      console.log("开始RDAP查询...");
      setProtocol("RDAP");
      
      const rdapResponse = await queryRDAP(domain);
      
      // 如果RDAP查询成功且返回了有效数据
      if (rdapResponse.success && rdapResponse.data) {
        console.log("RDAP查询成功:", rdapResponse.data.registrar || "无注册商信息");
        setWhoisData(rdapResponse.data);
        updateStats('rdapSuccess');
        toast({
          title: "RDAP查询成功",
          description: "已通过RDAP协议获取域名信息",
        });
        setLoading(false);
        return;
      } else {
        console.log("RDAP查询未返回有效数据，切换到WHOIS查询");
        updateStats('rdapFailed');
        toast({
          title: "RDAP查询未成功",
          description: "正在切换到WHOIS系统查询...",
        });
      }
      
      // RDAP查询失败，切换到WHOIS查询
      await performWhoisLookup(domain);
    } catch (error: any) {
      console.error("域名查询失败:", error);
      handleLookupError(domain, error);
    } finally {
      setLoading(false);
    }
  };

  // WHOIS查询实现
  const performWhoisLookup = async (domain: string) => {
    setProtocol("WHOIS");
    console.log("开始WHOIS查询...");
    
    // 获取WHOIS服务器
    const whoisServer = getWhoisServer(domain) || getLocalWhoisServer(domain);
    
    if (whoisServer) {
      setSpecificServer(whoisServer);
      setServersAttempted(prev => [...prev, whoisServer]);
      
      console.log(`使用WHOIS服务器: ${whoisServer}`);
      
      try {
        // 使用本地WHOIS查询
        const whoisResult = await localWhoisQuery(domain, whoisServer);
        
        if (whoisResult && whoisResult.protocol !== "error") {
          console.log("WHOIS查询完成:", whoisResult.registrar || "未找到注册商");
          setWhoisData(whoisResult);
          updateStats('whoisSuccess');
          toast({
            title: "WHOIS查询成功",
            description: `已通过WHOIS服务器 ${whoisServer} 获取域名信息`,
          });
          return true;
        }
      } catch (whoisError) {
        console.error("首选WHOIS服务器查询失败，尝试备用服务器", whoisError);
      }
    }
    
    // 尝试使用备用WHOIS服务器
    return await tryBackupServers(domain);
  };

  // 备用服务器尝试
  const tryBackupServers = async (domain: string): Promise<boolean> => {
    console.log("尝试使用备用WHOIS服务器");
    const tld = extractTLD(domain);
    
    // 准备要尝试的服务器列表
    const serversToTry = [
      "whois.verisign-grs.com", // 通用备用服务器
      "whois.iana.org",         // IANA服务器
    ];
    
    // 添加特定于TLD的服务器（如果有）
    if (tld && whoisServers[tld] && !serversToTry.includes(whoisServers[tld])) {
      serversToTry.unshift(whoisServers[tld]); // 将TLD特定服务器放在前面
    }
    
    // 依次尝试不同的WHOIS服务器
    for (const server of serversToTry) {
      if (serversAttempted.includes(server)) continue; // 跳过已尝试的服务器
      
      setServersAttempted(prev => [...prev, server]);
      setSpecificServer(server);
      
      console.log(`尝试备用WHOIS服务器: ${server}`);
      
      try {
        const result = await localWhoisQuery(domain, server);
        
        if (result && result.protocol !== "error") {
          console.log(`使用备用服务器 ${server} 查询成功`);
          setWhoisData(result);
          updateStats('whoisSuccess');
          toast({
            title: "WHOIS查询成功",
            description: `使用备用服务器 ${server} 获取了域名信息`,
          });
          return true;
        }
      } catch (error) {
        console.error(`备用服务器 ${server} 查询失败`, error);
      }
    }
    
    // 最后尝试使用API客户端查询
    try {
      console.log("所有WHOIS服务器失败，尝试API客户端");
      const apiResult = await queryDomain(domain, 'whois');
      
      if (apiResult && apiResult.protocol !== 'error') {
        setWhoisData(apiResult);
        updateStats('whoisSuccess');
        toast({
          title: "WHOIS查询成功",
          description: "通过API成功查询域名",
        });
        return true;
      }
    } catch (apiError) {
      console.error("API客户端查询失败", apiError);
    }
    
    // 所有服务器都失败
    setError("所有WHOIS服务器查询均失败，请稍后重试");
    updateStats('whoisFailed');
    
    // 提供有限的错误信息
    setWhoisData({
      domain: domain,
      whoisServer: "查询失败",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "未知",
      rawData: `无法获取域名 ${domain} 的WHOIS数据。已尝试所有可用服务器。`,
      protocol: 'error',
      message: "所有WHOIS查询失败"
    });
    
    toast({
      title: "查询失败",
      description: "所有可用WHOIS服务器查询均失败",
      variant: "destructive",
    });
    
    return false;
  };

  // 处理查询错误
  const handleLookupError = (domain: string, error: any) => {
    setError(error.message || "未知错误");
    updateStats('whoisFailed');
    
    // 尝试设置有限的错误信息
    setWhoisData({
      domain: domain,
      whoisServer: "错误",
      registrar: "未知",
      registrationDate: "未知",
      expiryDate: "未知",
      nameServers: [],
      registrant: "未知",
      status: "错误",
      rawData: `查询错误: ${error.message || "未知错误"}`,
      protocol: 'error'
    });
    
    toast({
      title: "查询失败",
      description: error.message || "未知错误",
      variant: "destructive",
    });
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
