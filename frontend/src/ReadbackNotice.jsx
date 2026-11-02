import React from 'react';
import {Notice} from './ui';
export default function ReadbackNotice({sync}){
 if(!sync||sync.publication)return null;
 if(!sync.verified)return <Notice>微信写入结果尚未核对，请先到草稿箱确认，避免重复提交。</Notice>;
 const check=sync.readback;
 if(!check)return null;
 return <Notice kind={check.content_matches?'info':'error'}><p>{check.content_matches?'微信回读结构检查通过。':'已写入微信草稿，回读发现以下差异：'}</p>{check.issues?.length>0&&<ul>{check.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}<p>{check.note}</p></Notice>;
}
