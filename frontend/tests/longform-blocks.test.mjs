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
 assert.deepEqual(blocks.map(b=>b.role),['lead','quote','list','list','code','table','hr','refs-heading','ref']);
 assert.match(blocks[3].html,/<li>二<\/li>/);
 assert.match(blocks.at(-1).html,/不带编号的来源/);
});

const condensed=readFileSync(new URL('../../examples/xhs-longform-agent-self-evolution/xiaohongshu-condensed.md',import.meta.url),'utf8');
test('agent-authored page breaks become break blocks and the condensed edition may omit citations',()=>{
 assert.deepEqual(articleBlocks('一段\n\n<!-- page -->\n\n二段').map(b=>b.role),['lead','break','p']);
 const blocks=articleBlocks(condensed);
 assert.equal(count(blocks,'figure'),8);
 assert.equal(count(blocks,'ref')+count(blocks,'refs-heading'),0);
 assert.doesNotMatch(condensed,/〔\d+〕/);
 assert.ok(blocks.filter(b=>b.role==='figure').every(b=>!b.caption),'figures that carry their own titles get no caption below');
});

test('bare-domain links are recognised as reference URLs',()=>{
 assert.deepEqual(parseReference('〔1〕Hermes github.com/NousResearch/hermes-agent'),{number:'〔1〕',name:'Hermes',url:'github.com/NousResearch/hermes-agent'});
});

test('list items are independent flow blocks so a page can move a whole item',()=>{
 const blocks=articleBlocks('正文\n\n- **连续。** 同一个 agent。\n- **高效。** 能并发。');
 const items=blocks.filter(b=>b.role==='list');
 assert.equal(items.length,2);
 assert.ok(items.every(b=>b.listItem));
 assert.match(items[0].html,/<li><strong>连续。<\/strong> 同一个 agent。<\/li>/);
 assert.match(items[1].html,/<li><strong>高效。<\/strong> 能并发。<\/li>/);
});

test('ordered flow items retain their original number across pages',()=>{
 const items=articleBlocks('3. 第三件事\n4. 第四件事');
 assert.equal(items.length,2);
 assert.match(items[0].html,/<ol start="3">/);
 assert.match(items[1].html,/<ol start="4">/);
});
