"""Determine the egress IP seen by WeChat without printing credentials."""
import ipaddress
import json
import os
import re
import sys
import requests
from config_ui import load_config


def summarize(data):
    code=data.get('errcode',0)
    connected=bool(data.get('access_token')) and not code
    ips=[]
    if code==40164:
        for candidate in re.findall(r'[0-9a-fA-F:.]+',data.get('errmsg','')):
            try:
                address=ipaddress.ip_address(candidate)
                if isinstance(address,ipaddress.IPv6Address) and address.ipv4_mapped:
                    address=address.ipv4_mapped
                if str(address) not in ips: ips.append(str(address))
            except ValueError: pass
    return {'connected':connected,'errcode':code,'wechat_seen_ips':ips,
            'message':('连接成功；成功响应不提供出口 IP。' if connected else
                       '将 wechat_seen_ips 加入微信 API IP 白名单后重新测试。' if ips else
                       '未获得出口 IP；检查凭据、权限或网络。不要用第三方查 IP 网站代替微信的判断。')}


def diagnose_credentials(appid, secret):
    if not appid or not secret:
        raise ValueError('请先保存 AppID 和 AppSecret')
    endpoint='https://api.weixin.qq.com/cgi-bin/stable_token'
    response=requests.post(endpoint,json={
        'grant_type':'client_credential','appid':appid,'secret':secret,'force_refresh':False},timeout=20)
    response.raise_for_status()
    result=summarize(response.json())
    # Never expose proxy credentials or raw upstream responses.
    proxies=requests.utils.get_environ_proxies(endpoint)
    result['proxy_detected']=bool(proxies.get('https') or proxies.get('all'))
    from datetime import datetime, timezone
    result['checked_at']=datetime.now(timezone.utc).isoformat()
    return result


def main():
    appid,secret=os.environ.get('WECHAT_APP_ID'),os.environ.get('WECHAT_APP_SECRET')
    if appid or secret:
        if not appid or not secret: raise ValueError('环境变量中的 AppID 和 AppSecret 必须成对配置')
    else:
        config=load_config();appid,secret=config.get('app_id'),config.get('app_secret')
    if not appid or not secret: raise ValueError('诊断需要本机保存的 AppID 和 AppSecret，只有 access_token 不够')
    result=diagnose_credentials(appid,secret)
    print(json.dumps(result,ensure_ascii=False))
    return 0 if result['connected'] else 1

if __name__=='__main__':
    try: sys.exit(main())
    except (requests.RequestException,ValueError,OSError):
        print(json.dumps({'error':'诊断未完成，请检查本机成对凭据和网络；未输出原始响应。'},ensure_ascii=False));sys.exit(1)
