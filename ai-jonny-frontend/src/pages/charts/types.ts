import { Node, Edge } from '@xyflow/react';

export type ShapeType = 'rectangle' | 'rounded-rectangle' | 'circle' | 'diamond' | 'text' | 'org-person';

export interface ChartNodeData extends Record<string, unknown> {
  label: string;
  shape?: ShapeType;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  // For org-person nodes
  personName?: string;
  personRole?: string;
  department?: string;
}

export interface ChartDiagramData {
  id: string;
  title: string;
  description?: string;
  category: 'FLOWCHART' | 'ARCHITECTURE' | 'SEQUENCE' | 'BUSINESS' | 'DATA_PIPELINE' | 'ORGANIZATION' | 'MINDMAP';
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

export interface ChartTemplate {
  id: string;
  title: string;
  category: 'FLOWCHART' | 'ARCHITECTURE' | 'SEQUENCE' | 'BUSINESS' | 'DATA_PIPELINE' | 'ORGANIZATION' | 'MINDMAP';
  description: string;
  complexity: 'Beginner' | 'Intermediate' | 'Advanced';
  nodeCount: number;
  initialNodes: Node[];
  initialEdges: Edge[];
}

export interface SavedChartItem {
  id: string;
  title: string;
  previewText?: string;
  chartType?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  data?: {
    nodes: Node[];
    edges: Edge[];
  };
}
