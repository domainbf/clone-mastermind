import { useState, useEffect } from "react";
import { WhoisSearchForm } from "@/components/whois/WhoisSearchForm";
import { WhoisErrorAlert } from "@/components/whois/WhoisErrorAlert";
import { WhoisResults } from "@/components/whois/WhoisResults";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, LogOut, Globe, Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedDomainQuery } from "@/hooks/use-unified-domain-query";

const Index = () => {
  const {
    loading,
    error,
    data,
    lastDomain,
    lastProtocol,
    queryDomain,
    retryQuery
  } = useUnifiedDomainQuery();

  const { isAuthenticated, user, logout } = useAuth();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [preferredProtocol, setPreferredProtocol] = useState<"auto" | "rdap" | "whois">("auto");
  const { toast } = useToast();
  
  // 从localStorage加载最近查询
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load recent searches:", e);
    }
    
    // 尝试加载协议偏好
    try {
      const savedProtocol = localStorage.getItem('preferredProtocol');
      if (savedProtocol && ['auto', 'rdap', 'whois'].includes(savedProtocol)) {
        setPreferredProtocol(savedProtocol as "auto" | "rdap" | "whois");
      }
    } catch (e) {
      console.error("Failed to load protocol preference:", e);
    }
  }, []);

  // 处理搜索并跟踪最近的搜索
  const handleSearch = async (domain: string, protocol: "auto" | "rdap" | "whois" = preferredProtocol) => {
    try {
      await queryDomain(domain, protocol);
      
      // 如果不在最近搜索中，添加它
      if (!recentSearches.includes(domain)) {
        const newSearches = [domain, ...recentSearches].slice(0, 5); // 保留最近5次搜索
        setRecentSearches(newSearches);
        
        // 保存到localStorage
        try {
          localStorage.setItem('recentSearches', JSON.stringify(newSearches));
        } catch (e) {
          console.error("Failed to save recent searches:", e);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "查询失败",
        description: "发生未知错误，请稍后重试",
        variant: "destructive",
      });
    }
  };
  
  // 处理协议变更
  const handleProtocolChange = (protocol: "auto" | "rdap" | "whois") => {
    setPreferredProtocol(protocol);
    
    // 保存到localStorage
    try {
      localStorage.setItem('preferredProtocol', protocol);
    } catch (e) {
      console.error("Failed to save protocol preference:", e);
    }
    
    // 显示提示
    toast({
      title: "已更改默认查询协议",
      description: protocol === "auto" ? "将优先使用RDAP，失败后自动切换到WHOIS" :
                   protocol === "rdap" ? "将仅使用RDAP协议查询" :
                   "将仅使用WHOIS协议查询",
    });
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div className="text-center flex-grow">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              域名查询工具
            </h1>
            <p className="text-md text-gray-600">
              输入要查询的域名，获取详细信息 (RDAP + WHOIS)
            </p>
          </div>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    用户中心
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  退出
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <LogIn className="h-4 w-4" />
                  登录
                </Button>
              </Link>
            )}
          </div>
        </header>

        <WhoisSearchForm 
          onSearch={handleSearch}
          loading={loading}
          defaultProtocol={preferredProtocol}
          onProtocolChange={handleProtocolChange}
          error={error}
        />

        {recentSearches.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 flex items-center">
              <Search className="h-3 w-3 mr-1" />
              最近查询:
            </span>
            {recentSearches.map(domain => (
              <Button 
                key={domain} 
                variant="ghost" 
                size="sm"
                onClick={() => handleSearch(domain)}
                className="text-xs"
              >
                {domain}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <Link to={isAuthenticated ? "/sell-domains" : "/login"}>
            <Button variant="secondary" className="w-full md:w-auto">
              出售您的域名
            </Button>
          </Link>
        </div>

        {error && (
          <WhoisErrorAlert 
            error={error} 
            domain={lastDomain || undefined}
            onRetry={() => {
              if (lastDomain) {
                toast({
                  title: "重试查询",
                  description: `正在重新查询 ${lastDomain}...`,
                });
                retryQuery();
              }
            }}
          />
        )}

        {data && (
          <>
            <div className="flex justify-between items-center mt-6 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={data.protocol === "rdap" ? "default" : "outline"}>
                  {data.protocol === "rdap" ? "RDAP 协议" : 
                   data.protocol === "whois" ? "WHOIS 协议" : 
                   data.protocol === "static" ? "预定义数据" : "未知协议"}
                </Badge>
                
                <div className="text-xs text-gray-500">
                  {data.protocol === "rdap" ? "使用了RDAP协议查询" : 
                   data.protocol === "whois" ? "使用了WHOIS协议查询" : 
                   data.protocol === "static" ? "使用了预定义数据" :
                   "无法获取数据"}
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1"
                onClick={retryQuery}
                disabled={loading || !lastDomain}
              >
                <RefreshCw className="h-3 w-3" />
                刷新
              </Button>
            </div>
            <WhoisResults data={data} />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
