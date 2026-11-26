import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  ArrowLeft,
  Save,
  Download,
  Workflow,
  Plus,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  MapPin,
  Sparkles,
  Type,
  Square,
  Circle,
  Diamond,
  User,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Eye,
  Settings,
  HelpCircle,
  Palette,
  Check,
  UserPlus,
  Users,
  CornerDownRight,
  Network,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Printer,
  AlertTriangle
} from 'lucide-react';
import { STARTER_TEMPLATES } from './sampleTemplates';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import { CustomShapeNode, OrgPersonNode } from './CustomNodes';
import { ChartNodeData, ShapeType } from './types';
import { isReachable, getLayoutedElements } from './layoutUtils';
import { exportToPng, exportToSvg, exportToPdf, exportToJson } from './exportUtils';
import './ChartsPage.css';

// Node types registry
const nodeTypes = {
  customShape: CustomShapeNode,
  orgPerson: OrgPersonNode
};

// Default Initial Diagram Nodes
const INITIAL_NODES: Node[] = [
  {
    id: 'start-1',
    type: 'customShape',
    data: {
      label: '🚀 Start Flow',
      shape: 'rounded-rectangle',
      fillColor: '#F4F1FD',
      borderColor: '#6E56CF',
      borderWidth: 2,
      fontWeight: 'bold',
      textAlign: 'center'
    },
    position: { x: 260, y: 30 }
  },
  {
    id: 'process-1',
    type: 'customShape',
    data: {
      label: '⚙️ Processing Engine',
      shape: 'rectangle',
      fillColor: '#FFFFFF',
      borderColor: '#0284C7',
      borderWidth: 1.5,
      fontWeight: 'normal',
      textAlign: 'center'
    },
    position: { x: 260, y: 150 }
  },
  {
    id: 'decision-1',
    type: 'customShape',
    data: {
      label: 'Valid?',
      shape: 'diamond',
      fillColor: '#FEF3E2',
      borderColor: '#D97706',
      borderWidth: 1.5,
      fontWeight: 'bold',
      textAlign: 'center'
    },
    position: { x: 275, y: 270 }
  },
  {
    id: 'end-1',
    type: 'customShape',
    data: {
      label: '🎯 Complete Execution',
      shape: 'rounded-rectangle',
      fillColor: '#E8F8F0',
      borderColor: '#059669',
      borderWidth: 2,
      fontWeight: 'bold',
      textAlign: 'center'
    },
    position: { x: 260, y: 430 }
  }
];

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e1-2',
    source: 'start-1',
    target: 'process-1',
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' },
    style: { stroke: '#64748B', strokeWidth: 2 }
  },
  {
    id: 'e2-3',
    source: 'process-1',
    target: 'decision-1',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' },
    style: { stroke: '#64748B', strokeWidth: 2 }
  },
  {
    id: 'e3-4',
    source: 'decision-1',
    target: 'end-1',
    type: 'smoothstep',
    label: 'Yes',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' },
    style: { stroke: '#059669', strokeWidth: 2 }
  }
];

const COLOR_SWATCHES = [
  '#FFFFFF',
  '#F8FAFC',
  '#F4F1FD',
  '#E0F2FE',
  '#E8F8F0',
  '#FEF3E2',
  '#FEE2E2',
  '#1E293B'
];

const BORDER_SWATCHES = [
  '#CBD5E1',
  '#6E56CF',
  '#0284C7',
  '#059669',
  '#D97706',
  '#E11D48',
  '#0F172A'
];

// Inner Editor Component wrapped by ReactFlowProvider
const ChartsEditorInner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, user } = useApp();
  const reactFlowInstance = useReactFlow();

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const loadedTemplateRef = useRef<string | null>(null);
  const loadedChartIdRef = useRef<string | null>(null);
  const loadedAiRef = useRef<boolean>(false);

  const [title, setTitle] = useState('New System Diagram');
  const [currentChartId, setCurrentChartId] = useState<string | null>(searchParams.get('chartId'));
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Check global module availability
  useEffect(() => {
    apiClient.getChartsStatus()
      .then((res) => {
        if (res.success && typeof res.enabled === 'boolean') {
          if (!res.enabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
            setIsModuleDisabled(true);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  // Close export dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as unknown as globalThis.Node)) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [exportMenuOpen]);

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  // Unsaved changes browser prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Hierarchy & diagram mode state
  const [autoArrange, setAutoArrange] = useState(true);
  const [diagramMode, setDiagramMode] = useState<'flowchart' | 'orgchart' | 'mindmap'>('flowchart');

  // Selection state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([
    { nodes: INITIAL_NODES, edges: INITIAL_EDGES }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Push state to undo/redo history
  const pushHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, { nodes: newNodes, edges: newEdges }];
      });
      setHistoryIndex((prev) => prev + 1);
      setIsDirty(true);
    },
    [historyIndex]
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const targetIdx = historyIndex - 1;
    const state = history[targetIdx];
    setNodes(state.nodes);
    setEdges(state.edges);
    setHistoryIndex(targetIdx);
    setSelectedNode(null);
    setSelectedEdge(null);
    setIsDirty(true);
    showToast('Undo', 'info');
  }, [canUndo, historyIndex, history, setNodes, setEdges, showToast]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const targetIdx = historyIndex + 1;
    const state = history[targetIdx];
    setNodes(state.nodes);
    setEdges(state.edges);
    setHistoryIndex(targetIdx);
    setSelectedNode(null);
    setSelectedEdge(null);
    setIsDirty(true);
    showToast('Redo', 'info');
  }, [canRedo, historyIndex, history, setNodes, setEdges, showToast]);

  // Load template or existing chart from query param
  useEffect(() => {
    const templateId = searchParams.get('template');
    const chartIdParam = searchParams.get('chartId');
    const sourceParam = searchParams.get('source');

    if (sourceParam === 'ai' && !loadedAiRef.current) {
      loadedAiRef.current = true;
      const stored = sessionStorage.getItem('zunme_ai_generated_chart');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
            setTitle(parsed.title || 'AI Generated Diagram');
            setCurrentChartId(null);
            if (parsed.diagramMode) {
              setDiagramMode(parsed.diagramMode);
            } else if (parsed.nodes.some((n: Node) => n.type === 'orgPerson')) {
              setDiagramMode('orgchart');
            }
            setNodes(parsed.nodes);
            setEdges(parsed.edges || []);
            setHistory([{ nodes: parsed.nodes, edges: parsed.edges || [] }]);
            setHistoryIndex(0);
            setIsDirty(true);
            showToast('Loaded AI-generated diagram into canvas', 'success');
          }
        } catch (e) {
          console.warn('Failed to parse AI generated chart from session:', e);
        }
      }
    } else if (templateId && loadedTemplateRef.current !== templateId) {
      loadedTemplateRef.current = templateId;
      const found = STARTER_TEMPLATES.find((t) => t.id === templateId);
      if (found) {
        setTitle(found.title);
        setCurrentChartId(null);
        if (found.category === 'ORGANIZATION' || found.initialNodes.some((n) => n.type === 'orgPerson')) {
          setDiagramMode('orgchart');
        } else {
          setDiagramMode('flowchart');
        }
        // Map template nodes to customShape if necessary
        const mappedNodes: Node[] = found.initialNodes.map((n) => ({
          ...n,
          type: n.type === 'orgPerson' ? 'orgPerson' : 'customShape',
          data: {
            label: (n.data?.label as string) || 'Node',
            shape: n.type === 'input' ? 'rounded-rectangle' : n.type === 'output' ? 'rounded-rectangle' : 'rectangle',
            fillColor: '#FFFFFF',
            borderColor: '#6E56CF',
            borderWidth: 1.5,
            ...n.data
          }
        }));
        const layouted = getLayoutedElements(mappedNodes, found.initialEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setHistory([{ nodes: layouted.nodes, edges: layouted.edges }]);
        setHistoryIndex(0);
        setIsDirty(false);
      }
    } else if (chartIdParam && loadedChartIdRef.current !== chartIdParam) {
      loadedChartIdRef.current = chartIdParam;
      setIsLoadingChart(true);
      storageService.getChartAsset(chartIdParam).then((item) => {
        if (!item) {
          showToast('Diagram not found or unauthorized access.', 'error');
          navigate('/user/charts/my-charts');
          setIsLoadingChart(false);
          return;
        }

        setTitle(item.title);
        setCurrentChartId(item.id);

        try {
          const parsed = JSON.parse(item.content);
          if (parsed && typeof parsed === 'object') {
            const restoredNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
            const restoredEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

            setNodes(restoredNodes);
            setEdges(restoredEdges);

            if (parsed.layoutSettings) {
              if (parsed.layoutSettings.autoArrange !== undefined) {
                setAutoArrange(!!parsed.layoutSettings.autoArrange);
              }
              if (parsed.layoutSettings.diagramMode) {
                setDiagramMode(parsed.layoutSettings.diagramMode);
              } else if (restoredNodes.some((n: Node) => n.type === 'orgPerson')) {
                setDiagramMode('orgchart');
              }
            } else if (restoredNodes.some((n: Node) => n.type === 'orgPerson')) {
              setDiagramMode('orgchart');
            }

            setHistory([{ nodes: restoredNodes, edges: restoredEdges }]);
            setHistoryIndex(0);
          }
        } catch (err) {
          console.warn('Failed to parse chart spec JSON:', err);
          showToast('Malformed chart specification restored with default canvas.', 'error');
        } finally {
          setIsDirty(false);
          setIsLoadingChart(false);
        }
      }).catch((err: unknown) => {
        showToast(err instanceof Error ? err.message : 'Error loading diagram', 'error');
        setIsLoadingChart(false);
      });
    }
  }, [searchParams, setNodes, setEdges, navigate, showToast]);

  // Connection handler with directional arrows and smart org validation
  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params;
      if (!source || !target) return;

      // 1. Prevent self-connections
      if (source === target) {
        showToast('Hierarchy rule: Cannot connect a node to itself', 'error');
        return;
      }

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      const isOrg =
        diagramMode === 'orgchart' ||
        sourceNode?.type === 'orgPerson' ||
        targetNode?.type === 'orgPerson';

      if (isOrg) {
        // 2. Prevent multiple managers: An employee cannot report to multiple managers
        const hasManager = edges.some((e) => e.target === target);
        if (hasManager) {
          showToast('Hierarchy rule: An employee cannot report to multiple managers', 'error');
          return;
        }

        // 3. Prevent circular hierarchy relationships (cycle check via DFS)
        if (isReachable(target, source, edges)) {
          showToast('Hierarchy rule: Circular reporting relationships are not allowed', 'error');
          return;
        }
      }

      const newEdge: Edge = {
        ...params,
        id: `e_${Date.now()}`,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isOrg ? '#6E56CF' : '#64748B',
          width: 14,
          height: 14
        },
        style: { stroke: isOrg ? '#6E56CF' : '#64748B', strokeWidth: 2 }
      } as Edge;

      const nextEdges = addEdge(newEdge, edges);

      if (autoArrange && isOrg) {
        const layouted = getLayoutedElements(nodes, nextEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        pushHistory(layouted.nodes, layouted.edges);
      } else {
        setEdges(nextEdges);
        pushHistory(nodes, nextEdges);
      }
    },
    [nodes, edges, diagramMode, autoArrange, pushHistory, showToast, setNodes, setEdges]
  );

  // Hierarchy Action 1: Add Subordinate
  const handleAddSubordinate = useCallback(
    (targetParentNode?: Node) => {
      const parent = targetParentNode || selectedNode;
      if (!parent) {
        showToast('Select an employee card first to add a subordinate', 'info');
        return;
      }
      const parentData = (parent.data || {}) as ChartNodeData;
      const newId = `org_${Date.now()}`;
      const defaultDept = parentData.department || 'Operations';

      // Count existing direct reports for manual placement offset
      const directReports = edges.filter((e) => e.source === parent.id);
      const subIdx = directReports.length;

      const newNode: Node = {
        id: newId,
        type: 'orgPerson',
        selected: true,
        position: {
          x: parent.position.x + (subIdx * 230),
          y: parent.position.y + 140
        },
        data: {
          label: 'New Team Member',
          personName: 'New Team Member',
          personRole: 'Specialist / Associate',
          department: defaultDept,
          fillColor: '#FFFFFF',
          borderColor: '#6E56CF'
        }
      };

      const newEdge: Edge = {
        id: `e_${parent.id}_${newId}`,
        source: parent.id,
        target: newId,
        sourceHandle: 'b',
        targetHandle: 't',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF', width: 14, height: 14 },
        style: { stroke: '#6E56CF', strokeWidth: 2 }
      };

      const updatedNodes = [...nodes.map((n) => ({ ...n, selected: false })), newNode];
      const updatedEdges = [...edges, newEdge];

      if (autoArrange) {
        const layouted = getLayoutedElements(updatedNodes, updatedEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        pushHistory(layouted.nodes, layouted.edges);
        const added = layouted.nodes.find((n) => n.id === newId) || newNode;
        setSelectedNode(added);
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
        pushHistory(updatedNodes, updatedEdges);
        setSelectedNode(newNode);
      }
      setSelectedEdge(null);
      showToast(`Added subordinate under ${parentData.personName || parentData.label || 'Manager'}`, 'success');
    },
    [selectedNode, nodes, edges, autoArrange, pushHistory, setNodes, setEdges, showToast]
  );

  // Hierarchy Action 2: Add Sibling (Peer)
  const handleAddSibling = useCallback(
    (referenceNode?: Node) => {
      const ref = referenceNode || selectedNode;
      if (!ref) {
        showToast('Select an employee card first to add a peer/sibling', 'info');
        return;
      }
      const refData = (ref.data || {}) as ChartNodeData;
      const newId = `org_${Date.now()}`;
      const managerEdge = edges.find((e) => e.target === ref.id);

      const newNode: Node = {
        id: newId,
        type: 'orgPerson',
        selected: true,
        position: {
          x: ref.position.x + 240,
          y: ref.position.y
        },
        data: {
          label: 'New Team Member',
          personName: 'New Team Member',
          personRole: refData.personRole || 'Team Specialist',
          department: refData.department || 'Operations',
          fillColor: '#FFFFFF',
          borderColor: '#6E56CF'
        }
      };

      let updatedEdges = [...edges];
      if (managerEdge) {
        const newEdge: Edge = {
          id: `e_${managerEdge.source}_${newId}`,
          source: managerEdge.source,
          target: newId,
          sourceHandle: 'b',
          targetHandle: 't',
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF', width: 14, height: 14 },
          style: { stroke: '#6E56CF', strokeWidth: 2 }
        };
        updatedEdges.push(newEdge);
      }

      const updatedNodes = [...nodes.map((n) => ({ ...n, selected: false })), newNode];

      if (autoArrange) {
        const layouted = getLayoutedElements(updatedNodes, updatedEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        pushHistory(layouted.nodes, layouted.edges);
        const added = layouted.nodes.find((n) => n.id === newId) || newNode;
        setSelectedNode(added);
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
        pushHistory(updatedNodes, updatedEdges);
        setSelectedNode(newNode);
      }
      setSelectedEdge(null);
      showToast(
        managerEdge
          ? 'Added peer under same manager'
          : 'Added peer executive at top level',
        'success'
      );
    },
    [selectedNode, nodes, edges, autoArrange, pushHistory, setNodes, setEdges, showToast]
  );

  // Hierarchy Action 3: Change Manager (Reassign reporting line)
  const handleChangeManager = useCallback(
    (employeeId: string, newManagerId: string) => {
      if (!employeeId) return;

      // Cannot assign self
      if (employeeId === newManagerId) {
        showToast('Hierarchy rule: An employee cannot be their own manager', 'error');
        return;
      }

      // Cycle prevention: newManagerId cannot be a descendant of employeeId
      if (newManagerId && isReachable(employeeId, newManagerId, edges)) {
        showToast('Hierarchy rule: Circular reporting relationships are not allowed', 'error');
        return;
      }

      // Remove existing incoming manager edge
      const filteredEdges = edges.filter((e) => e.target !== employeeId);

      let updatedEdges = filteredEdges;
      if (newManagerId) {
        const newEdge: Edge = {
          id: `e_${newManagerId}_${employeeId}`,
          source: newManagerId,
          target: employeeId,
          sourceHandle: 'b',
          targetHandle: 't',
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF', width: 14, height: 14 },
          style: { stroke: '#6E56CF', strokeWidth: 2 }
        };
        updatedEdges = [...filteredEdges, newEdge];
      }

      if (autoArrange) {
        const layouted = getLayoutedElements(nodes, updatedEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        pushHistory(layouted.nodes, layouted.edges);
        const updatedSelected = layouted.nodes.find((n) => n.id === employeeId);
        if (updatedSelected) setSelectedNode(updatedSelected);
      } else {
        setEdges(updatedEdges);
        pushHistory(nodes, updatedEdges);
      }

      const emp = nodes.find((n) => n.id === employeeId);
      const empName = (emp?.data as ChartNodeData)?.personName || 'Employee';
      if (newManagerId) {
        const mgr = nodes.find((n) => n.id === newManagerId);
        const mgrName = (mgr?.data as ChartNodeData)?.personName || 'New Manager';
        showToast(`Assigned ${empName} to report to ${mgrName}`, 'success');
      } else {
        showToast(`${empName} is now top-level (no manager)`, 'info');
      }
    },
    [nodes, edges, autoArrange, pushHistory, setNodes, setEdges, showToast]
  );

  // Selection handlers via explicit user clicks and canvas interactions
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Drag and Drop from left palette
  const onDragStart = (e: React.DragEvent, shapeType: ShapeType) => {
    e.dataTransfer.setData('application/reactflow/shape', shapeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const shapeType = e.dataTransfer.getData('application/reactflow/shape') as ShapeType;
      if (!shapeType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY
      });

      const isOrg = shapeType === 'org-person';
      const id = `node_${Date.now()}`;

      const newNode: Node = {
        id,
        type: isOrg ? 'orgPerson' : 'customShape',
        position,
        data: isOrg
          ? {
              label: 'Team Member',
              personName: 'Alex Creator',
              personRole: 'Lead Architect',
              department: 'Engineering',
              fillColor: '#FFFFFF',
              borderColor: '#6E56CF'
            }
          : {
              label: shapeType === 'text' ? 'Text Annotation' : shapeType === 'diamond' ? 'Decision?' : 'New Process Node',
              shape: shapeType,
              fillColor: shapeType === 'text' ? 'transparent' : shapeType === 'diamond' ? '#FEF3E2' : '#FFFFFF',
              borderColor: shapeType === 'diamond' ? '#D97706' : '#6E56CF',
              borderWidth: 1.5,
              fontSize: shapeType === 'text' ? 14 : 13,
              fontWeight: shapeType === 'diamond' ? 'bold' : 'normal',
              textAlign: 'center'
            }
      };

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      pushHistory(nextNodes, edges);
      setSelectedNode(newNode);
      showToast(`Added ${shapeType.replace('-', ' ')} node`, 'info');
    },
    [reactFlowInstance, nodes, setNodes, edges, pushHistory, showToast]
  );

  // Click-to-add shape at viewport center
  const addShapeDirect = useCallback(
    (shapeType: ShapeType) => {
      const isOrg = shapeType === 'org-person';
      const id = `node_${Date.now()}`;

      const newNode: Node = {
        id,
        type: isOrg ? 'orgPerson' : 'customShape',
        position: { x: 260 + (Math.random() * 40 - 20), y: 200 + (Math.random() * 40 - 20) },
        data: isOrg
          ? {
              label: 'Team Member',
              personName: 'Alex Creator',
              personRole: 'Lead Architect',
              department: 'Engineering',
              fillColor: '#FFFFFF',
              borderColor: '#6E56CF'
            }
          : {
              label: shapeType === 'text' ? 'Text Annotation' : shapeType === 'diamond' ? 'Decision?' : 'New Node',
              shape: shapeType,
              fillColor: shapeType === 'text' ? 'transparent' : shapeType === 'diamond' ? '#FEF3E2' : '#FFFFFF',
              borderColor: shapeType === 'diamond' ? '#D97706' : '#6E56CF',
              borderWidth: 1.5,
              fontSize: 13,
              fontWeight: shapeType === 'diamond' ? 'bold' : 'normal',
              textAlign: 'center'
            }
      };

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      pushHistory(nextNodes, edges);
      setSelectedNode(newNode);
      showToast(`Added ${shapeType.replace('-', ' ')}`, 'info');
    },
    [nodes, setNodes, edges, pushHistory, showToast]
  );

  // Duplicate selected node
  const duplicateSelected = useCallback(() => {
    if (!selectedNode) return;
    const newId = `node_${Date.now()}`;
    const cloned: Node = {
      ...selectedNode,
      id: newId,
      position: {
        x: selectedNode.position.x + 30,
        y: selectedNode.position.y + 30
      },
      selected: true,
      data: { ...selectedNode.data }
    };
    const nextNodes: Node[] = [...nodes.map((n) => ({ ...n, selected: false })), cloned];
    setNodes(nextNodes);
    pushHistory(nextNodes, edges);
    setSelectedNode(cloned);
    showToast('Duplicated node', 'info');
  }, [selectedNode, nodes, setNodes, edges, pushHistory, showToast]);

  // Delete selected node or edge
  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      const nextNodes = nodes.filter((n) => n.id !== selectedNode.id);
      const nextEdges = edges.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges);
      setSelectedNode(null);
      showToast('Node removed', 'info');
    } else if (selectedEdge) {
      const nextEdges = edges.filter((e) => e.id !== selectedEdge.id);
      setEdges(nextEdges);
      pushHistory(nodes, nextEdges);
      setSelectedEdge(null);
      showToast('Connector removed', 'info');
    }
  }, [selectedNode, selectedEdge, nodes, edges, setNodes, setEdges, pushHistory, showToast]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      else if ((cmdOrCtrl && e.key.toLowerCase() === 'y') || (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      }
      // Duplicate: Ctrl+D / Cmd+D
      else if (cmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      // Delete / Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      // Select All: Ctrl+A / Cmd+A
      else if (cmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
      }
      // Escape: Deselect all
      else if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedEdge(null);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, duplicateSelected, deleteSelected, setNodes]);

  // Node Property Update helper
  const updateSelectedNodeData = (updates: Partial<ChartNodeData>) => {
    if (!selectedNode) return;
    const updatedSelected = {
      ...selectedNode,
      data: { ...selectedNode.data, ...updates }
    };
    setSelectedNode(updatedSelected);
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } } : n))
    );
    setIsDirty(true);
  };

  // Edge Property Update helper
  const updateSelectedEdge = (updates: Partial<Edge>) => {
    if (!selectedEdge) return;
    const updatedSelected = { ...selectedEdge, ...updates };
    setSelectedEdge(updatedSelected);
    setEdges((eds) =>
      eds.map((e) => (e.id === selectedEdge.id ? { ...e, ...updates } : e))
    );
    setIsDirty(true);
  };

  // Auto layout triggers (TB / LR)
  const onAutoLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const layouted = getLayoutedElements(nodes, edges, direction);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      pushHistory(layouted.nodes, layouted.edges);
      showToast(`Auto-arranged layout (${direction === 'TB' ? 'Vertical' : 'Horizontal'})`, 'info');
    },
    [nodes, edges, setNodes, setEdges, pushHistory, showToast]
  );

  // Clear Canvas with confirmation
  const handleClearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (window.confirm('Clear canvas? All unsaved nodes and connections will be removed.')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setSelectedEdge(null);
      pushHistory([], []);
      showToast('Canvas cleared', 'info');
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      editorContainerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Save to Library (Update existing record or create new)
  const handleSaveToLibrary = async (forceDuplicate = false) => {
    if (isModuleDisabled) {
      showToast('EgoLytics BFOV Charts module is currently disabled by administrator', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please provide a diagram title', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const spec = {
        title: title.trim(),
        nodes,
        edges,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        layoutSettings: {
          direction: 'TB',
          autoArrange,
          diagramMode
        },
        updatedAt: new Date().toISOString()
      };

      const previewText = `${nodes.length} nodes, ${edges.length} edges • ${
        diagramMode === 'orgchart' ? 'Org Hierarchy' : diagramMode === 'mindmap' ? 'Mind Map' : 'Flowchart'
      }`;

      if (currentChartId && !forceDuplicate) {
        // Update existing record in-place!
        await storageService.updateChartAsset(currentChartId, {
          title: title.trim(),
          chartSpecJson: JSON.stringify(spec, null, 2),
          chartType: diagramMode === 'orgchart' ? 'OrgChart' : 'Flowchart',
          previewText
        });
        showToast(`Saved changes to "${title.trim()}"`, 'success');
        setIsDirty(false);
      } else {
        // Create new record
        const saveTitle = forceDuplicate ? `${title.trim()} (Copy)` : title.trim();
        const saved = await storageService.saveChartAsset({
          title: saveTitle,
          chartSpecJson: JSON.stringify({ ...spec, title: saveTitle }, null, 2),
          chartType: diagramMode === 'orgchart' ? 'OrgChart' : 'Flowchart',
          previewText
        });
        setCurrentChartId(saved.id);
        if (forceDuplicate) setTitle(saveTitle);
        navigate(`/user/charts/editor?chartId=${saved.id}`, { replace: true });
        showToast(forceDuplicate ? `Duplicated as "${saveTitle}"` : `Saved "${saveTitle}" to My Library`, 'success');
        setIsDirty(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save diagram';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToOverview = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) {
      return;
    }
    navigate('/user/charts');
  };

  // Diagram Export Handler supporting PNG, SVG, PDF and JSON
  const handleExport = async (format: 'png' | 'svg' | 'pdf' | 'json') => {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      if (format === 'png') {
        await exportToPng(title, nodes, edges);
        showToast('Exported diagram as high-resolution PNG image', 'success');
      } else if (format === 'svg') {
        exportToSvg(title, nodes, edges);
        showToast('Exported diagram as scalable vector SVG', 'success');
      } else if (format === 'pdf') {
        exportToPdf(title, nodes, edges);
        showToast('Opened print preview for PDF document export', 'info');
      } else if (format === 'json') {
        exportToJson(title, nodes, edges);
        showToast('Exported diagram specification JSON', 'info');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      showToast(msg, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => handleExport('json');

  // Preset Loaders for manual creation support
  const loadPreset = (type: 'flowchart' | 'orgchart' | 'mindmap' | 'corp' | 'small' | 'dept') => {
    if (type === 'orgchart' || type === 'corp') {
      const template = STARTER_TEMPLATES.find((t) => t.id === 'tpl_corp_hierarchy');
      if (template) {
        const layouted = getLayoutedElements(template.initialNodes, template.initialEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setTitle(template.title);
        setDiagramMode('orgchart');
        pushHistory(layouted.nodes, layouted.edges);
        showToast('Loaded Corporate Hierarchy template', 'info');
      }
    } else if (type === 'small') {
      const template = STARTER_TEMPLATES.find((t) => t.id === 'tpl_small_biz_team');
      if (template) {
        const layouted = getLayoutedElements(template.initialNodes, template.initialEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setTitle(template.title);
        setDiagramMode('orgchart');
        pushHistory(layouted.nodes, layouted.edges);
        showToast('Loaded Small Business Team template', 'info');
      }
    } else if (type === 'dept') {
      const template = STARTER_TEMPLATES.find((t) => t.id === 'tpl_dept_engineering');
      if (template) {
        const layouted = getLayoutedElements(template.initialNodes, template.initialEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setTitle(template.title);
        setDiagramMode('orgchart');
        pushHistory(layouted.nodes, layouted.edges);
        showToast('Loaded Department Structure template', 'info');
      }
    } else if (type === 'mindmap') {
      const mmNodes: Node[] = [
        {
          id: 'root-mindmap',
          type: 'customShape',
          position: { x: 280, y: 160 },
          data: { label: '🧠 2026 Core Vision', shape: 'rounded-rectangle', fillColor: '#F4F1FD', borderColor: '#6E56CF', borderWidth: 2, fontWeight: 'bold' }
        },
        {
          id: 'mm-sub-1',
          type: 'customShape',
          position: { x: 80, y: 70 },
          data: { label: 'AI Synthesis Engine', shape: 'text', textColor: '#0284C7', fontWeight: 'bold' }
        },
        {
          id: 'mm-sub-2',
          type: 'customShape',
          position: { x: 480, y: 70 },
          data: { label: 'Autonomous Agents', shape: 'text', textColor: '#059669', fontWeight: 'bold' }
        },
        {
          id: 'mm-sub-3',
          type: 'customShape',
          position: { x: 280, y: 300 },
          data: { label: 'Real-time Grounding', shape: 'text', textColor: '#D97706', fontWeight: 'bold' }
        }
      ];
      const mmEdges: Edge[] = [
        { id: 'emm-1', source: 'root-mindmap', target: 'mm-sub-1', type: 'default', style: { stroke: '#0284C7', strokeWidth: 2 } },
        { id: 'emm-2', source: 'root-mindmap', target: 'mm-sub-2', type: 'default', style: { stroke: '#059669', strokeWidth: 2 } },
        { id: 'emm-3', source: 'root-mindmap', target: 'mm-sub-3', type: 'default', style: { stroke: '#D97706', strokeWidth: 2 } }
      ];
      setNodes(mmNodes);
      setEdges(mmEdges);
      setTitle('Product Mind Map');
      setDiagramMode('mindmap');
      pushHistory(mmNodes, mmEdges);
      showToast('Loaded Mind Map blueprint', 'info');
    } else {
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      setTitle('Process Workflow');
      setDiagramMode('flowchart');
      pushHistory(INITIAL_NODES, INITIAL_EDGES);
      showToast('Loaded Process Flowchart blueprint', 'info');
    }
  };

  const selectedNodeData = (selectedNode?.data || {}) as ChartNodeData;

  return (
    <div className="chart-editor-layout" ref={editorContainerRef}>
      {/* 1. Top Action & Navigation Toolbar */}
      <div className="chart-editor-topbar">
        {/* Left: Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleBackToOverview}
            title="Return to Charts Hub"
            style={{ padding: '6px 10px', borderRadius: '8px' }}
          >
            <ArrowLeft size={16} />
            <span>Overview</span>
          </button>

          <div className="toolbar-divider" />

          <input
            type="text"
            className="input-field"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            style={{
              fontWeight: '700',
              fontSize: '14px',
              border: '1px solid transparent',
              background: 'transparent',
              padding: '4px 8px',
              borderRadius: '6px',
              width: '230px'
            }}
            placeholder="Untitled Diagram"
          />

          {/* Real-time Save State Indicator */}
          {isDirty ? (
            <span
              className="chart-status-badge unsaved"
              title="Unsaved changes pending"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: '#D97706',
                background: '#FEF3E2',
                padding: '2px 7px',
                borderRadius: '6px',
                fontWeight: '700'
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }} />
              <span>Unsaved</span>
            </span>
          ) : (
            <span
              className="chart-status-badge saved"
              title="Saved to database"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                color: '#059669',
                background: '#E8F8F0',
                padding: '2px 7px',
                borderRadius: '6px',
                fontWeight: '600'
              }}
            >
              <Check size={12} />
              <span>Saved</span>
            </span>
          )}

          <span className="phase-indicator-pill">Phase 6: Multi-Format Export, Templates &amp; Admin Controls</span>
        </div>

        {/* Center: Undo/Redo & Canvas Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div className="toolbar-btn-group">
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              style={{ opacity: canUndo ? 1 : 0.4 }}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              style={{ opacity: canRedo ? 1 : 0.4 }}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={14} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Quick Blueprint Presets */}
          <div className="toolbar-btn-group">
            <button
              type="button"
              className={`toolbar-icon-btn ${diagramMode === 'flowchart' ? 'active' : ''}`}
              onClick={() => loadPreset('flowchart')}
              title="Load Flowchart Preset"
            >
              Flowchart
            </button>
            <button
              type="button"
              className={`toolbar-icon-btn ${diagramMode === 'orgchart' ? 'active' : ''}`}
              onClick={() => loadPreset('orgchart')}
              title="Load Corporate Org Hierarchy"
            >
              Org Chart
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => loadPreset('small')}
              title="Load Small Business Team"
              style={{ fontSize: '11px' }}
            >
              Small Biz
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => loadPreset('dept')}
              title="Load Department Structure"
              style={{ fontSize: '11px' }}
            >
              Dept
            </button>
            <button
              type="button"
              className={`toolbar-icon-btn ${diagramMode === 'mindmap' ? 'active' : ''}`}
              onClick={() => loadPreset('mindmap')}
              title="Load Mind Map"
            >
              Mind Map
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Auto-Arrange Toggle */}
          <label className="toolbar-toggle-label" title="Automatically re-arrange hierarchy tree on changes">
            <input
              type="checkbox"
              checked={autoArrange}
              onChange={(e) => setAutoArrange(e.target.checked)}
            />
            <span>Auto-Arrange</span>
          </label>

          <div className="toolbar-divider" />

          {/* Dagre Auto-Layout */}
          <div className="toolbar-btn-group">
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => onAutoLayout('TB')}
              title="Auto-Arrange Vertically (Top to Bottom)"
            >
              <Workflow size={13} color="#6E56CF" style={{ marginRight: '4px' }} />
              <span>TB Layout</span>
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => onAutoLayout('LR')}
              title="Auto-Arrange Horizontally (Left to Right)"
            >
              <Workflow size={13} color="#0284C7" style={{ marginRight: '4px' }} />
              <span>LR Layout</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Canvas View Actions */}
          <div className="toolbar-btn-group">
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => reactFlowInstance.zoomIn()}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => reactFlowInstance.zoomOut()}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={() => reactFlowInstance.fitView({ padding: 0.2 })}
              title="Fit to View"
            >
              <Maximize size={14} />
            </button>
            <button
              type="button"
              className={`toolbar-icon-btn ${showMinimap ? 'active' : ''}`}
              onClick={() => setShowMinimap(!showMinimap)}
              title="Toggle Minimap"
            >
              <MapPin size={14} />
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        {/* Right: Export & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClearCanvas}
            title="Clear Canvas"
            style={{ color: '#EF4444', fontSize: '12px', gap: '4px' }}
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>

          {/* Export Dropdown Menu */}
          <div ref={exportDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={isExporting}
              title="Export diagram in various formats"
              style={{ fontSize: '12px', gap: '5px' }}
            >
              <Download size={13} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown size={12} style={{ opacity: 0.7 }} />
            </button>

            {exportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  minWidth: '200px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleExport('png')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1E293B',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <ImageIcon size={14} color="#3B82F6" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>PNG Image</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '400' }}>High-res raster (.png)</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('svg')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1E293B',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Workflow size={14} color="#8B5CF6" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>SVG Vector</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '400' }}>Scalable vector (.svg)</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1E293B',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Printer size={14} color="#059669" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>PDF Document</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '400' }}>Print / Save PDF (.pdf)</span>
                  </div>
                </button>

                <div style={{ height: '1px', background: '#E2E8F0', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1E293B',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <FileText size={14} color="#D97706" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>JSON Schema</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '400' }}>Full editable spec (.json)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {currentChartId && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleSaveToLibrary(true)}
              disabled={isSaving || isModuleDisabled}
              title={isModuleDisabled ? 'Module disabled by administrator' : 'Save a separate copy of this diagram'}
              style={{ fontSize: '12px', gap: '4px' }}
            >
              <Copy size={13} />
              <span>Duplicate</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleSaveToLibrary(false)}
            disabled={isSaving || isModuleDisabled}
            title={isModuleDisabled ? 'Module disabled by administrator' : undefined}
            style={{ fontSize: '12px', gap: '5px' }}
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : currentChartId ? 'Save Changes' : 'Save to Library'}</span>
          </button>
        </div>
      </div>

      {/* Module Availability Warning Banner */}
      {isModuleDisabled && (
        <div
          style={{
            background: '#FEF2F2',
            borderBottom: '1px solid #FCA5A5',
            padding: '8px 16px',
            color: '#B91C1C',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={14} color="#DC2626" />
          <span>EgoLytics BFOV Charts module is currently disabled for maintenance by administrator. Saving is restricted.</span>
        </div>
      )}

      {/* 2. Main Workspace: Left Palette + Center Canvas + Right Properties Panel */}
      {isLoadingChart ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', gap: '8px', minHeight: '400px' }}>
          <span>Loading diagram from database...</span>
        </div>
      ) : (
        <div className="chart-editor-body">
        {/* Left Shape Palette */}
        <div className="chart-node-palette">
          <div className="palette-category-title">
            <Square size={13} color="#6E56CF" />
            <span>Standard Shapes</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'rectangle')}
            onClick={() => addShapeDirect('rectangle')}
            title="Drag onto canvas or click to add"
          >
            <Square size={14} color="#6E56CF" />
            <span>Rectangle</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'rounded-rectangle')}
            onClick={() => addShapeDirect('rounded-rectangle')}
            title="Drag onto canvas or click to add"
          >
            <div style={{ width: 14, height: 14, borderRadius: 5, border: '1.5px solid #0284C7' }} />
            <span>Rounded Rectangle</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'circle')}
            onClick={() => addShapeDirect('circle')}
            title="Drag onto canvas or click to add"
          >
            <Circle size={14} color="#059669" />
            <span>Circle / Terminal</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'diamond')}
            onClick={() => addShapeDirect('diamond')}
            title="Drag onto canvas or click to add"
          >
            <Diamond size={14} color="#D97706" />
            <span>Diamond (Decision)</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'text')}
            onClick={() => addShapeDirect('text')}
            title="Drag onto canvas or click to add"
          >
            <Type size={14} color="#64748B" />
            <span>Text / Annotation</span>
          </div>

          <div className="palette-category-title">
            <User size={13} color="#8B5CF6" />
            <span>Org &amp; Hierarchy</span>
          </div>

          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, 'org-person')}
            onClick={() => addShapeDirect('org-person')}
            title="Drag onto canvas or click to add"
          >
            <User size={14} color="#8B5CF6" />
            <span>Person / Position Card</span>
          </div>

          <div style={{ borderTop: '1px solid #F1F4F9', marginTop: '16px', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
              Shortcuts
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.8' }}>
              <div><kbd style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>Del</kbd> Delete selected</div>
              <div><kbd style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>Ctrl+D</kbd> Duplicate</div>
              <div><kbd style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>Ctrl+Z</kbd> Undo</div>
              <div><kbd style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>Ctrl+Y</kbd> Redo</div>
            </div>
          </div>
        </div>

        {/* Center: React Flow Canvas */}
        <div
          className="chart-canvas-area"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B', width: 16, height: 16 },
              style: { stroke: '#64748B', strokeWidth: 2 }
            }}
            fitView
          >
            <Controls showInteractive={false} position="bottom-left" />
            {showMinimap && (
              <MiniMap
                nodeStrokeColor="#6E56CF"
                nodeColor={(n) => ((n.data?.fillColor as string) || '#EFEBFC')}
                position="bottom-right"
                style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8ECF5' }}
              />
            )}
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#CBD5E1" />
          </ReactFlow>
        </div>

        {/* Right: Properties Inspector Panel */}
        <div className="chart-properties-panel">
          {selectedNode ? (
            /* Node Properties Inspector */
            <>
              <div className="props-panel-header">
                <div className="props-panel-title">
                  <Sliders size={16} color="#6E56CF" />
                  <span>Node Properties</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className="toolbar-icon-btn"
                    onClick={duplicateSelected}
                    title="Duplicate node (Ctrl+D)"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="toolbar-icon-btn"
                    onClick={deleteSelected}
                    style={{ color: '#EF4444' }}
                    title="Delete node (Del)"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Node Label / Text Content */}
              {selectedNode.type === 'orgPerson' ? (
                <>
                  {/* Phase 3: Org Hierarchy Operations */}
                  <div className="org-hierarchy-actions">
                    <div className="org-hierarchy-actions-title">
                      <UserPlus size={13} color="#6E56CF" />
                      <span>Hierarchy Actions</span>
                    </div>
                    <div className="org-action-btn-row">
                      <button
                        type="button"
                        className="org-action-btn primary"
                        onClick={() => handleAddSubordinate()}
                        title="Add subordinate reporting to this person"
                      >
                        <CornerDownRight size={13} />
                        <span>Subordinate</span>
                      </button>
                      <button
                        type="button"
                        className="org-action-btn secondary"
                        onClick={() => handleAddSibling()}
                        title="Add peer sibling under same manager"
                      >
                        <Users size={13} />
                        <span>Sibling</span>
                      </button>
                    </div>

                    {/* Reporting Manager Selector */}
                    <div className="props-field-group" style={{ marginTop: '4px' }}>
                      <label className="props-label" style={{ fontSize: '10.5px' }}>
                        Change Manager
                      </label>
                      <select
                        className="input-field"
                        value={edges.find((e) => e.target === selectedNode.id)?.source || ''}
                        onChange={(e) => handleChangeManager(selectedNode.id, e.target.value)}
                        style={{ fontSize: '12px', padding: '5px 8px' }}
                      >
                        <option value="">None (Top-Level Executive / Leader)</option>
                        {nodes
                          .filter(
                            (n) =>
                              n.type === 'orgPerson' &&
                              n.id !== selectedNode.id &&
                              !isReachable(selectedNode.id, n.id, edges)
                          )
                          .map((m) => {
                            const mData = (m.data || {}) as ChartNodeData;
                            return (
                              <option key={m.id} value={m.id}>
                                {mData.personName || mData.label || m.id} ({mData.personRole || 'Leader'})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>

                  <div className="props-field-group">
                    <label className="props-label">Full Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={selectedNodeData.personName || ''}
                      onChange={(e) => updateSelectedNodeData({ personName: e.target.value, label: e.target.value })}
                      placeholder="e.g. Alex Creator"
                    />
                  </div>
                  <div className="props-field-group">
                    <label className="props-label">Job Title / Role</label>
                    <input
                      type="text"
                      className="input-field"
                      value={selectedNodeData.personRole || ''}
                      onChange={(e) => updateSelectedNodeData({ personRole: e.target.value })}
                      placeholder="e.g. Lead Architect"
                    />
                  </div>
                  <div className="props-field-group">
                    <label className="props-label">Department / Unit</label>
                    <input
                      type="text"
                      className="input-field"
                      value={selectedNodeData.department || ''}
                      onChange={(e) => updateSelectedNodeData({ department: e.target.value })}
                      placeholder="e.g. Engineering"
                    />
                  </div>
                </>
              ) : (
                <div className="props-field-group">
                  <label className="props-label">Node Text</label>
                  <textarea
                    rows={3}
                    className="input-field"
                    value={selectedNodeData.label || ''}
                    onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                    placeholder="Enter node text..."
                    style={{ resize: 'vertical', fontSize: '13px' }}
                  />
                </div>
              )}

              {/* Shape Switcher (For CustomShape nodes) */}
              {selectedNode.type === 'customShape' && (
                <div className="props-field-group">
                  <label className="props-label">Shape</label>
                  <select
                    className="input-field"
                    value={selectedNodeData.shape || 'rounded-rectangle'}
                    onChange={(e) => updateSelectedNodeData({ shape: e.target.value as ShapeType })}
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="rounded-rectangle">Rounded Rectangle</option>
                    <option value="circle">Circle / Terminal</option>
                    <option value="diamond">Diamond (Decision)</option>
                    <option value="text">Text / Annotation</option>
                  </select>
                </div>
              )}

              {/* Fill Color */}
              {selectedNodeData.shape !== 'text' && (
                <div className="props-field-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="props-label">Fill Color</label>
                    <input
                      type="color"
                      value={selectedNodeData.fillColor || '#FFFFFF'}
                      onChange={(e) => updateSelectedNodeData({ fillColor: e.target.value })}
                      style={{ width: '20px', height: '20px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                      title="Custom color picker"
                    />
                  </div>
                  <div className="props-color-swatches">
                    {COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={`color-swatch-btn ${selectedNodeData.fillColor === hex ? 'active' : ''}`}
                        style={{ background: hex }}
                        onClick={() => updateSelectedNodeData({ fillColor: hex })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Border Color & Style */}
              {selectedNodeData.shape !== 'text' && (
                <>
                  <div className="props-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="props-label">Border Color</label>
                      <input
                        type="color"
                        value={selectedNodeData.borderColor || '#6E56CF'}
                        onChange={(e) => updateSelectedNodeData({ borderColor: e.target.value })}
                        style={{ width: '20px', height: '20px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                        title="Custom border color"
                      />
                    </div>
                    <div className="props-color-swatches">
                      {BORDER_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          className={`color-swatch-btn ${selectedNodeData.borderColor === hex ? 'active' : ''}`}
                          style={{ background: hex }}
                          onClick={() => updateSelectedNodeData({ borderColor: hex })}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Border Width & Style */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="props-field-group">
                      <label className="props-label">Width</label>
                      <select
                        className="input-field"
                        value={selectedNodeData.borderWidth ?? 1.5}
                        onChange={(e) => updateSelectedNodeData({ borderWidth: parseFloat(e.target.value) })}
                      >
                        <option value="1">1px (Thin)</option>
                        <option value="1.5">1.5px</option>
                        <option value="2">2px (Medium)</option>
                        <option value="3">3px (Thick)</option>
                      </select>
                    </div>

                    <div className="props-field-group">
                      <label className="props-label">Style</label>
                      <select
                        className="input-field"
                        value={selectedNodeData.borderStyle || 'solid'}
                        onChange={(e) => updateSelectedNodeData({ borderStyle: e.target.value as 'solid' | 'dashed' })}
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Font Size & Weight & Align */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="props-field-group">
                  <label className="props-label">Font Size</label>
                  <select
                    className="input-field"
                    value={selectedNodeData.fontSize || 13}
                    onChange={(e) => updateSelectedNodeData({ fontSize: parseInt(e.target.value, 10) })}
                  >
                    <option value="11">11px</option>
                    <option value="12">12px</option>
                    <option value="13">13px</option>
                    <option value="14">14px</option>
                    <option value="16">16px</option>
                    <option value="18">18px</option>
                  </select>
                </div>

                <div className="props-field-group">
                  <label className="props-label">Weight</label>
                  <div className="toolbar-btn-group">
                    <button
                      type="button"
                      className={`toolbar-icon-btn ${(selectedNodeData.fontWeight || 'normal') === 'normal' ? 'active' : ''}`}
                      onClick={() => updateSelectedNodeData({ fontWeight: 'normal' })}
                      style={{ flex: 1 }}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      className={`toolbar-icon-btn ${selectedNodeData.fontWeight === 'bold' ? 'active' : ''}`}
                      onClick={() => updateSelectedNodeData({ fontWeight: 'bold' })}
                      style={{ flex: 1 }}
                    >
                      <Bold size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Text Alignment */}
              <div className="props-field-group">
                <label className="props-label">Text Alignment</label>
                <div className="toolbar-btn-group">
                  <button
                    type="button"
                    className={`toolbar-icon-btn ${(selectedNodeData.textAlign || 'center') === 'left' ? 'active' : ''}`}
                    onClick={() => updateSelectedNodeData({ textAlign: 'left' })}
                    style={{ flex: 1 }}
                    title="Align Left"
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    className={`toolbar-icon-btn ${(selectedNodeData.textAlign || 'center') === 'center' ? 'active' : ''}`}
                    onClick={() => updateSelectedNodeData({ textAlign: 'center' })}
                    style={{ flex: 1 }}
                    title="Align Center"
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    className={`toolbar-icon-btn ${selectedNodeData.textAlign === 'right' ? 'active' : ''}`}
                    onClick={() => updateSelectedNodeData({ textAlign: 'right' })}
                    style={{ flex: 1 }}
                    title="Align Right"
                  >
                    <AlignRight size={13} />
                  </button>
                </div>
              </div>
            </>
          ) : selectedEdge ? (
            /* Edge Properties Inspector */
            <>
              <div className="props-panel-header">
                <div className="props-panel-title">
                  <Workflow size={16} color="#0284C7" />
                  <span>Connector Properties</span>
                </div>
                <button
                  type="button"
                  className="toolbar-icon-btn"
                  onClick={deleteSelected}
                  style={{ color: '#EF4444' }}
                  title="Delete connector"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Edge Label Input */}
              <div className="props-field-group">
                <label className="props-label">Connector Label</label>
                <input
                  type="text"
                  className="input-field"
                  value={(selectedEdge.label as string) || ''}
                  onChange={(e) => updateSelectedEdge({ label: e.target.value })}
                  placeholder="e.g. Yes, No, Data Stream..."
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {['Yes', 'No', 'Pass', 'Fail', 'API Call'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#F1F5F9' }}
                      onClick={() => updateSelectedEdge({ label: chip })}
                    >
                      +{chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Routing Type */}
              <div className="props-field-group">
                <label className="props-label">Routing Style</label>
                <select
                  className="input-field"
                  value={selectedEdge.type || 'smoothstep'}
                  onChange={(e) => updateSelectedEdge({ type: e.target.value })}
                >
                  <option value="smoothstep">Smoothstep (Orthogonal)</option>
                  <option value="default">Bezier (Curved)</option>
                  <option value="straight">Straight</option>
                  <option value="step">Step</option>
                </select>
              </div>

              {/* Arrow Head */}
              <div className="props-field-group">
                <label className="props-label">Arrowhead</label>
                <select
                  className="input-field"
                  value={selectedEdge.markerEnd ? 'arrow' : 'none'}
                  onChange={(e) => {
                    const hasArrow = e.target.value === 'arrow';
                    updateSelectedEdge({
                      markerEnd: hasArrow
                        ? { type: MarkerType.ArrowClosed, color: (selectedEdge.style?.stroke as string) || '#64748B' }
                        : undefined
                    });
                  }}
                >
                  <option value="arrow">Directional Arrow</option>
                  <option value="none">Plain Line (No Arrow)</option>
                </select>
              </div>

              {/* Stroke Color */}
              <div className="props-field-group">
                <label className="props-label">Line Color</label>
                <div className="props-color-swatches">
                  {BORDER_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`color-swatch-btn ${selectedEdge.style?.stroke === hex ? 'active' : ''}`}
                      style={{ background: hex }}
                      onClick={() => {
                        updateSelectedEdge({
                          style: { ...selectedEdge.style, stroke: hex },
                          markerEnd: selectedEdge.markerEnd
                            ? (typeof selectedEdge.markerEnd === 'object'
                                ? { ...selectedEdge.markerEnd, color: hex }
                                : { type: MarkerType.ArrowClosed, color: hex })
                            : undefined
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Width & Dashed Style */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="props-field-group">
                  <label className="props-label">Thickness</label>
                  <select
                    className="input-field"
                    value={selectedEdge.style?.strokeWidth || 2}
                    onChange={(e) =>
                      updateSelectedEdge({
                        style: { ...selectedEdge.style, strokeWidth: parseInt(e.target.value, 10) }
                      })
                    }
                  >
                    <option value="1">1px (Thin)</option>
                    <option value="2">2px (Normal)</option>
                    <option value="3">3px (Thick)</option>
                  </select>
                </div>

                <div className="props-field-group">
                  <label className="props-label">Pattern</label>
                  <select
                    className="input-field"
                    value={selectedEdge.style?.strokeDasharray ? 'dashed' : 'solid'}
                    onChange={(e) => {
                      const isDashed = e.target.value === 'dashed';
                      updateSelectedEdge({
                        style: {
                          ...selectedEdge.style,
                          strokeDasharray: isDashed ? '5 5' : undefined
                        }
                      });
                    }}
                  >
                    <option value="solid">Solid Line</option>
                    <option value="dashed">Dashed Line</option>
                  </select>
                </div>
              </div>

              {/* Animated Flow Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#111625' }}>Animated Pulse</span>
                <input
                  type="checkbox"
                  checked={!!selectedEdge.animated}
                  onChange={(e) => updateSelectedEdge({ animated: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </div>
            </>
          ) : (
            /* Canvas & Document Properties (When nothing is selected) */
            <>
              <div className="props-panel-header">
                <div className="props-panel-title">
                  <Settings size={16} color="#64748B" />
                  <span>Canvas Overview</span>
                </div>
              </div>

              <div className="props-field-group">
                <label className="props-label">Diagram Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Diagram Title"
                />
              </div>

              <div style={{ background: '#F8FAFD', border: '1px solid #E8ECF5', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Canvas Elements
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#111625', marginBottom: '4px' }}>
                  <span>Total Nodes</span>
                  <strong>{nodes.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#111625' }}>
                  <span>Connections</span>
                  <strong>{edges.length}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F4F9', paddingTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Interactive Instructions
                </div>
                <ul style={{ fontSize: '11.5px', color: '#64748B', paddingLeft: '14px', margin: 0, lineHeight: '1.6' }}>
                  <li>Drag shapes from palette or click to add</li>
                  <li>Click any node/connector to inspect &amp; style</li>
                  <li>Drag resize handles on selected nodes</li>
                  <li>Connect handles for directional flow</li>
                  <li>Press <kbd style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>Del</kbd> to delete selected</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

// Root Exported Component wrapped with ReactFlowProvider
export const ChartsEditorPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <ChartsEditorInner />
    </ReactFlowProvider>
  );
};
