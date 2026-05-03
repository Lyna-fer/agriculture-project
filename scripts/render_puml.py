import urllib.request, os
p=os.path.join('docs','general_diagram.puml')
out=os.path.join('docs','general_diagram.png')
with open(p,'rb') as f:
    data=f.read()
req=urllib.request.Request('http://www.plantuml.com/plantuml/png/', data=data, headers={'Content-Type':'text/plain'})
with urllib.request.urlopen(req, timeout=60) as resp:
    body=resp.read()
    open(out,'wb').write(body)
print('WROTE:'+out)
