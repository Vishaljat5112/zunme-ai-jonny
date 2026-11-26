import { Node, Edge } from '@xyflow/react';
import { ChartNodeData } from './types';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFilename(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'diagram';
}

function getNodeDimensions(node: Node): { w: number; h: number } {
  const data = (node.data || {}) as ChartNodeData;
  if (data.width && data.height) {
    return { w: data.width, h: data.height };
  }
  if (node.measured?.width && node.measured?.height) {
    return { w: node.measured.width, h: node.measured.height };
  }
  if (node.type === 'orgPerson') {
    return { w: 220, h: 90 };
  }
  const shape = data.shape;
  if (shape === 'circle') return { w: 90, h: 90 };
  if (shape === 'diamond') return { w: 140, h: 90 };
  if (shape === 'text') return { w: 160, h: 40 };
  return { w: 180, h: 64 };
}

/**
 * Builds a clean, self-contained, high-resolution SVG string of the diagram.
 * Guarantees no clipping by calculating generous bounding boxes and adding headers.
 */
export function generateSvgString(title: string, nodes: Node[], edges: Edge[]): { svgString: string; width: number; height: number } {
  const padding = 60;
  const headerHeight = 60;

  if (nodes.length === 0) {
    const defaultW = 800;
    const defaultH = 500;
    const emptySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${defaultW} ${defaultH}" width="${defaultW}" height="${defaultH}">
  <rect width="${defaultW}" height="${defaultH}" fill="#FFFFFF" />
  <text x="${defaultW / 2}" y="${defaultH / 2}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#94A3B8">
    No diagram nodes to display
  </text>
</svg>`;
    return { svgString: emptySvg, width: defaultW, height: defaultH };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { w, h } = getNodeDimensions(node);
    const x = node.position.x;
    const y = node.position.y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  });

  const boxX = minX - padding;
  const boxY = minY - padding - headerHeight;
  const boxWidth = Math.max(maxX - minX + padding * 2, 600);
  const boxHeight = Math.max(maxY - minY + padding * 2 + headerHeight, 400);

  // SVG Elements
  const defs = `
  <defs>
    <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#6E56CF" />
    </marker>
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284C7" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
    </marker>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.06" />
    </filter>
  </defs>`;

  // Header Elements
  const header = `
  <!-- Canvas White Background -->
  <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="#FFFFFF" />
  
  <!-- Diagram Header Bar -->
  <text x="${boxX + 28}" y="${boxY + 36}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#0F172A">
    ${escapeXml(title || 'Untitled Diagram')}
  </text>
  <text x="${boxX + boxWidth - 28}" y="${boxY + 36}" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#94A3B8">
    EgoLytics BFOV Charts • Zunme AI
  </text>
  <line x1="${boxX + 28}" y1="${boxY + 48}" x2="${boxX + boxWidth - 28}" y2="${boxY + 48}" stroke="#E2E8F0" stroke-width="1.2" />`;

  // Draw Edges
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const edgesSvg = edges
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return '';

      const sDim = getNodeDimensions(source);
      const tDim = getNodeDimensions(target);

      const sx = source.position.x + sDim.w / 2;
      const sy = source.position.y + sDim.h;
      const tx = target.position.x + tDim.w / 2;
      const ty = target.position.y;

      const strokeColor = (edge.style?.stroke as string) || '#64748B';
      const strokeWidth = (edge.style?.strokeWidth as number) || 2;
      const isDashed = edge.style?.strokeDasharray || edge.animated ? 'stroke-dasharray="5,4"' : '';

      let markerId = 'arrow-default';
      if (strokeColor === '#6E56CF') markerId = 'arrow-purple';
      else if (strokeColor === '#0284C7' || strokeColor === '#3B82F6') markerId = 'arrow-blue';
      else if (strokeColor === '#059669' || strokeColor === '#10B981') markerId = 'arrow-green';

      const midY = (sy + ty) / 2;
      const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

      let labelSvg = '';
      if (edge.label) {
        const mx = (sx + tx) / 2;
        const my = midY;
        const lbl = String(edge.label);
        const lblW = Math.max(lbl.length * 7 + 12, 32);
        labelSvg = `
        <rect x="${mx - lblW / 2}" y="${my - 10}" width="${lblW}" height="20" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
        <text x="${mx}" y="${my + 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#475569">
          ${escapeXml(lbl)}
        </text>`;
      }

      return `
      <g class="chart-edge">
        <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${isDashed} marker-end="url(#${markerId})" />
        ${labelSvg}
      </g>`;
    })
    .join('\n');

  // Draw Nodes
  const nodesSvg = nodes
    .map((node) => {
      const data = (node.data || {}) as ChartNodeData;
      const { w, h } = getNodeDimensions(node);
      const nx = node.position.x;
      const ny = node.position.y;
      const cx = nx + w / 2;
      const cy = ny + h / 2;

      const isOrg = node.type === 'orgPerson' || data.shape === 'org-person';

      if (isOrg) {
        const pName = data.personName || data.label || 'Team Member';
        const pRole = data.personRole || 'Team Member';
        const dept = data.department || 'General';
        const borderColor = data.borderColor || '#6E56CF';
        const deptTagW = Math.min(dept.length * 7 + 16, w - 32);

        return `
        <g class="chart-node org-node" transform="translate(0, 0)">
          <!-- Node Container Card -->
          <rect x="${nx}" y="${ny}" width="${w}" height="${h}" rx="12" fill="#FFFFFF" stroke="${borderColor}" stroke-width="2" filter="url(#card-shadow)" />
          <!-- Accent Top Bar -->
          <path d="M ${nx + 12} ${ny} L ${nx + w - 12} ${ny} Q ${nx + w} ${ny} ${nx + w} ${ny + 12} L ${nx + w} ${ny + 6} L ${nx} ${ny + 6} L ${nx} ${ny + 12} Q ${nx} ${ny} ${nx + 12} ${ny} Z" fill="${borderColor}" />
          <!-- Person Name -->
          <text x="${nx + 16}" y="${ny + 30}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#0F172A">
            ${escapeXml(pName)}
          </text>
          <!-- Person Role -->
          <text x="${nx + 16}" y="${ny + 48}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#64748B">
            ${escapeXml(pRole)}
          </text>
          <!-- Department Tag -->
          <rect x="${nx + 16}" y="${ny + 58}" width="${deptTagW}" height="18" rx="9" fill="#F1F5F9" />
          <text x="${nx + 24}" y="${ny + 71}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#475569">
            ${escapeXml(dept)}
          </text>
        </g>`;
      }

      const shape = data.shape || 'rectangle';
      const fillColor = data.fillColor || '#FFFFFF';
      const borderColor = data.borderColor || '#6E56CF';
      const borderWidth = data.borderWidth || 1.5;
      const textColor = data.textColor || '#0F172A';
      const fontSize = data.fontSize || 13;
      const fontWeight = data.fontWeight === 'bold' ? '700' : '500';
      const label = data.label || '';

      let shapeSvg = '';

      if (shape === 'diamond') {
        const pts = `${cx},${ny} ${nx + w},${cy} ${cx},${ny + h} ${nx},${cy}`;
        shapeSvg = `<polygon points="${pts}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}" filter="url(#card-shadow)" />`;
      } else if (shape === 'circle') {
        const r = Math.min(w, h) / 2;
        shapeSvg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}" filter="url(#card-shadow)" />`;
      } else if (shape === 'rounded-rectangle') {
        shapeSvg = `<rect x="${nx}" y="${ny}" width="${w}" height="${h}" rx="12" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}" filter="url(#card-shadow)" />`;
      } else if (shape === 'text') {
        shapeSvg = ''; // purely text
      } else {
        // default rectangle
        shapeSvg = `<rect x="${nx}" y="${ny}" width="${w}" height="${h}" rx="6" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}" filter="url(#card-shadow)" />`;
      }

      const textSvg = `
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}">
        ${escapeXml(label)}
      </text>`;

      return `
      <g class="chart-node">
        ${shapeSvg}
        ${textSvg}
      </g>`;
    })
    .join('\n');

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boxX} ${boxY} ${boxWidth} ${boxHeight}" width="${boxWidth}" height="${boxHeight}">
  ${defs}
  ${header}
  <!-- Edges -->
  <g class="edges-group">
    ${edgesSvg}
  </g>
  <!-- Nodes -->
  <g class="nodes-group">
    ${nodesSvg}
  </g>
</svg>`;

  return { svgString, width: boxWidth, height: boxHeight };
}

/**
 * Triggers client-side SVG download.
 */
export function exportToSvg(title: string, nodes: Node[], edges: Edge[]): void {
  const { svgString } = generateSvgString(title, nodes, edges);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(title)}_diagram.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts SVG to high-DPI HTML5 canvas and triggers crisp PNG download.
 */
export async function exportToPng(title: string, nodes: Node[], edges: Edge[]): Promise<void> {
  const { svgString, width, height } = generateSvgString(title, nodes, edges);

  return new Promise((resolve, reject) => {
    const scale = 2; // 2x retina sharpness
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to acquire canvas context for PNG export'));
      return;
    }

    const img = new Image();
    // Convert SVG to data URI
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${sanitizeFilename(title)}_diagram.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize diagram into PNG'));
    };

    img.src = url;
  });
}

/**
 * Opens a print-ready document window with landscape styling to trigger browser PDF print/save.
 */
export function exportToPdf(title: string, nodes: Node[], edges: Edge[]): void {
  const { svgString } = generateSvgString(title, nodes, edges);

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to export print-ready PDF.');
  }

  const printDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeXml(title)} - EgoLytics BFOV PDF</title>
  <style>
    @page {
      size: landscape;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .print-card {
      width: 100%;
      max-width: 1100px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    svg {
      width: 100%;
      height: auto;
      max-height: 85vh;
      display: block;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-card">
    ${svgString}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(printDoc);
  printWindow.document.close();
}

/**
 * Serializes diagram specification to JSON and triggers download.
 */
export function exportToJson(title: string, nodes: Node[], edges: Edge[]): void {
  const spec = {
    title,
    version: '1.0',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    exportedAt: new Date().toISOString(),
    nodes,
    edges
  };
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(title)}_spec.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
