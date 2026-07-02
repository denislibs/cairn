import { createPath, type Path } from '@cairn/host';

// Minimal SVG path 'd' parser -> Path. Supports M m L l H h V v C c S s Q q T t Z z.
// Arc (A/a) is approximated as a line to the endpoint (documented limitation).
export function parseSvgPath(d: string): Path {
  const b = createPath();
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cx = 0, cy = 0, startX = 0, startY = 0;
  let prevC2x = 0, prevC2y = 0, prevQx = 0, prevQy = 0;
  let lastCmd = '';
  const num = (): number => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    let cmd = tokens[i];
    if (/[a-zA-Z]/.test(cmd)) i++; else cmd = implicitCmd(lastCmd);
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    switch (C) {
      case 'M': { const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0); b.moveTo(x, y); cx = x; cy = y; startX = x; startY = y; break; }
      case 'L': { const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0); b.lineTo(x, y); cx = x; cy = y; break; }
      case 'H': { const x = num() + (rel ? cx : 0); b.lineTo(x, cy); cx = x; break; }
      case 'V': { const y = num() + (rel ? cy : 0); b.lineTo(cx, y); cy = y; break; }
      case 'C': { const c1x=num()+(rel?cx:0),c1y=num()+(rel?cy:0),c2x=num()+(rel?cx:0),c2y=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.cubicTo(c1x,c1y,c2x,c2y,x,y); prevC2x=c2x; prevC2y=c2y; cx=x; cy=y; break; }
      case 'S': { const reflx = 'CS'.includes(lastCmd.toUpperCase()) ? 2*cx-prevC2x : cx, refly = 'CS'.includes(lastCmd.toUpperCase()) ? 2*cy-prevC2y : cy; const c2x=num()+(rel?cx:0),c2y=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.cubicTo(reflx,refly,c2x,c2y,x,y); prevC2x=c2x; prevC2y=c2y; cx=x; cy=y; break; }
      case 'Q': { const qx=num()+(rel?cx:0),qy=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.quadTo(qx,qy,x,y); prevQx=qx; prevQy=qy; cx=x; cy=y; break; }
      case 'T': { const qx='QT'.includes(lastCmd.toUpperCase())?2*cx-prevQx:cx, qy='QT'.includes(lastCmd.toUpperCase())?2*cy-prevQy:cy; const x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.quadTo(qx,qy,x,y); prevQx=qx; prevQy=qy; cx=x; cy=y; break; }
      case 'A': { num();num();num();num();num(); const x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.lineTo(x,y); cx=x; cy=y; break; }
      case 'Z': { b.close(); cx=startX; cy=startY; break; }
      default: i++; // skip unknown token
    }
    lastCmd = cmd;
  }
  return b.build();
}
function implicitCmd(last: string): string {
  const u = last.toUpperCase();
  if (u === 'M') return last === 'm' ? 'l' : 'L';
  return last || 'L';
}
