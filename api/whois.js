
const net = require('net');
const axios = require('axios');

// WHOIS服务器映射
const WHOIS_SERVERS = {
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com', 
  'org': 'whois.pir.org',
  'info': 'whois.afilias.net',
  'biz': 'whois.nic.biz',
  'io': 'whois.nic.io',
  'ai': 'whois.nic.ai',
  'co': 'whois.nic.co',
  'me': 'whois.nic.me',
  'tv': 'whois.nic.tv',
  'cc': 'whois.nic.cc',
  'ly': 'whois.nic.ly',
  'cn': 'whois.cnnic.cn'
};

// RDAP服务器映射
const RDAP_SERVERS = {
  'com': 'https://rdap.verisign.com/com/v1',
  'net': 'https://rdap.verisign.com/net/v1',
  'org': 'https://rdap.publicinterestregistry.org',
  'info': 'https://rdap.afilias.net',
  'biz': 'https://rdap.nic.biz',
  'io': 'https://rdap.nic.io',
  'ai': 'https://rdap.nic.ai',
  'co': 'https://rdap.nic.co',
  'me': 'https://rdap.nic.me',
  'tv': 'https://rdap.nic.tv',
  'cn': 'https://rdap.cnnic.cn'
};

function extractTLD(domain) {
  return domain.split('.').pop().toLowerCase();
}

// 直接TCP WHOIS查询
function directWhoisQuery(domain, server) {
  return new Promise((resolve, reject) => {
    console.log(`连接WHOIS服务器: ${server}:43`);
    const socket = new net.Socket();
    let data = '';
    
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('WHOIS查询超时'));
    }, 15000);
    
    socket.connect(43, server, () => {
      console.log(`已连接到 ${server}，发送查询: ${domain}`);
      socket.write(domain + '\r\n');
    });
    
    socket.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    socket.on('close', () => {
      clearTimeout(timeout);
      console.log(`从 ${server} 收到 ${data.length} 字节数据`);
      if (data.length > 50) {
        resolve(data);
      } else {
        reject(new Error('WHOIS服务器返回数据不足'));
      }
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`WHOIS连接错误 ${server}:`, err.message);
      reject(err);
    });
  });
}

// RDAP查询
async function rdapQuery(domain, server) {
  const url = `${server}/domain/${domain}`;
  console.log(`RDAP查询: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/rdap+json',
        'User-Agent': 'Domain-Lookup/1.0'
      }
    });
    
    console.log(`RDAP响应状态: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`RDAP查询失败 ${url}:`, error.message);
    throw error;
  }
}

// 解析WHOIS文本数据
function parseWhoisData(text, domain) {
  const lines = text.split('\n');
  const result = {
    domain: domain,
    whoisServer: '未知',
    registrar: '未知',
    registrationDate: '未知',
    expiryDate: '未知',
    nameServers: [],
    registrant: '未知',
    status: '未知',
    rawData: text
  };
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (lowerLine.includes('registrar:') && result.registrar === '未知') {
      result.registrar = line.split(':').slice(1).join(':').trim();
    }
    
    if ((lowerLine.includes('creation date:') || lowerLine.includes('registered on:')) && result.registrationDate === '未知') {
      result.registrationDate = line.split(':').slice(1).join(':').trim();
    }
    
    if ((lowerLine.includes('expiry date:') || lowerLine.includes('expires on:')) && result.expiryDate === '未知') {
      result.expiryDate = line.split(':').slice(1).join(':').trim();
    }
    
    if (lowerLine.includes('name server:')) {
      const ns = line.split(':').slice(1).join(':').trim();
      if (ns && !result.nameServers.includes(ns)) {
        result.nameServers.push(ns);
      }
    }
    
    if (lowerLine.includes('registrant:') && result.registrant === '未知') {
      result.registrant = line.split(':').slice(1).join(':').trim();
    }
    
    if (lowerLine.includes('domain status:') && result.status === '未知') {
      result.status = line.split(':').slice(1).join(':').trim();
    }
  }
  
  return result;
}

// 解析RDAP数据
function parseRdapData(data, domain) {
  const result = {
    domain: domain,
    whoisServer: "RDAP",
    registrar: "未知",
    registrationDate: "未知", 
    expiryDate: "未知",
    nameServers: [],
    registrant: "未知",
    status: "未知",
    rawData: JSON.stringify(data, null, 2)
  };
  
  // 提取注册商
  if (data.entities) {
    for (const entity of data.entities) {
      if (entity.roles && entity.roles.includes('registrar')) {
        if (entity.vcardArray && entity.vcardArray[1]) {
          for (const vcard of entity.vcardArray[1]) {
            if (vcard[0] === 'fn') {
              result.registrar = vcard[3];
              break;
            }
          }
        }
        break;
      }
    }
  }
  
  // 提取日期
  if (data.events) {
    for (const event of data.events) {
      if (event.eventAction === 'registration') {
        result.registrationDate = event.eventDate;
      } else if (event.eventAction === 'expiration') {
        result.expiryDate = event.eventDate;
      }
    }
  }
  
  // 提取DNS服务器
  if (data.nameservers) {
    result.nameServers = data.nameservers.map(ns => ns.ldhName).filter(Boolean);
  }
  
  // 提取状态
  if (data.status) {
    result.status = data.status.join(', ');
  }
  
  return result;
}

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }
  
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }
  
  console.log(`开始查询域名: ${domain}`);
  const tld = extractTLD(domain);
  console.log(`提取的TLD: ${tld}`);
  
  // 优先尝试RDAP
  const rdapServer = RDAP_SERVERS[tld];
  if (rdapServer) {
    try {
      console.log(`尝试RDAP查询: ${domain} 使用服务器: ${rdapServer}`);
      const rdapData = await rdapQuery(domain, rdapServer);
      const parsed = parseRdapData(rdapData, domain);
      
      console.log('RDAP查询成功');
      return res.json({
        success: true,
        protocol: 'rdap',
        data: { ...parsed, protocol: 'rdap' }
      });
    } catch (rdapError) {
      console.log(`RDAP失败: ${rdapError.message}`);
    }
  } else {
    console.log(`没有找到TLD ${tld} 的RDAP服务器`);
  }
  
  // RDAP失败，尝试WHOIS
  const whoisServer = WHOIS_SERVERS[tld];
  if (whoisServer) {
    try {
      console.log(`尝试WHOIS查询: ${domain} 使用服务器: ${whoisServer}`);
      const whoisData = await directWhoisQuery(domain, whoisServer);
      const parsed = parseWhoisData(whoisData, domain);
      
      console.log('WHOIS查询成功');
      return res.json({
        success: true,
        protocol: 'whois',
        data: { ...parsed, protocol: 'whois' }
      });
    } catch (whoisError) {
      console.log(`WHOIS失败: ${whoisError.message}`);
      return res.json({
        success: false,
        error: `WHOIS查询失败: ${whoisError.message}`
      });
    }
  } else {
    console.log(`没有找到TLD ${tld} 的WHOIS服务器`);
  }
  
  return res.json({
    success: false,
    error: `不支持的TLD或查询失败: ${tld}`
  });
};
