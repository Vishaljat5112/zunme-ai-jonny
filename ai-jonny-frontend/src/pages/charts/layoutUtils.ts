import dagre from '@dagrejs/dagre';
import { Node, Edge, Position } from '@xyflow/react';

// Graph reachability helper: checks if targetId is reachable from startId (prevents cycles)
export const isReachable = (startId: string, targetId: string, currentEdges: Edge[]): boolean => {
  if (startId === targetId) return true;
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetId) return true;
    if (!visited.has(curr)) {
      visited.add(curr);
      const outgoing = currentEdges.filter((e) => e.source === curr).map((e) => e.target);
      for (const next of outgoing) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }
  return false;
};

// Enhanced Dagre automatic layout calculation for hierarchical spacing
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } => {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';
  const hasOrg = nodes.some((n) => n.type === 'orgPerson');

  // Enhanced hierarchical spacing to eliminate node overlapping
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: hasOrg ? 85 : 60,
    nodesep: hasOrg ? 65 : 50,
    align: 'DL',
    ranker: 'network-simplex'
  });

  nodes.forEach((node) => {
    const isOrg = node.type === 'orgPerson';
    const w = isOrg ? 220 : 180;
    const h = isOrg ? 95 : 50;
    dagreGraph.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes: Node[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id) || { x: 0, y: 0 };
    const isOrg = node.type === 'orgPerson';
    const halfW = isOrg ? 110 : 90;
    const halfH = isOrg ? 48 : 25;
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: Math.round(nodeWithPosition.x - halfW),
        y: Math.round(nodeWithPosition.y - halfH)
      }
    };
  });

  return { nodes: newNodes, edges };
};
