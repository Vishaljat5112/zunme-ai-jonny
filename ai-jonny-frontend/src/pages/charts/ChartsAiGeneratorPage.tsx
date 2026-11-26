import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Bot,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Copy,
  Check,
  Workflow,
  RotateCw,
  Eye,
  Code,
  Users,
  Compass,
  GitBranch
} from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChartsNavHeader } from './ChartsNavHeader';
import { aiService } from '../../services/aiService';
import { apiClient, ModelInfo } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import { CustomShapeNode, OrgPersonNode } from './CustomNodes';
import {
  getDiagramSystemPrompt,
  parseAndValidateChartSpec,
  ParsedDiagramResult
} from './aiDiagramParser';
import './ChartsPage.css';

const nodeTypes = {
  customShape: CustomShapeNode,
  orgPerson: OrgPersonNode
};

interface ExamplePrompt {
  id: string;
  category: string;
  badge: string;
  title: string;
  prompt: string;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'ex_org',
    category: 'ORGANIZATION',
    badge: 'Org Chart',
    title: '🏢 Executive Leadership Structure',
    prompt: 'Create an executive organization chart for a high-growth tech startup: CEO Sarah Connor manages CTO Elena Rostova, VP Product Marcus Vance, and VP Revenue Rachel Green. Elena manages Engineering Director David Kim. Marcus manages Lead Designer Maya Lin.'
  },
  {
    id: 'ex_flow',
    category: 'FLOWCHART',
    badge: 'Flowchart',
    title: '⚡ User Authentication & 2FA Flow',
    prompt: 'Design a secure user login flow: User submits credentials, system validates password in database. If invalid, return 401 Unauthorized. If valid, check if 2FA is enabled. If 2FA enabled, request SMS/Authenticator OTP code. If OTP valid or 2FA disabled, issue JWT session token and redirect to dashboard.'
  },
  {
    id: 'ex_mindmap',
    category: 'MINDMAP',
    badge: 'Mind Map',
    title: '🧠 2026 AI Product Roadmap',
    prompt: 'Generate an AI product strategy mind map with central theme "2026 Autonomous AI Studio". Core branches include: Multimodal Vision Engine, Code Synthesis & Git Workflows, Agent Collaboration Hub, and Enterprise Compliance & Security.'
  },
  {
    id: 'ex_business',
    category: 'FLOWCHART',
    badge: 'Business',
    title: '🔄 E-Commerce Order Fulfillment',
    prompt: 'Map an e-commerce order processing pipeline: Customer places order, payment gateway authorizes transaction, inventory check in Redis cache, order record created in MySQL database, fulfillment service packages items, and carrier tracking webhook sent to customer email.'
  }
];

export const ChartsAiGeneratorPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, user } = useApp();

  const [prompt, setPrompt] = useState('');
  const [tabularData, setTabularData] = useState('');
  const [chartType, setChartType] = useState('FLOWCHART');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemma3:4b');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedDiagramResult | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
  const [copied, setCopied] = useState(false);
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check module status
    apiClient.getChartsStatus()
      .then((res) => {
        if (res.success && typeof res.enabled === 'boolean') {
          if (!res.enabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
            setIsModuleDisabled(true);
          }
        }
      })
      .catch(() => {});

    aiService.getAvailableModels().then((mList) => {
      if (mList && mList.length > 0) {
        setModels(mList);
        setSelectedModel(mList[0].id);
      }
    });
  }, [user]);

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationError('AI diagram generation was cancelled.');
    showToast('Cancelled generation', 'info');
  };

  const handleSelectExample = (ex: ExamplePrompt) => {
    setPrompt(ex.prompt);
    setChartType(ex.category);
    setGenerationError(null);
  };

  const executeGeneration = useCallback(
    async (targetPrompt: string, targetCategory: string) => {
      if (isModuleDisabled) {
        showToast('EgoLytics BFOV Charts module is currently disabled by administrator', 'error');
        return;
      }

      if (!targetPrompt.trim()) {
        showToast('Please enter a description for the diagram', 'error');
        return;
      }

      setIsGenerating(true);
      setGenerationError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const timeoutId = setTimeout(() => {
        abortController.abort(new Error('AI generation timed out after 60s. The remote model is busy loading weights.'));
      }, 60000);

      const systemPrompt = getDiagramSystemPrompt(targetCategory);
      let userPrompt = `Generate a ${targetCategory} diagram for the following specification:\n${targetPrompt.trim()}`;
      if (tabularData.trim()) {
        userPrompt += `\n\n[CONTEXT / TABULAR DATA]:\n${tabularData.trim()}`;
      }

      try {
        let rawContent = '';
        let lastError: Error | null = null;
        let parsedResult: ParsedDiagramResult | null = null;

        // Attempt 1: Standard structured generation
        try {
          const res = await aiService.generateCompletion(userPrompt, {
            systemPrompt,
            model: selectedModel,
            temperature: 0.2,
            context: 'CHART',
            signal: abortController.signal
          });

          if (res && res.content && res.content.trim()) {
            rawContent = res.content;
            parsedResult = parseAndValidateChartSpec(rawContent, targetCategory);
          } else {
            throw new Error('AI provider returned an empty response.');
          }
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const isAbortedOrTimedOut =
            lastError.name === 'AbortError' ||
            lastError.message.includes('timed out') ||
            lastError.message.includes('aborted') ||
            lastError.message.includes('cancelled');

          if (isAbortedOrTimedOut) {
            throw lastError;
          }

          // Attempt 2: Bounded retry ONLY on format/syntax errors (never on timeouts or cancels)
          const retryPrompt = `${userPrompt}\n\n[RETRY CORRECTION]: Your previous response could not be parsed: ${lastError.message}. You MUST return ONLY a raw JSON object with keys "title", "diagramMode", "nodes", and "edges". Do not include markdown code blocks, conversational greetings, or trailing commentary.`;

          const retryRes = await aiService.generateCompletion(retryPrompt, {
            systemPrompt,
            model: selectedModel,
            temperature: 0.1,
            context: 'CHART',
            signal: abortController.signal
          });

          if (retryRes && retryRes.content && retryRes.content.trim()) {
            rawContent = retryRes.content;
            parsedResult = parseAndValidateChartSpec(rawContent, targetCategory);
          } else {
            throw lastError || new Error('AI provider retry returned empty output.');
          }
        }

        if (parsedResult && parsedResult.nodes.length > 0) {
          setResult(parsedResult);
          showToast(
            `Synthesized ${parsedResult.diagramMode} with ${parsedResult.nodes.length} nodes & ${parsedResult.edges.length} connections!`,
            'success'
          );
        } else {
          throw new Error('AI synthesis did not yield valid diagram elements.');
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        let errorMsg = err instanceof Error ? err.message : 'AI diagram synthesis failed.';
        if (err.name === 'AbortError' || errorMsg.includes('timed out')) {
          errorMsg = 'AI inference timed out (60s). The Ollama VPS model is under heavy load or swapping weights. Please retry with a shorter prompt or try again.';
        }
        setGenerationError(errorMsg);
        showToast(errorMsg, 'error');
      } finally {
        clearTimeout(timeoutId);
        abortControllerRef.current = null;
        setIsGenerating(false);
      }
    },
    [isModuleDisabled, tabularData, selectedModel, showToast]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeGeneration(prompt, chartType);
  };

  const handleCopySpec = () => {
    if (!result?.rawJson) return;
    navigator.clipboard.writeText(result.rawJson);
    setCopied(true);
    showToast('Copied JSON specification to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInEditor = () => {
    if (!result) return;
    // Store in session for editor hydration
    sessionStorage.setItem(
      'zunme_ai_generated_chart',
      JSON.stringify({
        title: result.title,
        diagramMode: result.diagramMode,
        nodes: result.nodes,
        edges: result.edges
      })
    );
    navigate('/user/charts/editor?source=ai');
  };

  return (
    <div className="charts-module-container">
      <ChartsNavHeader activeTab="ai-generator" />

      {/* Module Availability Warning Banner */}
      {isModuleDisabled && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#991B1B'
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span style={{ fontSize: '13px', fontWeight: '600' }}>
            EgoLytics BFOV Charts module is currently disabled by administrator. AI diagram generation is restricted.
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 440px) 1fr',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Left Input & Prompt Controls Panel */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8ECF5',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={20} color="#6E56CF" />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#111625' }}>
              AI Diagram Synthesizer
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#5F6B85', margin: '0 0 16px', lineHeight: '1.4' }}>
            Transform natural language prompts into live visual flowcharts, organizational hierarchies, and mind maps using your local Ollama engine.
          </p>

          {/* Quick Example Prompt Pills */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Templates / Prompts
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectExample(ex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #E8ECF5',
                    background: '#FAFBFD',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6E56CF';
                    e.currentTarget.style.background = '#F4F1FD';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E8ECF5';
                    e.currentTarget.style.background = '#FAFBFD';
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B' }}>
                    {ex.title}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: ex.category === 'ORGANIZATION' ? '#EFEBFC' : '#E0F2FE',
                      color: ex.category === 'ORGANIZATION' ? '#6E56CF' : '#0284C7'
                    }}
                  >
                    {ex.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Diagram Category Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Diagram Category
              </label>
              <select
                className="input-field"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              >
                <option value="FLOWCHART">Decision & Process Flowchart</option>
                <option value="ORGANIZATION">Organizational Hierarchy & Teams</option>
                <option value="MINDMAP">Mind Map & Concept Roadmap</option>
                <option value="ARCHITECTURE">System & Cloud Architecture</option>
              </select>
            </div>

            {/* AI Model Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Active AI Engine
              </label>
              <select
                className="input-field"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              >
                {models.length > 0 ? (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))
                ) : (
                  <option value="gemma3:4b">Gemma 3 (4B) 🌟 [Default]</option>
                )}
              </select>
            </div>

            {/* Natural-Language Prompt Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                System / Hierarchy Description
              </label>
              <textarea
                className="input-field"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Design an organizational chart with CEO managing CTO, VP Product, and Director of Sales..."
                style={{ width: '100%', padding: '10px 12px', lineHeight: '1.45', resize: 'vertical', fontSize: '12.5px' }}
                required
              />
            </div>

            {/* Optional Tabular Context */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                <span>Optional Reference Data / CSV</span>
                <span style={{ fontSize: '11px', color: '#8C97B0', fontWeight: '500' }}>Optional</span>
              </label>
              <textarea
                className="input-field"
                rows={2}
                value={tabularData}
                onChange={(e) => setTabularData(e.target.value)}
                placeholder="Optional team member list, steps, or CSV data"
                style={{ width: '100%', padding: '8px 12px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>

            {/* Error Message if Generation Failed */}
            {generationError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '700' }}>Synthesis Failed</div>
                  <div style={{ marginTop: '2px', lineHeight: '1.35' }}>{generationError}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isGenerating || isModuleDisabled || !prompt.trim()}
                style={{ flex: 1, padding: '10px', justifyContent: 'center', borderRadius: '10px', fontWeight: '700' }}
              >
                <Sparkles size={15} />
                <span>{isGenerating ? 'Synthesizing Diagram...' : 'Generate with AI'}</span>
              </button>

              {isGenerating && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCancelGeneration}
                  style={{ color: '#EF4444', borderColor: '#FCA5A5', padding: '10px 14px', borderRadius: '10px', fontWeight: '600' }}
                  title="Cancel active inference"
                >
                  Cancel
                </button>
              )}

              {result && !isGenerating && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => executeGeneration(prompt, chartType)}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #E8ECF5' }}
                  title="Regenerate with same prompt"
                >
                  <RotateCw size={15} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Output & Interactive Preview Panel */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8ECF5',
            borderRadius: '16px',
            padding: '24px',
            minHeight: '620px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}
        >
          {/* Output Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '14px',
              borderBottom: '1px solid #E8ECF5'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Workflow size={20} color="#6E56CF" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#111625' }}>
                  {result ? result.title : 'Generated Diagram Preview'}
                </h3>
                {result && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '1px 7px',
                        borderRadius: '4px',
                        background: '#EFEBFC',
                        color: '#6E56CF'
                      }}
                    >
                      {result.diagramMode.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#64748B'
                      }}
                    >
                      {result.nodes.length} nodes • {result.edges.length} connections
                    </span>
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* View Mode Toggle: Preview vs JSON */}
                <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    style={{
                      border: 'none',
                      background: activeTab === 'preview' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'preview' ? '#1E293B' : '#64748B',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={13} />
                    <span>Visual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('json')}
                    style={{
                      border: 'none',
                      background: activeTab === 'json' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'json' ? '#1E293B' : '#64748B',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Code size={13} />
                    <span>JSON</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopySpec}
                  style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #E8ECF5' }}
                >
                  {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm open-canvas-btn"
                  onClick={handleOpenInEditor}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '700' }}
                >
                  <Workflow size={14} />
                  <span>Open in Canvas</span>
                </button>
              </div>
            )}
          </div>

          {/* Body Content */}
          {isGenerating ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                gap: '14px',
                padding: '48px 16px'
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #E2E8F0',
                  borderTopColor: '#6E56CF',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>
                  Synthesizing Graph Topology...
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  Validating node constraints, connections, and Dagre auto-layout coordinates
                </div>
              </div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'preview' ? (
                /* Visual React Flow Canvas Preview */
                <div
                  className="ai-diagram-preview-canvas"
                  style={{
                    flex: 1,
                    minHeight: '480px',
                    borderRadius: '12px',
                    border: '1px solid #E8ECF5',
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#FAFBFD'
                  }}
                >
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={result.nodes}
                      edges={result.edges}
                      nodeTypes={nodeTypes}
                      fitView
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      panOnDrag={true}
                      zoomOnScroll={true}
                    >
                      <Controls showInteractive={false} position="bottom-left" />
                      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#CBD5E1" />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
              ) : (
                /* Formatted JSON Preview */
                <pre
                  style={{
                    flex: 1,
                    background: '#FAFBFD',
                    border: '1px solid #E8ECF5',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflowY: 'auto',
                    maxHeight: '480px',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}
                >
                  {result.rawJson}
                </pre>
              )}

              {/* Status footer */}
              <div
                style={{
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#059669',
                  background: '#F0FDF4',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #DCFCE7'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} />
                  <span>Valid structured topology synthesized by local engine ({selectedModel})</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenInEditor}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#059669',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Edit in canvas</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8C97B0',
                textAlign: 'center',
                padding: '48px 16px'
              }}
            >
              <Bot size={44} color="#CBD5E1" style={{ marginBottom: '14px' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                No Diagram Generated Yet
              </div>
              <div style={{ fontSize: '13px', maxWidth: '340px', lineHeight: '1.45', color: '#64748B' }}>
                Select an example prompt on the left or type your custom system requirements, then click "Generate with AI".
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ChartsAiGeneratorPage;
