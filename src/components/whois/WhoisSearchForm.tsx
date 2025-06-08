
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface WhoisSearchFormProps {
  onSearch: (domain: string) => Promise<void>;
  loading: boolean;
  error?: string | null;
}

export const WhoisSearchForm = ({ 
  onSearch, 
  loading,
  error
}: WhoisSearchFormProps) => {
  const [domain, setDomain] = useState("");
  const { toast } = useToast();

  // 域名清理和验证函数
  const cleanDomain = (inputDomain: string) => {
    let cleanedDomain = inputDomain.trim().toLowerCase();
    
    // 去除协议和www前缀
    cleanedDomain = cleanedDomain.replace(/^(https?:\/\/)?(www\.)?/i, '');
    
    // 去除路径、查询字符串或哈希
    cleanedDomain = cleanedDomain.replace(/\/.*$/, '');
    cleanedDomain = cleanedDomain.replace(/\?.*$/, '');
    cleanedDomain = cleanedDomain.replace(/#.*$/, '');
    
    return cleanedDomain;
  };

  // 域名验证
  const validateDomain = (domain: string): boolean => {
    // 检查是否为纯IP地址
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipRegex.test(domain)) {
      return false;
    }
    
    // 域名格式验证
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const handleSubmit = async () => {
    if (!domain) {
      toast({
        title: "错误",
        description: "请输入域名",
        variant: "destructive",
      });
      return;
    }

    // 清理域名输入
    const cleanedDomain = cleanDomain(domain);
      
    // 域名格式验证
    if (!validateDomain(cleanedDomain)) {
      toast({
        title: "错误",
        description: "请输入有效的域名格式 (如 example.com)",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await onSearch(cleanedDomain);
    } catch (error) {
      console.error("域名查询失败:", error);
      toast({
        title: "查询失败",
        description: "域名查询过程中出现错误，请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleSubmit();
    }
  };

  return (
    <Card className="p-6 mb-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            type="text"
            placeholder="请输入域名 (例如: google.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="flex-1"
            onKeyPress={handleKeyPress}
          />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="min-w-[100px]"
                >
                  {loading ? "查询中..." : "查询"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>优先使用RDAP协议查询，失败时自动切换到WHOIS</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* 错误提示块 */}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>查询失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="text-sm text-gray-500">
          <p>支持查询全球常见顶级域名: .com, .net, .org, .io, .ai 等</p>
          <p className="mt-1">输入格式: example.com（无需添加http://或www.）</p>
          <p className="mt-1">系统直接连接RDAP和WHOIS服务器：优先RDAP，失败后使用WHOIS</p>
        </div>
      </div>
    </Card>
  );
};
