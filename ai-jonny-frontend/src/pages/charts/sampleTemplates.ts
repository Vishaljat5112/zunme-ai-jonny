import { MarkerType } from '@xyflow/react';
import { ChartTemplate } from './types';

export const STARTER_TEMPLATES: ChartTemplate[] = [
  {
    id: 'tpl_microservices',
    title: 'Cloud Microservice Architecture',
    category: 'ARCHITECTURE',
    description: 'High-availability backend topology with API Gateway, AuthService, Payment Engine, and Event Bus.',
    complexity: 'Intermediate',
    nodeCount: 6,
    initialNodes: [
      {
        id: '1',
        type: 'input',
        data: { label: '🌐 Client / Web & Mobile Apps' },
        position: { x: 250, y: 30 }
      },
      {
        id: '2',
        data: { label: '🛡️ API Gateway (Rate Limiter & Auth)' },
        position: { x: 250, y: 130 }
      },
      {
        id: '3',
        data: { label: '⚡ Core Services Cluster' },
        position: { x: 100, y: 240 }
      },
      {
        id: '4',
        data: { label: '💳 Payment & Billing Service' },
        position: { x: 400, y: 240 }
      },
      {
        id: '5',
        data: { label: '📬 Redis Event Queue' },
        position: { x: 250, y: 340 }
      },
      {
        id: '6',
        type: 'output',
        data: { label: '🗄️ Primary MySQL & Analytics DB' },
        position: { x: 250, y: 440 }
      }
    ],
    initialEdges: [
      { id: 'e1-2', source: '1', target: '2', animated: true },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e2-4', source: '2', target: '4' },
      { id: 'e3-5', source: '3', target: '5' },
      { id: 'e4-5', source: '4', target: '5' },
      { id: 'e5-6', source: '5', target: '6', animated: true }
    ]
  },
  {
    id: 'tpl_oauth_flow',
    title: 'OAuth 2.0 & JWT Auth Sequence',
    category: 'SEQUENCE',
    description: 'Standard enterprise token exchange sequence between Browser, Authorization Server, and Resource API.',
    complexity: 'Intermediate',
    nodeCount: 5,
    initialNodes: [
      {
        id: 'auth-1',
        type: 'input',
        data: { label: '👤 User Login Initiation' },
        position: { x: 250, y: 30 }
      },
      {
        id: 'auth-2',
        data: { label: '🔑 Persona Auth Controller' },
        position: { x: 250, y: 140 }
      },
      {
        id: 'auth-3',
        data: { label: '🛡️ Role Verification & JWT Signer' },
        position: { x: 250, y: 250 }
      },
      {
        id: 'auth-4',
        data: { label: '💾 Token Stored in Secure Client Storage' },
        position: { x: 100, y: 360 }
      },
      {
        id: 'auth-5',
        type: 'output',
        data: { label: '✅ Authorized Request Pipeline' },
        position: { x: 400, y: 360 }
      }
    ],
    initialEdges: [
      { id: 'ea1-2', source: 'auth-1', target: 'auth-2' },
      { id: 'ea2-3', source: 'auth-2', target: 'auth-3', animated: true },
      { id: 'ea3-4', source: 'auth-3', target: 'auth-4' },
      { id: 'ea3-5', source: 'auth-3', target: 'auth-5', animated: true }
    ]
  },
  {
    id: 'tpl_etl_pipeline',
    title: 'Data Ingestion & ETL Pipeline',
    category: 'DATA_PIPELINE',
    description: 'End-to-end telemetry ingestion with streaming schema validation, cleansing, and warehouse loading.',
    complexity: 'Advanced',
    nodeCount: 5,
    initialNodes: [
      {
        id: 'etl-1',
        type: 'input',
        data: { label: '📥 Raw Data Ingest (REST & Webhooks)' },
        position: { x: 250, y: 30 }
      },
      {
        id: 'etl-2',
        data: { label: '🧹 Schema Validation & Sanitizer' },
        position: { x: 250, y: 140 }
      },
      {
        id: 'etl-3',
        data: { label: '⚙️ Transform & Normalization Engine' },
        position: { x: 250, y: 250 }
      },
      {
        id: 'etl-4',
        type: 'output',
        data: { label: '📊 EgoLytics BFOV Analytical Storage' },
        position: { x: 120, y: 360 }
      },
      {
        id: 'etl-5',
        type: 'output',
        data: { label: '📈 Real-Time Monitoring Metric Lake' },
        position: { x: 380, y: 360 }
      }
    ],
    initialEdges: [
      { id: 'e-etl1-2', source: 'etl-1', target: 'etl-2' },
      { id: 'e-etl2-3', source: 'etl-2', target: 'etl-3' },
      { id: 'e-etl3-4', source: 'etl-3', target: 'etl-4', animated: true },
      { id: 'e-etl3-5', source: 'etl-3', target: 'etl-5' }
    ]
  },
  {
    id: 'tpl_gtm_funnel',
    title: 'SaaS GTM Conversion Funnel',
    category: 'BUSINESS',
    description: 'Strategic funnel flowchart mapping visitor awareness, product trials, paid upgrades, and retention.',
    complexity: 'Beginner',
    nodeCount: 4,
    initialNodes: [
      {
        id: 'gtm-1',
        type: 'input',
        data: { label: '🎯 Organic & Ads Traffic (Awareness)' },
        position: { x: 250, y: 40 }
      },
      {
        id: 'gtm-2',
        data: { label: '✨ Frictionless Guest Mode Experience' },
        position: { x: 250, y: 150 }
      },
      {
        id: 'gtm-3',
        data: { label: '🚀 Registered User Workspace Activated' },
        position: { x: 250, y: 260 }
      },
      {
        id: 'gtm-4',
        type: 'output',
        data: { label: '👑 Pro Creator & Enterprise Subscription' },
        position: { x: 250, y: 370 }
      }
    ],
    initialEdges: [
      { id: 'e-gtm1-2', source: 'gtm-1', target: 'gtm-2' },
      { id: 'e-gtm2-3', source: 'gtm-2', target: 'gtm-3', animated: true },
      { id: 'e-gtm3-4', source: 'gtm-3', target: 'gtm-4', animated: true }
    ]
  },
  {
    id: 'tpl_flowchart_auth',
    title: 'User Authentication & Decision Flow',
    category: 'FLOWCHART',
    description: 'Practical decision flowchart mapping credentials check, 2FA verification, session generation, and access routing.',
    complexity: 'Beginner',
    nodeCount: 6,
    initialNodes: [
      {
        id: 'fc-1',
        type: 'customShape',
        data: { label: '👤 User Login Attempt', shape: 'rounded-rectangle', fillColor: '#F4F1FD', borderColor: '#6E56CF', borderWidth: 2, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 260, y: 30 }
      },
      {
        id: 'fc-2',
        type: 'customShape',
        data: { label: 'Valid Credentials?', shape: 'diamond', fillColor: '#FEF3E2', borderColor: '#D97706', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 275, y: 150 }
      },
      {
        id: 'fc-3',
        type: 'customShape',
        data: { label: '2FA Enabled?', shape: 'diamond', fillColor: '#FEF3E2', borderColor: '#D97706', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 275, y: 280 }
      },
      {
        id: 'fc-4',
        type: 'customShape',
        data: { label: '❌ Show Error & Lockout Counter', shape: 'rectangle', fillColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1.5, textAlign: 'center' },
        position: { x: 50, y: 150 }
      },
      {
        id: 'fc-5',
        type: 'customShape',
        data: { label: '📱 Verify OTP Authenticator', shape: 'rectangle', fillColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1.5, textAlign: 'center' },
        position: { x: 480, y: 280 }
      },
      {
        id: 'fc-6',
        type: 'customShape',
        data: { label: '✅ Grant Session & Redirect', shape: 'rounded-rectangle', fillColor: '#E8F8F0', borderColor: '#059669', borderWidth: 2, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 260, y: 420 }
      }
    ],
    initialEdges: [
      { id: 'efc-1-2', source: 'fc-1', target: 'fc-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' }, style: { stroke: '#64748B', strokeWidth: 2 } },
      { id: 'efc-2-4', source: 'fc-2', target: 'fc-4', label: 'No', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#EF4444' }, style: { stroke: '#EF4444', strokeWidth: 2 } },
      { id: 'efc-2-3', source: 'fc-2', target: 'fc-3', label: 'Yes', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' }, style: { stroke: '#059669', strokeWidth: 2 } },
      { id: 'efc-3-5', source: 'fc-3', target: 'fc-5', label: 'Yes', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' }, style: { stroke: '#3B82F6', strokeWidth: 2 } },
      { id: 'efc-3-6', source: 'fc-3', target: 'fc-6', label: 'No', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' }, style: { stroke: '#059669', strokeWidth: 2 } },
      { id: 'efc-5-6', source: 'fc-5', target: 'fc-6', label: 'Verified', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' }, style: { stroke: '#059669', strokeWidth: 2 } }
    ]
  },
  {
    id: 'tpl_mindmap_roadmap',
    title: 'Strategic Product & AI Mind Map',
    category: 'MINDMAP',
    description: 'Radial strategy mind map linking core product vision to Autonomous Agents, EgoLytics BFOV Canvas, and Enterprise Security.',
    complexity: 'Beginner',
    nodeCount: 5,
    initialNodes: [
      {
        id: 'mm-root',
        type: 'customShape',
        data: { label: '🧠 2026 Core Vision & Platform', shape: 'rounded-rectangle', fillColor: '#F4F1FD', borderColor: '#6E56CF', borderWidth: 2, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 300, y: 200 }
      },
      {
        id: 'mm-node-1',
        type: 'customShape',
        data: { label: '⚡ Autonomous Agent Engine', shape: 'rectangle', fillColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 80, y: 80 }
      },
      {
        id: 'mm-node-2',
        type: 'customShape',
        data: { label: '🎨 EgoLytics BFOV Canvas', shape: 'rectangle', fillColor: '#FAF5FF', borderColor: '#8B5CF6', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 520, y: 80 }
      },
      {
        id: 'mm-node-3',
        type: 'customShape',
        data: { label: '🛡️ Enterprise RBAC & Security', shape: 'rectangle', fillColor: '#FEF3E2', borderColor: '#D97706', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 80, y: 320 }
      },
      {
        id: 'mm-node-4',
        type: 'customShape',
        data: { label: '📈 Analytics & Telemetry Lake', shape: 'rectangle', fillColor: '#E8F8F0', borderColor: '#059669', borderWidth: 1.5, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 520, y: 320 }
      }
    ],
    initialEdges: [
      { id: 'emm-r-1', source: 'mm-root', target: 'mm-node-1', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' }, style: { stroke: '#3B82F6', strokeWidth: 2 } },
      { id: 'emm-r-2', source: 'mm-root', target: 'mm-node-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8B5CF6' }, style: { stroke: '#8B5CF6', strokeWidth: 2 } },
      { id: 'emm-r-3', source: 'mm-root', target: 'mm-node-3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#D97706' }, style: { stroke: '#D97706', strokeWidth: 2 } },
      { id: 'emm-r-4', source: 'mm-root', target: 'mm-node-4', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' }, style: { stroke: '#059669', strokeWidth: 2 } }
    ]
  },
  {
    id: 'tpl_biz_fulfillment',
    title: 'Order Fulfillment & Supply Chain Process',
    category: 'BUSINESS',
    description: 'Enterprise business workflow from checkout authorization and inventory reservation to warehouse fulfillment and tracking.',
    complexity: 'Intermediate',
    nodeCount: 5,
    initialNodes: [
      {
        id: 'biz-1',
        type: 'customShape',
        data: { label: '🛒 Customer Order Placed', shape: 'rounded-rectangle', fillColor: '#F4F1FD', borderColor: '#6E56CF', borderWidth: 2, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 260, y: 30 }
      },
      {
        id: 'biz-2',
        type: 'customShape',
        data: { label: '📦 Inventory Reservation Check', shape: 'rectangle', fillColor: '#FFFFFF', borderColor: '#0284C7', borderWidth: 1.5, textAlign: 'center' },
        position: { x: 260, y: 140 }
      },
      {
        id: 'biz-3',
        type: 'customShape',
        data: { label: '💳 Payment Gateway Settlement', shape: 'rectangle', fillColor: '#FEF3E2', borderColor: '#D97706', borderWidth: 1.5, textAlign: 'center' },
        position: { x: 260, y: 250 }
      },
      {
        id: 'biz-4',
        type: 'customShape',
        data: { label: '🏭 Warehouse Packing & Quality QA', shape: 'rectangle', fillColor: '#FFFFFF', borderColor: '#6E56CF', borderWidth: 1.5, textAlign: 'center' },
        position: { x: 260, y: 360 }
      },
      {
        id: 'biz-5',
        type: 'customShape',
        data: { label: '🚚 Carrier Dispatch & Tracking Live', shape: 'rounded-rectangle', fillColor: '#E8F8F0', borderColor: '#059669', borderWidth: 2, fontWeight: 'bold', textAlign: 'center' },
        position: { x: 260, y: 470 }
      }
    ],
    initialEdges: [
      { id: 'ebiz-1-2', source: 'biz-1', target: 'biz-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' }, style: { stroke: '#64748B', strokeWidth: 2 } },
      { id: 'ebiz-2-3', source: 'biz-2', target: 'biz-3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' }, style: { stroke: '#64748B', strokeWidth: 2 } },
      { id: 'ebiz-3-4', source: 'biz-3', target: 'biz-4', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' }, style: { stroke: '#6E56CF', strokeWidth: 2 } },
      { id: 'ebiz-4-5', source: 'biz-4', target: 'biz-5', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' }, style: { stroke: '#059669', strokeWidth: 2 } }
    ]
  },
  {
    id: 'tpl_corp_hierarchy',
    title: 'Corporate Hierarchy',
    category: 'ORGANIZATION',
    description: 'Executive leadership framework mapping CEO, CTO, VP Product, VP Revenue, Engineering Director, and Lead Designer.',
    complexity: 'Intermediate',
    nodeCount: 6,
    initialNodes: [
      {
        id: 'corp-1',
        type: 'orgPerson',
        position: { x: 300, y: 30 },
        data: {
          label: 'Chief Executive Officer',
          personName: 'Sarah Connor',
          personRole: 'Chief Executive Officer',
          department: 'Executive Leadership',
          fillColor: '#FFFFFF',
          borderColor: '#6E56CF'
        }
      },
      {
        id: 'corp-2',
        type: 'orgPerson',
        position: { x: 80, y: 170 },
        data: {
          label: 'Chief Technology Officer',
          personName: 'Elena Rostova',
          personRole: 'Chief Technology Officer',
          department: 'Technology',
          fillColor: '#FFFFFF',
          borderColor: '#0284C7'
        }
      },
      {
        id: 'corp-3',
        type: 'orgPerson',
        position: { x: 300, y: 170 },
        data: {
          label: 'VP of Product',
          personName: 'Marcus Vance',
          personRole: 'VP of Product Management',
          department: 'Product',
          fillColor: '#FFFFFF',
          borderColor: '#8B5CF6'
        }
      },
      {
        id: 'corp-4',
        type: 'orgPerson',
        position: { x: 520, y: 170 },
        data: {
          label: 'VP Worldwide Sales',
          personName: 'Rachel Green',
          personRole: 'VP Worldwide Revenue',
          department: 'Revenue & Growth',
          fillColor: '#FFFFFF',
          borderColor: '#059669'
        }
      },
      {
        id: 'corp-5',
        type: 'orgPerson',
        position: { x: 80, y: 310 },
        data: {
          label: 'Director of Engineering',
          personName: 'David Kim',
          personRole: 'Engineering Director',
          department: 'Technology',
          fillColor: '#FFFFFF',
          borderColor: '#0284C7'
        }
      },
      {
        id: 'corp-6',
        type: 'orgPerson',
        position: { x: 300, y: 310 },
        data: {
          label: 'Principal Product Designer',
          personName: 'Maya Lin',
          personRole: 'Lead Product Designer',
          department: 'Product',
          fillColor: '#FFFFFF',
          borderColor: '#8B5CF6'
        }
      }
    ],
    initialEdges: [
      { id: 'e-corp-1-2', source: 'corp-1', target: 'corp-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-corp-1-3', source: 'corp-1', target: 'corp-3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-corp-1-4', source: 'corp-1', target: 'corp-4', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-corp-2-5', source: 'corp-2', target: 'corp-5', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0284C7' } },
      { id: 'e-corp-3-6', source: 'corp-3', target: 'corp-6', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8B5CF6' } }
    ]
  },
  {
    id: 'tpl_small_biz_team',
    title: 'Small Business Team',
    category: 'ORGANIZATION',
    description: 'Flat, agile organizational model connecting Founder/CEO with Business Operations, Lead Developer, and Growth.',
    complexity: 'Beginner',
    nodeCount: 4,
    initialNodes: [
      {
        id: 'sb-1',
        type: 'orgPerson',
        position: { x: 260, y: 30 },
        data: {
          label: 'Founder & CEO',
          personName: 'Liam Walker',
          personRole: 'Founder & CEO',
          department: 'Executive',
          fillColor: '#FFFFFF',
          borderColor: '#6E56CF'
        }
      },
      {
        id: 'sb-2',
        type: 'orgPerson',
        position: { x: 40, y: 170 },
        data: {
          label: 'Head of Operations',
          personName: 'Chloe Martin',
          personRole: 'Operations Lead',
          department: 'Operations',
          fillColor: '#FFFFFF',
          borderColor: '#D97706'
        }
      },
      {
        id: 'sb-3',
        type: 'orgPerson',
        position: { x: 260, y: 170 },
        data: {
          label: 'Lead Full-Stack Developer',
          personName: 'Noah Miller',
          personRole: 'Lead Engineer',
          department: 'Engineering',
          fillColor: '#FFFFFF',
          borderColor: '#0284C7'
        }
      },
      {
        id: 'sb-4',
        type: 'orgPerson',
        position: { x: 480, y: 170 },
        data: {
          label: 'Growth & Marketing Lead',
          personName: 'Sophia Lee',
          personRole: 'Growth Strategist',
          department: 'Marketing',
          fillColor: '#FFFFFF',
          borderColor: '#059669'
        }
      }
    ],
    initialEdges: [
      { id: 'e-sb-1-2', source: 'sb-1', target: 'sb-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-sb-1-3', source: 'sb-1', target: 'sb-3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-sb-1-4', source: 'sb-1', target: 'sb-4', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } }
    ]
  },
  {
    id: 'tpl_dept_engineering',
    title: 'Department Structure',
    category: 'ORGANIZATION',
    description: 'Detailed divisional hierarchy showing VP Engineering, AI Research, Staff Frontend, and Cloud Reliability teams.',
    complexity: 'Advanced',
    nodeCount: 6,
    initialNodes: [
      {
        id: 'dept-1',
        type: 'orgPerson',
        position: { x: 280, y: 30 },
        data: {
          label: 'VP of Engineering',
          personName: 'Dr. Aris Thorne',
          personRole: 'VP of Engineering',
          department: 'Engineering Leadership',
          fillColor: '#FFFFFF',
          borderColor: '#6E56CF'
        }
      },
      {
        id: 'dept-2',
        type: 'orgPerson',
        position: { x: 60, y: 170 },
        data: {
          label: 'Staff AI Architect',
          personName: 'Priya Patel',
          personRole: 'Staff AI Architect',
          department: 'AI Systems',
          fillColor: '#FFFFFF',
          borderColor: '#7C3AED'
        }
      },
      {
        id: 'dept-3',
        type: 'orgPerson',
        position: { x: 280, y: 170 },
        data: {
          label: 'Frontend Lead',
          personName: 'Lucas Silva',
          personRole: 'Frontend Team Lead',
          department: 'Frontend Engineering',
          fillColor: '#FFFFFF',
          borderColor: '#0284C7'
        }
      },
      {
        id: 'dept-4',
        type: 'orgPerson',
        position: { x: 500, y: 170 },
        data: {
          label: 'Cloud & DevOps Lead',
          personName: 'Jordan Chen',
          personRole: 'Principal SRE',
          department: 'Infrastructure',
          fillColor: '#FFFFFF',
          borderColor: '#059669'
        }
      },
      {
        id: 'dept-5',
        type: 'orgPerson',
        position: { x: 280, y: 310 },
        data: {
          label: 'Senior UI Engineer',
          personName: 'Elena Torres',
          personRole: 'Senior Frontend Dev',
          department: 'Frontend Engineering',
          fillColor: '#FFFFFF',
          borderColor: '#0284C7'
        }
      },
      {
        id: 'dept-6',
        type: 'orgPerson',
        position: { x: 500, y: 310 },
        data: {
          label: 'Site Reliability Engineer',
          personName: 'Sam Rivera',
          personRole: 'SRE Specialist',
          department: 'Infrastructure',
          fillColor: '#FFFFFF',
          borderColor: '#059669'
        }
      }
    ],
    initialEdges: [
      { id: 'e-dept-1-2', source: 'dept-1', target: 'dept-2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-dept-1-3', source: 'dept-1', target: 'dept-3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-dept-1-4', source: 'dept-1', target: 'dept-4', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#6E56CF' } },
      { id: 'e-dept-3-5', source: 'dept-3', target: 'dept-5', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0284C7' } },
      { id: 'e-dept-4-6', source: 'dept-4', target: 'dept-6', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' } }
    ]
  }
];
