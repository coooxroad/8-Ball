#!/usr/bin/env python3
"""A tool, not a check: merges CSS rules that restate the same selector (outside @media) into the last of them.

A declaration moves forward to the last rule only when no rule at all between the two (any selector - another may match
the same elements - and the rules inside @media blocks) sets the same property or one that overlaps it (padding and
padding-left); otherwise it stays where it was. Comments are kept; a merged rule comes out on one line.
Prove each use changed nothing with web/tools/compare/styles.js (computed styles before and after):
    node web/tools/compare/styles.js /tmp/before.json;  python3 web/tools/cssmerge.py web/style/NN-x.css
    sh web/build.sh && node web/tools/compare/styles.js /tmp/after.json;  node web/tools/compare/styles.js --compare /tmp/before.json /tmp/after.json
(11-11: used on 60-desk, 75-play-panels, 76-play-unfold, 10-play, 80-broadcast. 11-15: the overridden-declaration pass
added, then used on 10-play (its in-play desk controls then laid out by hand), 75-play-panels, 76-play-unfold,
80-broadcast, 90-portrait. 11-22 (R2 S2-b): --first folds the later rules back into the first instead - the selector's
own definition, where it is introduced and explained, keeps everything that was patched on further down.)"""
import sys,re
p=[a for a in sys.argv[1:] if not a.startswith('--')][0]; src=open(p).read()
# tokenise top-level rules and comments, keeping @media blocks intact
items=[]; i=0; n=len(src)
ws=''   # the white space before each item, kept with it (blank lines between groups stay)
while i<n:
    j=i
    while i<n and src[i] in ' \n\t': i+=1
    ws=src[j:i]
    if i>=n: break
    if src.startswith('/*',i): j=src.index('*/',i)+2; items.append(('c',ws+src[i:j])); i=j; continue
    # a rule: up to matching brace
    k=src.index('{',i); depth=0; j=k
    while True:
        if src[j]=='{': depth+=1
        elif src[j]=='}':
            depth-=1
            if depth==0: break
        j+=1
    items.append(('r',ws+src[i:j+1])); i=j+1
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
    if t=='r' and not s.lstrip().startswith('@'):
        sel=re.sub(r'\s+',' ',s[:s.index('{')]).strip(); sels.setdefault(sel,[]).append(idx)
# First, drop what can never show: a declaration that a later rule of the very same selector (same elements, same
# specificity, later) sets again - itself or through a shorthand that covers it - is overridden wherever it applies.
# Kept: anything !important, vendor-prefixed, or written with units an old WebView may not know (a fallback pair).
COVERS={'inset':{'top','right','bottom','left'},'gap':{'row-gap','column-gap'},'overflow':{'overflow-x','overflow-y'},
        'font':{'line-height'}}
PREFIXED={'background','margin','padding','border-image','mask','font','transition','animation','border-radius'}
def covers(later,earlier):
    if later==earlier: return True
    if earlier in COVERS.get(later,()): return True
    if later=='border-radius': return earlier.startswith('border-') and earlier.endswith('-radius')
    return later in PREFIXED and earlier.startswith(later+'-')
RISKY=re.compile(r'!important|dvh|svh|lvh|dvw|cq[whib]|cqmin|cqmax|env\(|-webkit-|-moz-')
def risky(k,x): return k.startswith('-') or bool(RISKY.search(x))
dropped=0
for sel,idxs in sels.items():
    if len(idxs)<2: continue
    for n,idx in enumerate(idxs[:-1]):
        later=[(k,x) for j in idxs[n+1:] for k,x in decls(items[j][1][items[j][1].index('{')+1:items[j][1].rindex('}')])]
        s=items[idx][1]; body=s[s.index('{')+1:s.rindex('}')]; keep=[]
        for k,x in decls(body):
            if not risky(k,x) and any(covers(lk,k) and not risky(lk,lx) for lk,lx in later): dropped+=1; continue
            keep.append(x)
        items[idx]=('r', s[:s.index('{')]+'{'+';'.join(keep)+'}')
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
def split0(s,seps):
    # split at the separators outside parentheses (a list's commas, a selector's combinators)
    out=[];buf='';d=0
    for ch in s:
        if ch=='(': d+=1
        if ch==')': d-=1
        if d==0 and ch in seps: out.append(buf); buf=''
        else: buf+=ch
    out.append(buf); return [x.strip() for x in out if x.strip()]
def subject(part):
    # what a selector picks out: its last compound - its id, its tag and its pseudo-element, outside any :not(...)
    last=split0(part,' >+~')[-1] if part else ''
    bare=re.sub(r'\([^()]*\)','',last)
    pe=re.search(r'::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+)\b',bare)
    i=re.search(r'#([\w-]+)',bare); t=re.match(r'[a-zA-Z][\w-]*',bare)
    return (pe.group(1) if pe else None, i.group(1) if i else None, t.group(0).lower() if t else None)
def meet(a,b):
    # could these two subjects ever be the same element (or the same pseudo-element of it)? (no means never; yes may mean maybe)
    if a[0]!=b[0]: return False
    if a[1] and b[1] and a[1]!=b[1]: return False
    if a[2] and b[2] and a[2]!=b[2]: return False
    return True
def props_for(idx, sel):
    t,s=items[idx]
    if t!='r': return []
    rs=inner_rules(s) if s.lstrip().startswith('@') else [s]
    mine=[subject(x) for x in split0(sel,',')]
    out=[]
    for r in rs:
        if '{' not in r: continue
        theirs=[subject(x) for x in split0(r[:r.index('{')].strip(),',')]
        if r.lstrip().startswith('@') or any(meet(a,b) for a in mine for b in theirs):   # (only a rule that may style the same elements)
            out+= [k for k,_ in decls(r[r.index('{')+1:r.rindex('}')])]
    return out
def body_of(idx):
    s=items[idx][1]; return s[s.index('{')+1:s.rindex('}')]
def merge_first(sel,idxs):
    # --first: the later rules folded back into the first (where the selector is introduced, with its comment), a
    # declaration moving back only when no rule between (that may style the same elements) sets the same property, and
    # never back past one of the same property left where it was
    first=idxs[0]; target={k:x for k,x in decls(body_of(first))}; added=[]; replaced=False; pinned=[]
    for idx in idxs[1:]:
        between=[k for j in range(first+1,idx) if j not in idxs for k in props_for(j, sel)]
        keep=[]
        for k,x in decls(body_of(idx)):
            if any(overlap(k,b) for b in between+pinned): keep.append(x); pinned.append(k); continue
            if k in target: del target[k]; replaced=True
            target[k]=x; added.append(x)
        s=items[idx][1]
        items[idx]=('r', s[:s.index('{')]+'{'+';'.join(keep)+'}') if keep else ('x','')
    if not added: return
    s=items[first][1]; head=s[:s.index('{')]
    if replaced: items[first]=('r', head+'{'+';'.join(target.values())+'}')
    else: items[first]=('r', head+'{'+body_of(first).rstrip().rstrip(';')+';'+';'.join(added)+'}')
FIRST='--first' in sys.argv
for sel,idxs in sels.items():
    if len(idxs)<2: continue
    if FIRST: merge_first(sel,idxs); continue
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
# (a rule left with nothing in it - every declaration overridden or moved - goes)
empty=lambda t,s: t=='r' and not s.lstrip().startswith('@') and not s[s.index('{')+1:s.rindex('}')].strip()
out=''.join(s for t,s in items if t!='x' and not empty(t,s))
open(p,'w').write(out.rstrip('\n')+'\n')
print('dropped', dropped, 'merged', sum(1 for v in sels.values() if len(v)>1))
