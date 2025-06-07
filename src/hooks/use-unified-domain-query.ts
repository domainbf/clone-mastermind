
import { useState } from "react";
import { WhoisData } from "./use-whois-lookup";
import { useToast } from "@/hooks/use-toast";
import { queryDomainUnified, QueryResult } from "@/services/UnifiedDomainQuery";

export function useUnifiedDomainQuery() {
  const [data, setData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const [lastProtocol, setLastProtocol] = useState<"rdap" | "whois" | "error" | null>(null);
  const { toast } = useToast();

  const queryDomain = async (domain: string, protocol: "auto" | "rdap" | "whois" = "auto") => {
    setLoading(true);
    setError(null);
    setData(null);
    setLastDomain(domain);

    try {
      console.log(`开始统一查询: ${domain}, 协议: ${protocol}`);
      
      toast({
        title: "查询中",
        description: `正在查询域名 ${domain}...`,
      });

      const result: QueryResult = await queryDomainUnified(domain, protocol);

      if (result.success && result.data) {
        setData(result.data);
        setLastProtocol(result.data.protocol);
        setError(null);
        
        toast({
          title: "查询成功",
          description: `成功获取域名 ${domain} 的信息`,
        });
      } else {
        const errorMessage = result.error || "查询失败";
        setError(errorMessage);
        setLastProtocol("error");
        
        toast({
          title: "查询失败",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || "未知错误";
      setError(errorMessage);
      setLastProtocol("error");
      
      console.error("域名查询错误:", error);
      toast({
        title: "查询失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const retryQuery = async () => {
    if (lastDomain) {
      await queryDomain(lastDomain);
    }
  };

  return {
    data,
    loading,
    error,
    lastDomain,
    lastProtocol,
    queryDomain,
    retryQuery
  };
}
