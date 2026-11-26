import { Node, Edge, MarkerType } from '@xyflow/react';
import { ChartNodeData, ShapeType } from './types';
import { getLayoutedElements, isReachable } from './layoutUtils';

export interface ParsedDiagramResult {
  title: string;
  diagramMode: 'flowchart' | 'orgchart' | 'mindmap';
  nodes: Node[];
  edges: Edge[];
  rawJson: string;
}

export const getDiagramSystemPrompt = (diagramCategory: string): string => {
  const isOrg = diagramCategory.toLowerCase().includes('org') || diagramCategory === 'ORGANIZATION';
  const isMindmap = diagramCategory.toLowerCase().includes('mind') || diagramCategory === 'MINDMAP';

  if (isOrg) {
    return [
      'You are EgoLytics BFOV Organizational Hierarchy Synthesizer.',
      'Analyze the user requirements and generate a valid corporate/team hierarchy.',
      'You MUST reply with ONLY a raw JSON object (no markdown, no conversational commentary) matching this schema:',
      '{',
      '  "title": "Descriptive Organization Chart Title",',
      '  "diagramMode": "orgchart",',
      '  "nodes": [',
      '    {',
      '      "id": "person_1",',
      '      "type": "orgPerson",',
      '      "personName": "Full Name",',
      '      "personRole": "Job Title / Role",',
      '      "department": "Department / Business Unit",',
      '      "fillColor": "#FFFFFF",',
      '      "borderColor": "#6E56CF"',
      '    }',
      '  ],',
      '  "edges": [',
      '    {',
      '      "id": "e_person_1_person_2",',
      '      "source": "person_1",',
      '      "target": "person_2"',
      '    }',
      '  ]',
      '}',
      'Rules:',
      '1. Root leader (e.g. CEO) has no incoming edges.',
      '2. In an org chart, each subordinate node MUST have exactly ONE manager (one incoming edge).',
      '3. Never create cyclical relationships or self-loops.',
      '4. Output ONLY valid JSON.'
    ].join('\n');
  }

  if (isMindmap) {
    return [
      'You are EgoLytics BFOV Mind Map Synthesizer.',
      'Generate a structured mind map topology with a central core concept and radiating thematic branches.',
      'You MUST reply with ONLY a raw JSON object (no markdown, no conversational commentary) matching this schema:',
      '{',
      '  "title": "Descriptive Mind Map Title",',
      '  "diagramMode": "mindmap",',
      '  "nodes": [',
      '    {',
      '      "id": "root",',
      '      "type": "customShape",',
      '      "label": "Central Vision / Core Topic",',
      '      "shape": "rounded-rectangle",',
      '      "fillColor": "#F4F1FD",',
      '      "borderColor": "#6E56CF"',
      '    },',
      '    {',
      '      "id": "sub_1",',
      '      "type": "customShape",',
      '      "label": "Sub-theme or Action Pillar",',
      '      "shape": "rectangle",',
      '      "fillColor": "#FFFFFF",',
      '      "borderColor": "#0284C7"',
      '    }',
      '  ],',
      '  "edges": [',
      '    {',
      '      "id": "e_root_sub_1",',
      '      "source": "root",',
      '      "target": "sub_1"',
      '    }',
      '  ]',
      '}',
      'Output ONLY valid JSON.'
    ].join('\n');
  }

  // Default: Flowchart & Business Process
  return [
    'You are EgoLytics BFOV Flowchart & Process Synthesizer.',
    'Generate a high-clarity flowchart or business process diagram.',
    'You MUST reply with ONLY a raw JSON object (no markdown, no conversational commentary) matching this schema:',
    '{',
    '  "title": "Descriptive Flowchart Title",',
    '  "diagramMode": "flowchart",',
    '  "nodes": [',
    '    {',
    '      "id": "start",',
    '      "type": "customShape",',
    '      "label": "Start / Trigger Event",',
    '      "shape": "rounded-rectangle",',
    '      "fillColor": "#F4F1FD",',
    '      "borderColor": "#6E56CF"',
    '    },',
    '    {',
    '      "id": "decision_1",',
    '      "type": "customShape",',
    '      "label": "Condition or Check?",',
    '      "shape": "diamond",',
    '      "fillColor": "#FEF3E2",',
    '      "borderColor": "#D97706"',
    '    }',
    '  ],',
    '  "edges": [',
    '    {',
    '      "id": "e_start_decision_1",',
    '      "source": "start",',
    '      "target": "decision_1",',
    '      "label": "Optional condition"',
    '    }',
    '  ]',
    '}',
    'Shapes allowed: "rounded-rectangle", "rectangle", "diamond", "circle", "text".',
    'Output ONLY valid JSON.'
  ].join('\n');
};

/**
 * Extracts and cleans JSON string from LLM responses (stripping markdown blocks or surrounding text).
 */
export const extractJsonFromText = (rawText: string): string => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty or invalid response from AI model');
  }

  let text = rawText.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (text.includes('```')) {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      text = codeBlockMatch[1].trim();
    }
  }

  // Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  return text;
};

/**
 * Parses and strictly validates AI-generated diagram specification, ensuring unique node IDs,
 * valid edge references, non-cyclical org hierarchies, and Dagre auto-layout coordinates.
 */
export const parseAndValidateChartSpec = (
  rawText: string,
  preferredCategory: string = 'flowchart'
): ParsedDiagramResult => {
  const jsonString = extractJsonFromText(rawText);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (initialErr) {
    // Attempt basic syntax cleanup for trailing commas before closing braces/brackets
    const cleaned = jsonString
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('AI response could not be parsed into valid JSON specification.');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Parsed response is not a valid diagram object.');
  }

  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  if (rawNodes.length === 0) {
    throw new Error('Generated specification contains no diagram nodes.');
  }

  // Determine Diagram Mode
  let diagramMode: 'flowchart' | 'orgchart' | 'mindmap' = 'flowchart';
  const pref = preferredCategory.toLowerCase();
  if (pref.includes('org') || pref === 'organization') {
    diagramMode = 'orgchart';
  } else if (pref.includes('mind') || pref === 'mindmap') {
    diagramMode = 'mindmap';
  } else if (parsed.diagramMode && ['flowchart', 'orgchart', 'mindmap'].includes(parsed.diagramMode)) {
    diagramMode = parsed.diagramMode;
  } else if (rawNodes.some((n: any) => n.personName || n.personRole || n.type === 'orgPerson')) {
    diagramMode = 'orgchart';
  }

  const title = (typeof parsed.title === 'string' && parsed.title.trim())
    ? parsed.title.trim()
    : diagramMode === 'orgchart'
    ? 'AI Organizational Hierarchy'
    : diagramMode === 'mindmap'
    ? 'AI Product Mind Map'
    : 'AI Process Flowchart';

  // 1. Validate and Sanitize Nodes
  const validatedNodes: Node[] = [];
  const nodeIds = new Set<string>();

  rawNodes.forEach((rawNode: any, idx: number) => {
    let id = (typeof rawNode.id === 'string' && rawNode.id.trim())
      ? rawNode.id.trim()
      : `node_${idx + 1}`;

    // Ensure uniqueness
    if (nodeIds.has(id)) {
      id = `${id}_${idx + 1}`;
    }
    nodeIds.add(id);

    const isOrg = diagramMode === 'orgchart' || rawNode.type === 'orgPerson' || !!rawNode.personName;
    const label = rawNode.label || rawNode.personName || `Node ${idx + 1}`;

    if (isOrg) {
      const personName = rawNode.personName || label;
      const personRole = rawNode.personRole || rawNode.role || 'Team Member';
      const department = rawNode.department || 'Operations';

      const data: ChartNodeData = {
        label: personName,
        personName,
        personRole,
        department,
        fillColor: rawNode.fillColor || '#FFFFFF',
        borderColor: rawNode.borderColor || '#6E56CF'
      };

      validatedNodes.push({
        id,
        type: 'orgPerson',
        position: { x: 0, y: 0 },
        data
      });
    } else {
      const allowedShapes: ShapeType[] = ['rectangle', 'rounded-rectangle', 'circle', 'diamond', 'text'];
      let shape: ShapeType = 'rounded-rectangle';
      if (rawNode.shape && allowedShapes.includes(rawNode.shape)) {
        shape = rawNode.shape;
      } else if (rawNode.type === 'decision' || String(label).endsWith('?')) {
        shape = 'diamond';
      }

      const isDiamond = shape === 'diamond';
      const data: ChartNodeData = {
        label,
        shape,
        fillColor: rawNode.fillColor || (isDiamond ? '#FEF3E2' : shape === 'text' ? 'transparent' : '#FFFFFF'),
        borderColor: rawNode.borderColor || (isDiamond ? '#D97706' : '#6E56CF'),
        borderWidth: typeof rawNode.borderWidth === 'number' ? rawNode.borderWidth : 1.5,
        textAlign: 'center',
        fontWeight: isDiamond ? 'bold' : 'normal'
      };

      validatedNodes.push({
        id,
        type: 'customShape',
        position: { x: 0, y: 0 },
        data
      });
    }
  });

  // 2. Validate and Sanitize Edges
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
  const validatedEdges: Edge[] = [];
  const edgeIds = new Set<string>();
  const orgAssignedTargets = new Set<string>(); // Single-manager rule in org charts

  rawEdges.forEach((rawEdge: any, idx: number) => {
    const source = typeof rawEdge.source === 'string' ? rawEdge.source.trim() : '';
    const target = typeof rawEdge.target === 'string' ? rawEdge.target.trim() : '';

    // Must connect valid distinct nodes
    if (!source || !target || source === target) return;
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;

    if (diagramMode === 'orgchart') {
      // Rule 1: No multiple managers for same subordinate
      if (orgAssignedTargets.has(target)) return;

      // Rule 2: Prevent circular relationships
      if (isReachable(target, source, validatedEdges)) return;

      orgAssignedTargets.add(target);
    }

    let edgeId = (typeof rawEdge.id === 'string' && rawEdge.id.trim())
      ? rawEdge.id.trim()
      : `e_${source}_${target}_${idx}`;

    if (edgeIds.has(edgeId)) {
      edgeId = `${edgeId}_${idx}`;
    }
    edgeIds.add(edgeId);

    const isOrg = diagramMode === 'orgchart';
    const isHorizontal = diagramMode === 'mindmap';

    validatedEdges.push({
      id: edgeId,
      source,
      target,
      sourceHandle: isHorizontal ? 'r' : 'b',
      targetHandle: isHorizontal ? 'l' : 't',
      type: 'smoothstep',
      label: typeof rawEdge.label === 'string' ? rawEdge.label : undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isOrg ? '#6E56CF' : '#64748B',
        width: 14,
        height: 14
      },
      style: {
        stroke: isOrg ? '#6E56CF' : '#64748B',
        strokeWidth: 2
      }
    });
  });

  // 3. Dagre Auto-Layout for clean coordinates
  const layoutDirection = diagramMode === 'mindmap' ? 'LR' : 'TB';
  const layouted = getLayoutedElements(validatedNodes, validatedEdges, layoutDirection);

  return {
    title,
    diagramMode,
    nodes: layouted.nodes,
    edges: layouted.edges,
    rawJson: JSON.stringify(
      {
        title,
        diagramMode,
        nodes: layouted.nodes,
        edges: layouted.edges
      },
      null,
      2
    )
  };
};
