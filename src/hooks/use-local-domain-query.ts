
import { useState } from "react";
import { WhoisData } from "./use-whois-lookup";
import { useToast } from "@/hooks/use-toast";
import { queryDomain, DomainQueryResult } from "@/services/LocalDomainQuery";

export function useLocalDomainQuery() {
  const [data, setData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<"rdap" | "whois" | "error" | null>(null);
  const { toast } = useToast();

  const query = async (domain: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    setLastDomain(domain);

    try {
      console.log(`开始查询域名: ${domain}`);
      
      toast({
        title: "查询中",
        description: `正在查询域名 ${domain}...`,
      });

      const result: DomainQueryResult = await queryDomain(domain);

      if (result.success && result.data) {
        setData(result.data);
        setProtocol(result.protocol);
        setError(null);
        
        toast({
          title: "查询成功",
          description: `成功获取域名 ${domain} 的信息`,
        });
      } else {
        const errorMessage = result.error || "查询失败";
        setError(errorMessage);
        setProtocol("error");
        
        toast({
          title: "查询失败",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || "未知错误";
      setError(errorMessage);
      setProtocol("error");
      
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
      await query(lastDomain);
    }
  };

  return {
    data,
    loading,
    error,
    lastDomain,
    protocol,
    query,
    retryQuery
  };
}
