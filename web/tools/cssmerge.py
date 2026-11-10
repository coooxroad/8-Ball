#!/usr/bin/env python3
"""A tool, not a check: merges CSS rules that restate the same selector (outside @media) into the last of them.

A declaration moves forward to the last rule only when no rule at all between the two (any selector - another may match
the same elements - and the rules inside @media blocks) sets the same property or one that overlaps it (padding and
padding-left); otherwise it stays where it was. Comments are kept; a merged rule comes out on one line.
Prove each use changed nothing with web/test/browser/styles.js (computed styles before and after):
    node web/test/browser/styles.js /tmp/before.json;  python3 web/tools/cssmerge.py web/style/NN-x.css
    sh web/build.sh && node web/test/browser/styles.js /tmp/after.json;  node web/test/browser/styles.js --compare /tmp/before.json /tmp/after.json
(11-11: used on 60-desk, 75-play-panels, 76-play-unfold, 10-play, 80-broadcast.)"""
import sys,re
p=sys.argv[1]; src=open(p).read()
# tokenise top-level rules and comments, keeping @media blocks intact
items=[]; i=0; n=len(src)
while i<n:
    if src.startswith('/*',i): j=src.index('*/',i)+2; items.append(('c',src[i:j])); i=j; continue
    while i<n and src[i] in ' \n\t': i+=1
    if i>=n: break
    if src.startswith('/*',i): continue
    # a rule: up to matching brace
    k=src.index('{',i); depth=0; j=k
    while True:
        if src[j]=='{': depth+=1
        elif src[j]=='}':
            depth-=1
            if depth==0: break
        j+=1
    items.append(('r',src[i:j+1])); i=j+1
def decls(body):
    out=[];buf='';d=0
    for ch in body:
        if ch=='(': d+=1
        if ch==')': d-=1
        if ch==';' and d==0: out.append(buf); buf=''
        else: buf+=ch
    if buf.strip(): out.append(buf)
    res=[]
    for x in out:
        x=x.strip()
        if not x: continue
        k=x.split(':',1)[0].strip(); res.append((k,x))
    return res
sels={}
for idx,(t,s) in enumerate(items):
    if t=='r' and not s.startswith('@'):
        sel=re.sub(r'\s+',' ',s[:s.index('{')]).strip(); sels.setdefault(sel,[]).append(idx)
def selset(s): return set(re.sub(r'\s+',' ',x).strip() for x in s[:s.index('{')].split(','))
def overlap(a,b): return a==b or a.startswith(b+'-') or b.startswith(a+'-')
def inner_rules(s):
    # rules inside an @media block (one level)
    body=s[s.index('{')+1:s.rindex('}')]; out=[]; d=0; st=0
    for i,ch in enumerate(body):
        if ch=='{': d+=1
        elif ch=='}':
            d-=1
            if d==0: out.append(body[st:i+1].strip()); st=i+1
    return out
def props_for(idx, sel):
    t,s=items[idx]
    if t!='r': return []
    rs=inner_rules(s) if s.startswith('@') else [s]
    out=[]
    for r in rs:
        if '{' not in r: continue
        out+= [k for k,_ in decls(r[r.index('{')+1:r.rindex('}')])]   # (any selector: another may match the same elements)
    return out
for sel,idxs in sels.items():
    if len(idxs)<2: continue
    last=idxs[-1]; moved={}
    for idx in idxs:
        s=items[idx][1]; body=s[s.index('{')+1:s.rindex('}')]; keep=[]
        # what rules between this one and the last set, for this selector (in a list or a media block)
        between=[k for j in range(idx+1,last) if j not in idxs for k in props_for(j, sel)] if idx!=last else []
        for k,x in decls(body):
            if idx!=last and any(overlap(k,b) for b in between): keep.append(x); continue
            if k in moved: del moved[k]
            moved[k]=x
        if idx!=last:
            items[idx]=('r', s[:s.index('{')]+'{'+';'.join(keep)+'}') if keep else ('x','')
    s=items[last][1]
    items[last]=('r', s[:s.index('{')]+'{'+';'.join(moved.values())+'}')
out=[]
for t,s in items:
    if t=='x': continue
    out.append(s)
open(p,'w').write('\n'.join(out)+'\n')
print('merged', sum(1 for v in sels.values() if len(v)>1))
