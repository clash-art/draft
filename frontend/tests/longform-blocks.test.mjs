import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {articleBlocks,articleSections,articleStats,parseReference} from '../src/longform-blocks.js';
const article=readFileSync(new URL('../../examples/xhs-longform-agent-self-evolution/article.md',import.meta.url),'utf8');
const count=(blocks,role)=>blocks.filter(b=>b.role===role).length;

test('example article keeps every figure, section and reference as its own block',()=>{
 const blocks=articleBlocks(article);
 const images=[...article.matchAll(/^!\[[^\]]*\]\(([^)\s]+)/gm)].map(m=>m[1]);
 assert.deepEqual(blocks.filter(b=>b.role==='figure').map(b=>b.src),images);
 assert.equal(images.length,10);
 assert.ok(blocks.filter(b=>b.role==='figure').every(b=>b.caption),'image alt text is shown as caption');
 const refs=blocks.filter(b=>b.role==='ref');
 assert.deepEqual(refs.map(r=>r.number),Array.from({length:21},(_,i)=>`〔${i+1}〕`));
 assert.ok(refs.every(r=>r.name&&/^https:\/\//.test(r.url)));
 assert.deepEqual(articleSections(blocks).map(s=>s.number),['01','02','03','04','05']);
 assert.equal(count(blocks,'lead'),1);assert.equal(count(blocks,'refs-heading'),1);
 assert.deepEqual(articleStats(article,blocks).references,21);
});

test('reference parsing accepts common numbering styles and keeps names intact',()=>{
 assert.deepEqual(parseReference('〔3〕SICA  \nhttps://arxiv.org/abs/2504.15228'),{number:'〔3〕',name:'SICA',url:'https://arxiv.org/abs/2504.15228'});
 assert.deepEqual(parseReference('[12] Topics 文档 https://example.com/a_b'),{number:'[12]',name:'Topics 文档',url:'https://example.com/a_b'});
 assert.equal(parseReference('普通段落'),null);
});

test('unrecognised Markdown is passed through instead of dropped',()=>{
 const blocks=articleBlocks('导语\n\n> 引用\n\n- 一\n- 二\n\n```\ncode\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n\n## 参考资料\n\n不带编号的来源');
 assert.deepEqual(blocks.map(b=>b.role),['lead','quote','list','code','table','hr','refs-heading','ref']);
 assert.match(blocks[2].html,/<li>二<\/li>/);
 assert.match(blocks.at(-1).html,/不带编号的来源/);
});

const condensed=readFileSync(new URL('../../examples/xhs-longform-agent-self-evolution/xiaohongshu-condensed.md',import.meta.url),'utf8');
test('agent-authored page breaks become break blocks and the condensed edition keeps all references',()=>{
 assert.deepEqual(articleBlocks('一段\n\n<!-- page -->\n\n二段').map(b=>b.role),['lead','break','p']);
 const blocks=articleBlocks(condensed);
 assert.equal(count(blocks,'figure'),6);
 assert.ok(count(blocks,'break')>=5);
 const refs=blocks.filter(b=>b.role==='ref');
 assert.equal(refs.length,21);
 assert.ok(refs.every(r=>r.name&&r.url),'short-form references keep a name and a link');
});

test('bare-domain links are recognised as reference URLs',()=>{
 assert.deepEqual(parseReference('〔1〕Hermes github.com/NousResearch/hermes-agent'),{number:'〔1〕',name:'Hermes',url:'github.com/NousResearch/hermes-agent'});
});
