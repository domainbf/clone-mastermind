
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhoisData } from "@/hooks/use-whois-lookup";
import { queryRDAP } from "@/utils/rdapClient";
import { queryWhoisAPI } from "@/api/whoisClient";
import { getPopularDomainData } from "@/utils/popularDomainsService";
import { useDirectLookup } from "@/hooks/use-direct-lookup";
import axios from "axios";

export function useDomainLookup() {
  const [domainData, setDomainData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<"RDAP" | "WHOIS" | null>(null);
  const [server, setServer] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const { toast } = useToast();
  const { performDirectLookup } = useDirectLookup();

  const performLookup = async (domain: string, specificServer?: string) => {
    if (!domain) return;
    
    setLoading(true);
    setError(null);
    setDomainData(null);
    setLastDomain(domain);
    
    try {
      console.log(`开始查询域名: ${domain}${specificServer ? ` 使用服务器: ${specificServer}` : ''}`);
      
      // Step 1: Check if it's a popular domain first for fastest response
      const popularDomainInfo = getPopularDomainData(domain);
      
      if (popularDomainInfo && popularDomainInfo.registrar) {
        console.log("找到预定义域名数据:", popularDomainInfo);
        
        const presetData: WhoisData = {
          domain: domain,
          whoisServer: "预定义数据库",
          registrar: popularDomainInfo.registrar || "未知",
          registrationDate: popularDomainInfo.registrationDate || "未知",
          expiryDate: popularDomainInfo.expiryDate || "未知",
          nameServers: popularDomainInfo.nameServers || [],
          registrant: "未知",
          status: popularDomainInfo.status || "未知",
          rawData: `Domain information retrieved from predefined database.`,
          message: "使用预定义的域名数据",
          protocol: "whois" // Using whois as the protocol type
        };
        
        setDomainData(presetData);
        setProtocol("WHOIS");
        
        toast({
          title: "快速查询",
          description: "已从预定义数据库获取域名信息",
        });
        
        // Continue with normal lookup in the background for most up-to-date info
      }
      
      // If specific server is provided, skip RDAP and go directly to WHOIS with that server
      if (specificServer) {
        setProtocol("WHOIS");
        console.log(`使用指定WHOIS服务器查询: ${specificServer}`);
        
        try {
          const whoisData = await queryWhoisAPI(domain, specificServer, 'whois');
          
          if (whoisData) {
            setDomainData(whoisData);
            toast({
              title: "WHOIS查询成功",
              description: `已通过服务器 ${specificServer} 获取域名信息`,
            });
          }
        } catch (whoisError) {
          console.error(`使用指定服务器查询失败: ${whoisError}`);
          throw new Error(`使用服务器 ${specificServer} 查询失败`);
        }
        
        setLoading(false);
        return;
      }
      
      // Step 2: Attempt RDAP lookup (modern protocol)
      try {
        setProtocol("RDAP");
        console.log("尝试使用RDAP协议查询...");
        
        const rdapResult = await queryRDAP(domain);
        
        if (rdapResult.success && rdapResult.data) {
          setDomainData(rdapResult.data);
          toast({
            title: "RDAP查询成功",
            description: "已通过RDAP协议获取域名信息",
          });
          setLoading(false);
          return;
        }
        
        console.log(`RDAP查询结果: ${rdapResult.message}`);
        toast({
          title: "RDAP查询无结果",
          description: "正在切换到传统WHOIS系统查询...",
        });
      } catch (rdapError: any) {
        console.error("RDAP查询错误:", rdapError);
        toast({
          title: "RDAP查询失败",
          description: "正在切换到传统WHOIS系统查询...",
        });
      }
      
      // Step 3: Fall back to WHOIS protocol
      setProtocol("WHOIS");
      console.log("尝试使用传统WHOIS协议查询...");
      
      let whoisResult: WhoisData | null = null;
      
      try {
        const whoisData = await queryWhoisAPI(domain, specificServer, 'whois');
        
        if (whoisData) {
          // If we have a specific WHOIS server suggestion, save it
          if (whoisData.whoisServer && 
              whoisData.whoisServer !== "未知" && 
              whoisData.whoisServer !== "API查询失败" &&
              !specificServer) {
            setServer(whoisData.whoisServer);
          }
          
          whoisResult = whoisData;
          setDomainData(whoisData);
          
          // Check if the data is complete enough
          const isDataComplete = 
            whoisData.registrar !== "未知" || 
            whoisData.registrationDate !== "未知" || 
            whoisData.nameServers.length > 0;
            
          if (isDataComplete) {
            toast({
              title: "WHOIS查询成功",
              description: whoisData.message || "已通过WHOIS协议获取域名信息",
            });
            setLoading(false);
            return;
          } else {
            console.log("WHOIS数据不完整，继续尝试其他方法");
          }
        }
      } catch (whoisError: any) {
        console.error("WHOIS查询错误:", whoisError);
      }
      
      // Step 4: Try our direct WHOIS API if regular WHOIS data is incomplete or failed
      console.log("尝试使用直接WHOIS API查询...");
      
      try {
        const directData = await performDirectLookup(domain);
        
        // Merge with any data we might already have
        if (directData) {
          const mergedData: WhoisData = {
            ...directData,
            // Override with any better data we already had
            registrar: (whoisResult?.registrar !== "未知") ? whoisResult?.registrar : directData.registrar,
            registrationDate: (whoisResult?.registrationDate !== "未知") ? whoisResult?.registrationDate : directData.registrationDate,
            expiryDate: (whoisResult?.expiryDate !== "未知") ? whoisResult?.expiryDate : directData.expiryDate,
            nameServers: whoisResult?.nameServers?.length ? whoisResult.nameServers : directData.nameServers,
            status: (whoisResult?.status !== "未知") ? whoisResult?.status : directData.status,
            message: "合并多个数据源的信息"
          };
            
          setDomainData(mergedData);
          toast({
            title: "直接查询成功",
            description: "已通过多个数据源合并域名信息",
          });
            
          setLoading(false);
          return;
        }
      } catch (directError) {
        console.error("直接WHOIS API查询错误:", directError);
      }
      
      // Step 5: If we still have no good data, but we do have some data, return what we have
      if (whoisResult) {
        setLoading(false);
        return;
      }
      
      // Step 6: As a final resort, try a public RDAP service if all else failed
      try {
        const publicRdapResponse = await axios.get(`https://rdap.org/domain/${domain}`, {
          timeout: 5000
        });
        
        if (publicRdapResponse.data) {
          console.log("公共RDAP服务返回数据:", publicRdapResponse.data);
          
          // Extract the basic info
          const nameServers = [];
          if (publicRdapResponse.data.nameservers) {
            for (const ns of publicRdapResponse.data.nameservers) {
              if (ns.ldhName) nameServers.push(ns.ldhName);
            }
          }
          
          let registrar = "未知";
          if (publicRdapResponse.data.entities) {
            for (const entity of publicRdapResponse.data.entities) {
              if (entity.roles && entity.roles.includes("registrar")) {
                registrar = entity.vcardArray?.[1]?.find(vcard => vcard[0] === "fn")?.[3] || entity.handle || registrar;
              }
            }
          }
          
          let creationDate = "未知";
          let expiryDate = "未知";
          if (publicRdapResponse.data.events) {
            for (const event of publicRdapResponse.data.events) {
              if (event.eventAction === "registration") creationDate = event.eventDate;
              if (event.eventAction === "expiration") expiryDate = event.eventDate;
            }
          }
          
          const publicRdapData: WhoisData = {
            domain: domain,
            whoisServer: "RDAP.org",
            registrar: registrar,
            registrationDate: creationDate,
            expiryDate: expiryDate,
            nameServers: nameServers,
            registrant: "未知",
            status: publicRdapResponse.data.status ? publicRdapResponse.data.status.join(", ") : "未知",
            rawData: JSON.stringify(publicRdapResponse.data, null, 2),
            message: "从公共RDAP服务获取数据",
            protocol: "rdap"
          };
          
          setDomainData(publicRdapData);
          setProtocol("RDAP");
          
          toast({
            title: "RDAP查询成功",
            description: "使用公共RDAP服务获取数据成功",
          });
        }
      } catch (publicRdapError) {
        console.error("公共RDAP服务查询失败:", publicRdapError);
        throw new Error("所有查询方法均失败，无法获取域名信息");
      }
      
    } catch (error: any) {
      console.error("域名查询失败:", error);
      
      setError(error.message || "查询失败");
      toast({
        title: "查询失败",
        description: error.message || "未知错误",
        variant: "destructive",
      });
      
      // Try to get at least some data for popular domains
      const fallbackDomainInfo = getPopularDomainData(domain);
      if (fallbackDomainInfo) {
        const fallbackData: WhoisData = {
          domain: domain,
          whoisServer: "API查询失败",
          registrar: fallbackDomainInfo.registrar || "未知",
          registrationDate: fallbackDomainInfo.registrationDate || "未知",
          expiryDate: fallbackDomainInfo.expiryDate || "未知",
          nameServers: fallbackDomainInfo.nameServers || [],
          registrant: "未知",
          status: fallbackDomainInfo.status || "未知",
          rawData: `Error querying for ${domain}: ${error.message}\n\n部分数据来自预定义数据库`,
          message: "查询失败，使用预定义数据",
          protocol: "whois"
        };
        
        setDomainData(fallbackData);
        toast({
          title: "使用部分预定义数据",
          description: "API查询失败，但找到了部分预定义数据",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const retryLookup = async () => {
    if (lastDomain) {
      await performLookup(lastDomain);
    }
  };
  
  const lookupWithServer = async () => {
    if (lastDomain && server) {
      await performLookup(lastDomain, server);
    }
  };

  return {
    domainData,
    loading,
    error,
    protocol,
    server,
    lastDomain,
    performLookup,
    retryLookup,
    lookupWithServer
  };
}
