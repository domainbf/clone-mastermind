
import { useState } from 'react';
import { WhoisData } from '@/hooks/use-whois-lookup';
import { useToast } from '@/hooks/use-toast';
import { lookupDomain } from '@/services/DomainQueryService';

export function useDomainInfo() {
  const [data, setData] = useState<WhoisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const [lastProtocol, setLastProtocol] = useState<"auto" | "rdap" | "whois">("auto");
  const { toast } = useToast();

  const queryDomain = async (domain: string, protocol: "auto" | "rdap" | "whois" = "auto") => {
    setLoading(true);
    setError(null);
    setData(null);
    setLastDomain(domain);
    setLastProtocol(protocol);

    try {
      console.log(`开始查询域名: ${domain}, 协议: ${protocol}`);
      
      const result = await lookupDomain(domain, protocol);
      
      if (result.protocol === 'error') {
        setError(result.message || '查询失败');
        toast({
          title: "查询失败",
          description: result.message || '无法获取域名信息',
          variant: "destructive",
        });
      } else {
        setData(result);
        setError(null);
        
        toast({
          title: "查询成功",
          description: `成功获取 ${domain} 的域名信息`,
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || '查询过程中发生错误';
      setError(errorMessage);
      
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
      await queryDomain(lastDomain, lastProtocol);
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
