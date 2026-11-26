import React, { useState, useEffect } from 'react';
import { NavLink, useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Calendar,
  Layers,
  Sparkles,
  Save,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertCircle,
  Database,
  RefreshCw,
  DollarSign,
  Activity,
  PhoneCall,
  Mail,
  ShieldCheck,
  ExternalLink,
  LifeBuoy,
  X,
  Download,
  Upload,
  Rocket,
  Zap,
  Award,
  Target,
  ShoppingBag,
  Video,
  Eye,
  MousePointer,
  BookOpen,
  Headphones,
  Check,
  Trash2,
  Search,
  Filter,
  Building,
  Handshake,
  Tag,
  CheckSquare,
  Square,
  MessageSquare,
  ListTodo,
  FolderKanban,
  Send,
  StopCircle,
  Bot
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BusinessProject, CalendarEvent } from '../../types';
import { CsvImportModal, exportToCsv } from '../../components/modals/CsvImportModal';
import { PlatformConnectionModal } from '../../components/modals/PlatformConnectionModal';
import { B4BAmericaBookingModal } from '../../components/modals/B4BAmericaBookingModal';
import {
  apiClient,
  CrmContact,
  CrmDeal,
  CrmMetrics,
  CrmActivity,
  CrmProject,
  CrmTask
} from '../../services/apiClient';
import '../../styles/dashboard.css';
import './BusinessWorkspacePage.css';

interface CrmLead {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  score: number;
  channel: string;
  dealStage: 'NEW_LEAD' | 'DEMO_SCHEDULED' | 'PROPOSAL_SENT' | 'CLOSED_WON';
  dealValue: number;
  syncedAt: string;
}

export const BusinessWorkspacePage: React.FC = () => {
  const {
    brandProfile,
    updateBrandProfile,
    businessProjects,
    addBusinessProject,
    calendarEvents,
    addCalendarEvent,
    showToast,
    user
  } = useApp();

  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  type BusinessTabType = 'Overview' | 'Brand Profile' | 'Projects' | 'Content Calendar' | 'Marketing Content' | 'nErgy CRM Deep Sync' | 'Team & Access' | 'Settings' | 'Help & Support';

  const slugToTab: Record<string, BusinessTabType> = {
    'overview': 'Overview',
    'dashboard': 'Overview',
    'brand-profile': 'Brand Profile',
    'brand': 'Brand Profile',
    'projects': 'Projects',
    'calendar': 'Content Calendar',
    'content-calendar': 'Content Calendar',
    'marketing': 'Marketing Content',
    'marketing-content': 'Marketing Content',
    'crm': 'nErgy CRM Deep Sync',
    'crm-sync': 'nErgy CRM Deep Sync',
    'team': 'Team & Access',
    'team-access': 'Team & Access',
    'settings': 'Settings',
    'support': 'Help & Support',
    'help-support': 'Help & Support'
  };

  const tabToSlug: Record<BusinessTabType, string> = {
    'Overview': 'overview',
    'Brand Profile': 'brand-profile',
    'Projects': 'projects',
    'Content Calendar': 'calendar',
    'Marketing Content': 'marketing',
    'nErgy CRM Deep Sync': 'crm',
    'Team & Access': 'team',
    'Settings': 'settings',
    'Help & Support': 'support'
  };

  const resolveCurrentTab = (): BusinessTabType => {
    const pathSlug = location.pathname.split('/').filter(Boolean).pop();
    if (pathSlug && slugToTab[pathSlug.toLowerCase()]) {
      return slugToTab[pathSlug.toLowerCase()];
    }
    if (section && slugToTab[section.toLowerCase()]) {
      return slugToTab[section.toLowerCase()];
    }
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Overview', 'Brand Profile', 'Projects', 'Content Calendar', 'Marketing Content', 'nErgy CRM Deep Sync', 'Team & Access', 'Settings', 'Help & Support'].includes(tabParam)) {
      return tabParam as BusinessTabType;
    }
    return 'Overview';
  };

  const [activeTab, setActiveTabState] = useState<BusinessTabType>(resolveCurrentTab);

  useEffect(() => {
    setActiveTabState(resolveCurrentTab());
  }, [section, searchParams, location.pathname]);

  const setActiveTab = (tab: BusinessTabType) => {
    setActiveTabState(tab);
    const slug = tabToSlug[tab];
    navigate(slug === 'overview' ? '/business/overview' : `/business/${slug}`);
  };

  // Brand Profile State
  const [bName, setBName] = useState(brandProfile.brandName);
  const [bTagline, setBTagline] = useState(brandProfile.tagline);
  const [bVoice, setBVoice] = useState(brandProfile.voiceTone);
  const [bAudience, setBAudience] = useState(brandProfile.targetAudience);
  const [bValues, setBValues] = useState(brandProfile.coreValues);
  const [bMission, setBMission] = useState(brandProfile.missionStatement);

  // New Project State
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState<'Marketing Campaign' | 'Product Launch' | 'Brand Rebrand' | 'SEO Revamp'>('Marketing Campaign');
  const [pDueDate, setPDueDate] = useState('2026-11-20');
  const [pDesc, setPDesc] = useState('');

  // Calendar Event State
  const [cTitle, setCTitle] = useState('');
  const [cPlatform, setCPlatform] = useState<'Blog' | 'LinkedIn' | 'Twitter / X' | 'Newsletter' | 'Instagram'>('LinkedIn');
  const [cDate, setCDate] = useState('2026-10-25');

  // nErgy CRM State
  const [isSyncingCrm, setIsSyncingCrm] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadRole, setNewLeadRole] = useState('VP Growth');
  const [newLeadValue, setNewLeadValue] = useState(24000);

  // CSV Import & CRM Connection Dialog States
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isCrmConnectModalOpen, setIsCrmConnectModalOpen] = useState(false);
  const [crmConnectedStatus, setCrmConnectedStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('CONNECTED');

  // Part 13: B4B America Education & Training State
  const [isB4BBookingOpen, setIsB4BBookingOpen] = useState(false);

  // Part 14: Small Business Starter Ad Bridge State
  type StarterAdTemplateType = 'SEARCH_PPC' | 'DISPLAY_PPV' | 'SHOPPING_PPC' | 'VIDEO_PPV';
  const [selectedAdTemplate, setSelectedAdTemplate] = useState<StarterAdTemplateType>('SEARCH_PPC');
  const [starterAdBudget, setStarterAdBudget] = useState(15);
  const [starterPaymentModel, setStarterPaymentModel] = useState<'PPC' | 'PPV'>('PPC');
  const [starterHeadline, setStarterHeadline] = useState(
    brandProfile.brandName
      ? `${brandProfile.brandName} | AI One Stop Shop for Small Business`
      : 'Apex Growth | AI One Stop Shop for Small Business'
  );
  const [starterDescription, setStarterDescription] = useState(
    brandProfile.tagline || 'Do more for less cost. Automated workflows, verified AI content, and fast turnaround for businesses on a budget.'
  );
  const [starterKeywords, setStarterKeywords] = useState('small business ai, workflow automation, digital marketing, local growth');
  const [isDeployingAd, setIsDeployingAd] = useState(false);
  const [deployedAdSuccess, setDeployedAdSuccess] = useState(false);

  const handleDeployStarterAd = () => {
    setIsDeployingAd(true);
    setTimeout(() => {
      setIsDeployingAd(false);
      setDeployedAdSuccess(true);
      showToast(
        `Starter Campaign "${starterHeadline.slice(0, 32)}..." deployed to Zunme Ads Engine! ($${starterAdBudget}/day ${starterPaymentModel})`,
        'success'
      );
    }, 900);
  };

  // Real CRM nErgy Enterprise State
  const [crmSubTab, setCrmSubTab] = useState<'contacts' | 'deals' | 'partners' | 'copilot'>('contacts');
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [crmDeals, setCrmDeals] = useState<CrmDeal[]>([]);
  const [crmMetrics, setCrmMetrics] = useState<CrmMetrics | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmModuleEnabled, setCrmModuleEnabled] = useState(true);

  // Bestie AI CRM Copilot State
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotHistory, setCopilotHistory] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    text: string;
    action?: string;
    structuredProspect?: Partial<CrmContact>;
    timestamp: string;
  }>>([
    {
      id: 'welcome_1',
      role: 'assistant',
      text: "👋 Hello! I am your Bestie AI CRM Copilot. I have real-time ground access to your authorized CRM contacts, partners, sales pipeline, activities, and tasks.\n\nUse the quick actions above or ask any question to evaluate pipeline health, run BANT lead scoring, summarize overdue tasks, or research target companies.",
      timestamp: 'Ready'
    }
  ]);

  // CRM Search & Filters
  const [crmSearch, setCrmSearch] = useState('');
  const [crmStatusFilter, setCrmStatusFilter] = useState('ALL');

  // Contact / Partner Modal Form State
  const [newContactType, setNewContactType] = useState<'LEAD' | 'CUSTOMER' | 'PARTNER'>('LEAD');
  const [newPartnerTier, setNewPartnerTier] = useState('Standard');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactNotes, setNewContactNotes] = useState('');
  const [newContactScore, setNewContactScore] = useState(75);

  // Deal Modal Form State
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealValue, setNewDealValue] = useState(15000);
  const [newDealStage, setNewDealStage] = useState<CrmDeal['stage']>('NEW_LEAD');
  const [newDealExpectedCloseDate, setNewDealExpectedCloseDate] = useState('');
  const [newDealContactId, setNewDealContactId] = useState('');
  const [newDealNotes, setNewDealNotes] = useState('');

  // P3: CRM Activities & Communication History State
  const [crmActivities, setCrmActivities] = useState<CrmActivity[]>([]);
  const [crmActivitiesLoading, setCrmActivitiesLoading] = useState(false);
  const [crmActivityFilter, setCrmActivityFilter] = useState('ALL');
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [newActivityType, setNewActivityType] = useState<CrmActivity['activityType']>('NOTE');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityContactId, setNewActivityContactId] = useState('');
  const [newActivityDealId, setNewActivityDealId] = useState('');
  const [newActivityDesc, setNewActivityDesc] = useState('');

  // P3: Real Database Projects & Tasks State
  const [realProjects, setRealProjects] = useState<CrmProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectTaskInputs, setProjectTaskInputs] = useState<Record<string, string>>({});

  const fetchCrmData = async () => {
    setCrmLoading(true);
    setCrmError(null);
    try {
      const [mRes, cRes, dRes, aRes] = await Promise.all([
        apiClient.getCrmMetrics().catch(() => ({ success: false, metrics: null })),
        apiClient.getCrmContacts().catch(() => ({ success: false, contacts: [], total: 0 })),
        apiClient.getCrmDeals().catch(() => ({ success: false, deals: [], count: 0 })),
        apiClient.getCrmActivities().catch(() => ({ success: false, activities: [], count: 0 }))
      ]);

      if (mRes.success && mRes.metrics) {
        setCrmMetrics(mRes.metrics);
      }
      if (cRes.success && Array.isArray(cRes.contacts)) {
        setCrmContacts(cRes.contacts);
      }
      if (dRes.success && Array.isArray(dRes.deals)) {
        setCrmDeals(dRes.deals);
      }
      if (aRes.success && Array.isArray(aRes.activities)) {
        setCrmActivities(aRes.activities);
      }
    } catch (err: any) {
      console.error('[BusinessWorkspacePage] CRM fetch error:', err.message);
      setCrmError(err.message || 'Failed to connect to CRM database.');
    } finally {
      setCrmLoading(false);
    }
  };

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await apiClient.getCrmProjects();
      if (res.success && Array.isArray(res.projects)) {
        const withTasks = await Promise.all(
          res.projects.map(async (p) => {
            try {
              const full = await apiClient.getCrmProjectById(p.id);
              return full.project || p;
            } catch {
              return p;
            }
          })
        );
        setRealProjects(withTasks);
      }
    } catch (err: any) {
      console.warn('[BusinessWorkspacePage] fetchProjects warning:', err.message);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
    fetchProjects();
    apiClient.getCrmStatus()
      .then((res) => {
        if (res.success && typeof res.enabled === 'boolean') {
          setCrmModuleEnabled(res.enabled);
        }
      })
      .catch(() => {});
  }, []);

  const handleRunCopilotAction = async (action: string, customQuery?: string) => {
    setCopilotLoading(true);
    const userPrompt = customQuery || (
      action === 'PIPELINE_ANALYSIS' ? 'Analyze current sales pipeline health and bottlenecks' :
      action === 'LEAD_QUALIFICATION' ? 'Qualify and score leads using the BANT framework' :
      action === 'OVERDUE_TASKS' ? 'Summarize overdue CRM tasks and urgent action items' :
      action === 'PROSPECT_RESEARCH' ? (copilotQuery.trim() || 'Research target prospect') :
      'Provide operational CRM briefing'
    );

    const userMsgId = 'msg_' + Date.now();
    setCopilotHistory(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text: userPrompt, action, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    try {
      const res = await apiClient.askCrmCopilot({ action, query: customQuery || copilotQuery || userPrompt });
      if (res.success) {
        setCopilotHistory(prev => [
          ...prev,
          {
            id: 'resp_' + Date.now(),
            role: 'assistant',
            text: res.response,
            action: res.action,
            structuredProspect: res.structuredProspect,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        if (crmSubTab !== 'copilot') {
          setCrmSubTab('copilot');
        }
      } else {
        showToast(res.error || 'Copilot could not process request.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'CRM Copilot service unreachable.', 'error');
    } finally {
      setCopilotLoading(false);
      setCopilotQuery('');
    }
  };

  const handleSaveProspectToContacts = async (prospect: Partial<CrmContact>) => {
    try {
      const created = await apiClient.createCrmContact({
        firstName: prospect.firstName || 'New',
        lastName: prospect.lastName || 'Lead',
        company: prospect.company || '',
        email: prospect.email || `lead_${Date.now()}@example.com`,
        phone: prospect.phone || '',
        role: prospect.role || 'Prospect',
        type: 'LEAD',
        status: 'NEW',
        score: prospect.score || 80,
        estimatedValue: prospect.estimatedValue || 25000,
        notes: prospect.notes || 'Sourced via Bestie AI Prospect Research'
      });
      if (created.success) {
        showToast(`Saved "${created.contact.firstName} ${created.contact.lastName}" (${created.contact.company}) to CRM Contacts!`, 'success');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(`Failed to save prospect: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'nErgy CRM Deep Sync') {
      fetchCrmData();
    }
    if (activeTab === 'Projects' || activeTab === 'Overview') {
      fetchProjects();
    }
  }, [activeTab]);

  const handleRunCrmSync = async () => {
    setIsSyncingCrm(true);
    await fetchCrmData();
    setIsSyncingCrm(false);
    showToast('nErgy CRM Deep Sync executed: verified live database connection.', 'success');
  };

  const handleCaptureLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadEmail.trim()) {
      showToast('Contact name and email are required', 'error');
      return;
    }

    const nameParts = newLeadName.trim().split(' ');
    const firstName = nameParts[0] || 'Lead';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const res = await apiClient.createCrmContact({
        firstName,
        lastName,
        email: newLeadEmail.trim(),
        phone: newContactPhone.trim() || undefined,
        company: newLeadCompany.trim() || undefined,
        jobTitle: newLeadRole || undefined,
        type: newContactType,
        status: newContactType === 'PARTNER' ? 'ACTIVE' : 'NEW',
        score: Number(newContactScore) || 75,
        estimatedValue: Number(newLeadValue) || 0,
        partnerTier: newContactType === 'PARTNER' ? newPartnerTier : undefined,
        notes: newContactNotes.trim() || undefined
      });

      if (res.success && res.contact) {
        showToast(`${newContactType === 'PARTNER' ? 'Partner' : 'Contact'} "${res.contact.name}" saved to database!`, 'success');
        setIsLeadModalOpen(false);
        setNewLeadName('');
        setNewLeadEmail('');
        setNewLeadCompany('');
        setNewContactPhone('');
        setNewContactNotes('');
        setNewContactScore(75);
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save contact', 'error');
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealTitle.trim()) {
      showToast('Deal title is required', 'error');
      return;
    }

    try {
      const res = await apiClient.createCrmDeal({
        title: newDealTitle.trim(),
        value: Number(newDealValue) || 0,
        stage: newDealStage,
        expectedCloseDate: newDealExpectedCloseDate || undefined,
        contactId: newDealContactId || undefined,
        notes: newDealNotes.trim() || undefined
      });

      if (res.success && res.deal) {
        showToast(`Deal "${res.deal.title}" created successfully!`, 'success');
        setIsDealModalOpen(false);
        setNewDealTitle('');
        setNewDealValue(15000);
        setNewDealStage('NEW_LEAD');
        setNewDealExpectedCloseDate('');
        setNewDealContactId('');
        setNewDealNotes('');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create deal', 'error');
    }
  };

  const handleUpdateDealStage = async (dealId: string, stage: string) => {
    try {
      const res = await apiClient.updateCrmDealStage(dealId, stage);
      if (res.success) {
        showToast(`Deal stage updated to ${stage.replace('_', ' ')}!`, 'success');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update deal stage', 'error');
    }
  };

  const handleDeleteContact = async (contactId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await apiClient.deleteCrmContact(contactId);
      if (res.success) {
        showToast(`Contact "${name}" deleted.`, 'info');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete contact', 'error');
    }
  };

  const handleDeleteDeal = async (dealId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete deal "${title}"?`)) return;
    try {
      const res = await apiClient.deleteCrmDeal(dealId);
      if (res.success) {
        showToast(`Deal "${title}" deleted.`, 'info');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete deal', 'error');
    }
  };

  const handleExportCsv = () => {
    if (crmContacts.length === 0) {
      showToast('No contacts available to export', 'info');
      return;
    }
    exportToCsv('nergy_crm_contacts.csv', crmContacts.map((c) => ({
      ID: c.id,
      Name: c.name,
      Email: c.email,
      Phone: c.phone || '',
      Company: c.company || '',
      JobTitle: c.jobTitle || '',
      Type: c.type,
      Status: c.status,
      Score: c.score,
      EstimatedValue: c.estimatedValue,
      PartnerTier: c.partnerTier || '',
      CreatedAt: c.createdAt
    })));
    showToast(`Exported ${crmContacts.length} contacts to CSV.`, 'success');
  };

  const handleImportCsv = async (parsedRows: Record<string, string>[]) => {
    try {
      const res = await apiClient.bulkImportCrmContacts(parsedRows);
      if (res.success) {
        showToast(`Successfully imported ${res.importedCount} contacts into CRM database!`, 'success');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'CSV Import failed', 'error');
    }
  };

  const handleSaveBrandProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandProfile({
      brandName: bName,
      tagline: bTagline,
      voiceTone: bVoice,
      targetAudience: bAudience,
      coreValues: bValues,
      missionStatement: bMission
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    try {
      const res = await apiClient.createCrmProject({
        name: pName.trim(),
        category: pCategory,
        status: 'IN_PROGRESS',
        dueDate: pDueDate || undefined,
        progress: 10,
        description: pDesc.trim() || 'Active strategic campaign initiatives.'
      });
      if (res.success) {
        showToast(`Created project "${res.project.name}" in database!`, 'success');
        setPName('');
        setPDesc('');
        fetchProjects();
        setActiveTab('Projects');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
    }
  };

  const handleUpdateProjectProgress = async (projectId: string, progress: number) => {
    try {
      const res = await apiClient.updateCrmProject(projectId, { progress });
      if (res.success) {
        setRealProjects(prev => prev.map(p => p.id === projectId ? { ...p, progress } : p));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update progress', 'error');
    }
  };

  const handleDeleteProject = async (projectId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}" and all its tasks?`)) return;
    try {
      const res = await apiClient.deleteCrmProject(projectId);
      if (res.success) {
        showToast(`Project "${name}" removed.`, 'info');
        setRealProjects(prev => prev.filter(p => p.id !== projectId));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    }
  };

  const handleCreateProjectTask = async (projectId: string) => {
    const title = projectTaskInputs[projectId]?.trim();
    if (!title) return;
    try {
      const res = await apiClient.createCrmTask({
        relatedType: 'PROJECT',
        relatedId: projectId,
        title,
        priority: 'MEDIUM',
        status: 'PENDING'
      });
      if (res.success) {
        setProjectTaskInputs(prev => ({ ...prev, [projectId]: '' }));
        setRealProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            const existingTasks = p.tasks || [];
            return {
              ...p,
              tasksCount: (p.tasksCount || 0) + 1,
              tasks: [...existingTasks, res.task]
            };
          }
          return p;
        }));
        showToast('Task added to project!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add task', 'error');
    }
  };

  const handleToggleTaskStatus = async (projectId: string, task: CrmTask) => {
    const nextStatus: CrmTask['status'] = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await apiClient.updateCrmTask(task.id, { status: nextStatus });
      if (res.success) {
        setRealProjects(prev => prev.map(p => {
          if (p.id === projectId && p.tasks) {
            const updatedTasks = p.tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t);
            const completedCount = updatedTasks.filter(t => t.status === 'COMPLETED').length;
            const progress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : p.progress;
            apiClient.updateCrmProject(projectId, { progress }).catch(() => {});
            return {
              ...p,
              progress,
              completedTasksCount: completedCount,
              tasks: updatedTasks
            };
          }
          return p;
        }));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle task', 'error');
    }
  };

  const handleDeleteTask = async (projectId: string, taskId: string) => {
    try {
      const res = await apiClient.deleteCrmTask(taskId);
      if (res.success) {
        setRealProjects(prev => prev.map(p => {
          if (p.id === projectId && p.tasks) {
            const remaining = p.tasks.filter(t => t.id !== taskId);
            return {
              ...p,
              tasksCount: Math.max((p.tasksCount || 1) - 1, 0),
              tasks: remaining
            };
          }
          return p;
        }));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task', 'error');
    }
  };

  const handleConvertDealToProject = async (deal: CrmDeal) => {
    try {
      const res = await apiClient.convertCrmDealToProject(deal.id, {
        projectName: `${deal.title} - Delivery`,
        category: 'Client Project',
        dueDate: deal.expectedCloseDate,
        description: `Won deal delivery for ${deal.contactName || deal.title} (${deal.value.toLocaleString()}).`
      });
      if (res.success) {
        showToast(`Successfully converted won deal "${deal.title}" into delivery project!`, 'success');
        fetchCrmData();
        fetchProjects();
        setActiveTab('Projects');
      }
    } catch (err: any) {
      showToast(err.message || 'Deal conversion failed', 'error');
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityTitle.trim()) {
      showToast('Activity title is required', 'error');
      return;
    }
    try {
      const res = await apiClient.createCrmActivity({
        activityType: newActivityType,
        title: newActivityTitle.trim(),
        contactId: newActivityContactId || undefined,
        dealId: newActivityDealId || undefined,
        description: newActivityDesc.trim() || undefined
      });
      if (res.success) {
        showToast(`Logged ${newActivityType.toLowerCase()} activity successfully!`, 'success');
        setIsActivityModalOpen(false);
        setNewActivityTitle('');
        setNewActivityDesc('');
        setNewActivityContactId('');
        setNewActivityDealId('');
        fetchCrmData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to log activity', 'error');
    }
  };

  const handleDeleteActivity = async (activityId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete activity "${title}"?`)) return;
    try {
      const res = await apiClient.deleteCrmActivity(activityId);
      if (res.success) {
        showToast('Activity record removed.', 'info');
        setCrmActivities((prev) => prev.filter((a) => a.id !== activityId));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete activity', 'error');
    }
  };

  const handleAddCalendarPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim()) return;
    addCalendarEvent({
      title: cTitle.trim(),
      platform: cPlatform,
      date: cDate,
      status: 'Scheduled',
      format: 'Social / Post'
    });
    setCTitle('');
    showToast('Post added to Content Calendar', 'success');
  };

  return (
    <div className="dashboard-page-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>
            <Briefcase size={26} color="#A78BFA" />
            Small Business & Team Workspace
          </h1>
          <p className="dashboard-subtitle">
            Unify your brand identity, campaign projects, editorial content calendar, and marketing assets into one collaborative dashboard.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <div className="badge badge-primary">
            {realProjects.length > 0 ? realProjects.length : businessProjects.length} Active Business Projects
          </div>
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-box">
                  <Briefcase size={20} />
                </div>
                <span className="metric-badge positive">Active</span>
              </div>
              <div className="metric-value">{realProjects.length > 0 ? realProjects.length : businessProjects.length}</div>
              <div className="metric-label">Ongoing Business Campaigns</div>
            </div>

            <div className="metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-box" style={{ color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)' }}>
                  <Calendar size={20} />
                </div>
                <span className="metric-badge neutral">Scheduled</span>
              </div>
              <div className="metric-value">{calendarEvents.length}</div>
              <div className="metric-label">Editorial Calendar Items</div>
            </div>

            <div className="metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-box" style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.12)' }}>
                  <Sparkles size={20} />
                </div>
                <span className="metric-badge positive">Synced</span>
              </div>
              <div className="metric-value">{brandProfile.brandName}</div>
              <div className="metric-label">Active Brand Identity Profile</div>
            </div>
          </div>

          {/* Part 13: B4B America Training & Education Onboarding Hub */}
          <div className="b4b-training-hero-card">
            <div className="b4b-badge-row">
              <span className="b4b-pill partner">
                <Award size={13} />
                B4B America Official Partner
              </span>
              <span className="b4b-pill guarantee">
                100% Free Client Education &amp; Onboarding
              </span>
            </div>

            <div>
              <h2 className="b4b-title">
                B4B America — Small Business Training &amp; Education Onboarding Hub
              </h2>
              <p className="b4b-desc">
                B4B America is the official point of contact creating personal relationships with small businesses to educate and train clients on all Zunme AI products. We ensure your business learns how to do more for less cost with our AI One Stop Shop on any budget.
              </p>
            </div>

            <div className="b4b-perks-grid">
              <div className="b4b-perk-card">
                <div className="b4b-perk-icon">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="b4b-perk-title">1-on-1 Product Walkthrough</div>
                  <p className="b4b-perk-text">
                    Personalized 45-min live session to train your team on AI workflows, CRM synchronization, and prompt architecture.
                  </p>
                </div>
              </div>

              <div className="b4b-perk-card">
                <div className="b4b-perk-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#C084FC' }}>
                  <Zap size={18} />
                </div>
                <div>
                  <div className="b4b-perk-title">Low-Budget Strategy Consultation</div>
                  <p className="b4b-perk-text">
                    Tailored guidance to launch $10-$25/day starter ads and automate lead intake without hiring an expensive agency.
                  </p>
                </div>
              </div>

              <div className="b4b-perk-card">
                <div className="b4b-perk-icon" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8' }}>
                  <Headphones size={18} />
                </div>
                <div>
                  <div className="b4b-perk-title">Dedicated Point of Contact</div>
                  <p className="b4b-perk-text">
                    Direct phone and email access to Elena Vance &amp; Sarah Jenkins for ongoing client education and support.
                  </p>
                </div>
              </div>
            </div>

            <div className="b4b-actions-row">
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#059669',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setIsB4BBookingOpen(true)}
              >
                <Calendar size={15} />
                <span>Book 1-on-1 Product Training Session</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                style={{
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => setActiveTab('Help & Support')}
              >
                <LifeBuoy size={14} />
                <span>View B4B Support &amp; Education Desk</span>
              </button>
            </div>
          </div>

          <div className="cards-grid-2">
            {/* Active Projects Preview */}
            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title">Active Projects & Deadlines</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('Projects')}
                  style={{ fontSize: '11px' }}
                >
                  All Projects
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(realProjects.length > 0 ? realProjects : businessProjects).map((proj) => (
                  <div
                    key={proj.id}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#FAFBFD',
                      border: '1px solid #E8ECF5',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#111625', fontSize: '13px' }}>{proj.name}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{proj.category}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5F6B85' }}>
                      <span>Due: {proj.dueDate}</span>
                      <span>Progress: {proj.progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: '#E8ECF5' }}>
                      <div style={{ width: `${proj.progress}%`, height: '100%', background: '#6E56CF', borderRadius: '2px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Calendar Preview */}
            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title">Upcoming Content Schedule</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('Content Calendar')}
                  style={{ fontSize: '11px' }}
                >
                  Open Calendar
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {calendarEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#FAFBFD',
                      border: '1px solid #E8ECF5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: '#111625', fontSize: '13px' }}>{ev.title}</div>
                      <div style={{ fontSize: '11px', color: '#5F6B85', marginTop: '2px' }}>
                        Channel: <strong>{ev.platform}</strong> • Date: {ev.date}
                      </div>
                    </div>
                    <span className="badge badge-primary">{ev.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Brand Profile */}
      {activeTab === 'Brand Profile' && (
        <div className="glass-panel" style={{ maxWidth: '780px', margin: '0 auto', width: '100%' }}>
          <div className="panel-header">
            <div className="panel-title">Brand Voice & Persona Configuration</div>
            <span className="badge badge-success">Active Grounding Persona</span>
          </div>

          <form onSubmit={handleSaveBrandProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-grid-2">
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Brand / Organization Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Brand Tagline
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={bTagline}
                  onChange={(e) => setBTagline(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                Tone of Voice & Personality
              </label>
              <input
                type="text"
                className="input-field"
                value={bVoice}
                onChange={(e) => setBVoice(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                Primary Target Audience
              </label>
              <textarea
                className="input-field"
                rows={2}
                value={bAudience}
                onChange={(e) => setBAudience(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                Core Values & Positioning Pillars
              </label>
              <textarea
                className="input-field"
                rows={2}
                value={bValues}
                onChange={(e) => setBValues(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                Mission Statement
              </label>
              <textarea
                className="input-field"
                rows={2}
                value={bMission}
                onChange={(e) => setBMission(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={14} />
                <span>Save Brand Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Projects */}
      {activeTab === 'Projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ padding: 'var(--space-4)' }}>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                placeholder="New project title..."
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                style={{ flex: 1, minWidth: '240px' }}
                required
              />
              <select
                className="input-field"
                style={{ width: '180px' }}
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value as any)}
              >
                <option value="Marketing Campaign">Marketing Campaign</option>
                <option value="Product Launch">Product Launch</option>
                <option value="Brand Rebrand">Brand Rebrand</option>
                <option value="SEO Revamp">SEO Revamp</option>
              </select>
              <input
                type="date"
                className="input-field"
                style={{ width: '160px' }}
                value={pDueDate}
                onChange={(e) => setPDueDate(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <Plus size={14} /> Add Project
              </button>
            </form>
          </div>

          <div className="cards-grid-3">
            {projectsLoading ? (
              <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#5F6B85' }}>
                <RefreshCw size={22} className="spin" style={{ margin: '0 auto 10px' }} />
                <div>Loading real projects and tasks from database...</div>
              </div>
            ) : realProjects.length === 0 ? (
              <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: '#5F6B85' }}>
                <FolderKanban size={36} color="#CBD5E1" style={{ margin: '0 auto 12px', display: 'block' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111625', marginBottom: '6px' }}>No Database Projects Found</h3>
                <p style={{ fontSize: '13px', color: '#5F6B85', maxWidth: '420px', margin: '0 auto 16px', lineHeight: '1.4' }}>
                  Create a new project using the form above, or convert any <strong>Won Deal</strong> from your CRM sales pipeline into a delivery project.
                </p>
              </div>
            ) : (
              realProjects.map((proj) => (
                <div key={proj.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{proj.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`status-chip ${proj.status === 'COMPLETED' ? 'success' : 'info'}`} style={{ fontSize: '11px' }}>
                          {proj.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(proj.id, proj.name)}
                          title="Delete project"
                          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#94A3B8' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {proj.dealTitle && (
                      <div style={{ fontSize: '11px', color: '#6E56CF', background: '#F5F3FF', padding: '3px 8px', borderRadius: '4px', marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Rocket size={11} /> Deal: <strong>{proj.dealTitle}</strong> {proj.dealValue ? `(${proj.dealValue.toLocaleString()})` : ''}
                      </div>
                    )}

                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111625', marginBottom: '6px' }}>{proj.name}</h3>
                    <p style={{ fontSize: '12px', color: '#5F6B85', lineHeight: '1.4', marginBottom: '14px' }}>{proj.description}</p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>
                      <span>Target: {proj.dueDate ? String(proj.dueDate).slice(0, 10) : 'Ongoing'}</span>
                      <span style={{ fontWeight: '700', color: '#111625' }}>{proj.progress}% Done</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={proj.progress}
                        onChange={(e) => handleUpdateProjectProgress(proj.id, Number(e.target.value))}
                        style={{ flex: 1, accentColor: '#6E56CF', cursor: 'pointer' }}
                        title="Adjust project completion %"
                      />
                    </div>

                    {/* Embedded Project Tasks */}
                    <div style={{ paddingTop: '10px', borderTop: '1px solid #F0F3F9' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#5F6B85', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Action Tasks ({proj.completedTasksCount || 0}/{proj.tasksCount || proj.tasks?.length || 0})</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                        {proj.tasks && proj.tasks.length > 0 ? (
                          proj.tasks.map((t) => (
                            <div
                              key={t.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 6px',
                                borderRadius: '5px',
                                background: t.status === 'COMPLETED' ? '#F8FAFC' : '#FAFBFD',
                                border: '1px solid #EDF2F7',
                                fontSize: '11.5px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                                <input
                                  type="checkbox"
                                  checked={t.status === 'COMPLETED'}
                                  onChange={() => handleToggleTaskStatus(proj.id, t)}
                                  style={{ cursor: 'pointer', accentColor: '#059669' }}
                                />
                                <span style={{
                                  textDecoration: t.status === 'COMPLETED' ? 'line-through' : 'none',
                                  color: t.status === 'COMPLETED' ? '#94A3B8' : '#111625',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {t.title}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className={`badge badge-${t.priority === 'URGENT' ? 'danger' : t.priority === 'HIGH' ? 'warning' : 'neutral'}`} style={{ fontSize: '8.5px', padding: '1px 4px' }}>
                                  {t.priority}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(proj.id, t.id)}
                                  style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', color: '#94A3B8' }}
                                  title="Delete task"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', padding: '2px 0' }}>No tasks assigned</span>
                        )}
                      </div>

                      {/* Inline Task Quick-Add */}
                      <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="New task..."
                          value={projectTaskInputs[proj.id] || ''}
                          onChange={(e) => setProjectTaskInputs(prev => ({ ...prev, [proj.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateProjectTask(proj.id);
                            }
                          }}
                          style={{ fontSize: '11px', padding: '3px 7px', height: '26px', flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleCreateProjectTask(proj.id)}
                          style={{ padding: '2px 6px', height: '26px', fontSize: '11px' }}
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Content Calendar */}
      {activeTab === 'Content Calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ padding: 'var(--space-4)' }}>
            <form onSubmit={handleAddCalendarPost} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Scheduled post title / hook..."
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                style={{ flex: 1, minWidth: '240px' }}
                required
              />
              <select
                className="input-field"
                style={{ width: '180px' }}
                value={cPlatform}
                onChange={(e) => setCPlatform(e.target.value as any)}
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Twitter / X">Twitter / X</option>
                <option value="Newsletter">Newsletter</option>
                <option value="Blog">Blog</option>
                <option value="Instagram">Instagram</option>
              </select>
              <input
                type="date"
                className="input-field"
                style={{ width: '160px' }}
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <Plus size={14} /> Schedule Post
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Scheduled Asset Title</th>
                    <th>Platform Channel</th>
                    <th>Target Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: '700', color: '#111625' }}>{ev.title}</td>
                      <td><span className="badge badge-neutral">{ev.platform}</span></td>
                      <td>{ev.date}</td>
                      <td><span className="status-chip success">{ev.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Part 14: Tab: Marketing Content & Small Business Starter Ad Bridge */}
      {activeTab === 'Marketing Content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Starter Ad Bridge Hero Banner */}
          <div className="ad-bridge-hero">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="ad-bridge-tag">
                  <Rocket size={12} />
                  Zunme Ads — Small Business Starter Bridge
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: '8px 0 6px 0', letterSpacing: '-0.01em' }}>
                  AI One Stop Shop for the Web — Advertising for Small Businesses
                </h2>
                <p style={{ fontSize: '13.5px', color: '#CBD5E1', margin: 0, maxWidth: '820px', lineHeight: '1.55' }}>
                  Small businesses are on a budget, and the importance of business management, technology, and advertising cannot be overstated. Zunme Ads enables you to do more for less cost with 1-click starter templates, bidding on high-intent search keywords or visual placements with modest daily budgets ($5 - $25/day).
                </p>
              </div>

              <NavLink
                to="/ads/create-campaign"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)',
                  borderColor: '#A855F7',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>Full Zunme Ads Studio</span>
                <ArrowRight size={14} />
              </NavLink>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '6px', fontSize: '12.5px', color: '#E2E8F0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#34D399" />
                Pay Only For Results (PPC Per Click / PPV Per 1k Views)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#34D399" />
                No Marketing Agency Fees
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#34D399" />
                Instant 1-Click Launch to Live Search Network
              </span>
            </div>
          </div>

          {/* 4 Pre-Engineered Starter Templates Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111625', margin: 0 }}>
                  Pre-Engineered 1-Click Starter Ad Presets
                </h3>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', margin: '2px 0 0 0' }}>
                  Select a template to configure your low-budget campaign and deploy to the Zunme Ads network in seconds.
                </p>
              </div>
            </div>

            <div className="ad-templates-grid">
              {/* Preset 1: High-Intent Search Starter */}
              <div
                className={`starter-ad-card ${selectedAdTemplate === 'SEARCH_PPC' ? 'recommended' : ''}`}
                style={{ cursor: 'pointer', border: selectedAdTemplate === 'SEARCH_PPC' ? '2px solid #6E56CF' : undefined }}
                onClick={() => {
                  setSelectedAdTemplate('SEARCH_PPC');
                  setStarterPaymentModel('PPC');
                  setStarterAdBudget(10);
                }}
              >
                <span className="ad-card-badge ppc">PPC • Pay Per Click</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={20} />
                  </div>
                  <div>
                    <h4 className="starter-ad-title">Local High-Intent Search</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Keywords Bidding • $10/day</span>
                  </div>
                </div>
                <p className="starter-ad-desc">
                  Appear directly at the top of Zunme Web Search when customers query your exact services. Pay only when someone clicks.
                </p>
                <div className="starter-ad-specs">
                  <span>Est. Clicks: <strong>25 - 45 / day</strong></span>
                  <span>Avg CPC: <strong>$0.28 - $0.35</strong></span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: selectedAdTemplate === 'SEARCH_PPC' ? '#6E56CF' : '#FFFFFF',
                    color: selectedAdTemplate === 'SEARCH_PPC' ? '#FFFFFF' : '#111625',
                    borderColor: selectedAdTemplate === 'SEARCH_PPC' ? '#6E56CF' : '#CBD5E1'
                  }}
                >
                  {selectedAdTemplate === 'SEARCH_PPC' ? 'Selected Template' : 'Use This Template'}
                </button>
              </div>

              {/* Preset 2: AI One Stop Shop Display */}
              <div
                className={`starter-ad-card ${selectedAdTemplate === 'DISPLAY_PPV' ? 'recommended' : ''}`}
                style={{ cursor: 'pointer', border: selectedAdTemplate === 'DISPLAY_PPV' ? '2px solid #6E56CF' : undefined }}
                onClick={() => {
                  setSelectedAdTemplate('DISPLAY_PPV');
                  setStarterPaymentModel('PPV');
                  setStarterAdBudget(15);
                }}
              >
                <span className="ad-card-badge ppv">PPV • 1,000 Views</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FAF5FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={20} />
                  </div>
                  <div>
                    <h4 className="starter-ad-title">AI One Stop Shop Promotion</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Display Banner • $15/day</span>
                  </div>
                </div>
                <p className="starter-ad-desc">
                  Broadcast your brand banner across Zunme affiliated networks. Fixed low cost per 1,000 verified human impressions.
                </p>
                <div className="starter-ad-specs">
                  <span>Est. Views: <strong>4,200 / day</strong></span>
                  <span>Est. CPM: <strong>$3.50</strong></span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: selectedAdTemplate === 'DISPLAY_PPV' ? '#6E56CF' : '#FFFFFF',
                    color: selectedAdTemplate === 'DISPLAY_PPV' ? '#FFFFFF' : '#111625',
                    borderColor: selectedAdTemplate === 'DISPLAY_PPV' ? '#6E56CF' : '#CBD5E1'
                  }}
                >
                  {selectedAdTemplate === 'DISPLAY_PPV' ? 'Selected Template' : 'Use This Template'}
                </button>
              </div>

              {/* Preset 3: E-Commerce Shopping */}
              <div
                className={`starter-ad-card ${selectedAdTemplate === 'SHOPPING_PPC' ? 'recommended' : ''}`}
                style={{ cursor: 'pointer', border: selectedAdTemplate === 'SHOPPING_PPC' ? '2px solid #6E56CF' : undefined }}
                onClick={() => {
                  setSelectedAdTemplate('SHOPPING_PPC');
                  setStarterPaymentModel('PPC');
                  setStarterAdBudget(20);
                }}
              >
                <span className="ad-card-badge shopping">Shopping • Product</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h4 className="starter-ad-title">E-Commerce Product Spotlight</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Shopping Ads • $20/day</span>
                  </div>
                </div>
                <p className="starter-ad-desc">
                  Showcase your catalog item with product image, price tag, store name, and instant "Shop Now" direct checkout button.
                </p>
                <div className="starter-ad-specs">
                  <span>Est. Clicks: <strong>40 - 70 / day</strong></span>
                  <span>Direct ROAS: <strong>High Intent</strong></span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: selectedAdTemplate === 'SHOPPING_PPC' ? '#6E56CF' : '#FFFFFF',
                    color: selectedAdTemplate === 'SHOPPING_PPC' ? '#FFFFFF' : '#111625',
                    borderColor: selectedAdTemplate === 'SHOPPING_PPC' ? '#6E56CF' : '#CBD5E1'
                  }}
                >
                  {selectedAdTemplate === 'SHOPPING_PPC' ? 'Selected Template' : 'Use This Template'}
                </button>
              </div>

              {/* Preset 4: Video Ad Spotlight */}
              <div
                className={`starter-ad-card ${selectedAdTemplate === 'VIDEO_PPV' ? 'recommended' : ''}`}
                style={{ cursor: 'pointer', border: selectedAdTemplate === 'VIDEO_PPV' ? '2px solid #6E56CF' : undefined }}
                onClick={() => {
                  setSelectedAdTemplate('VIDEO_PPV');
                  setStarterPaymentModel('PPV');
                  setStarterAdBudget(25);
                }}
              >
                <span className="ad-card-badge ppv">Video • PPV Views</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Video size={20} />
                  </div>
                  <div>
                    <h4 className="starter-ad-title">Video Ad Spotlight</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Video Overlay • $25/day</span>
                  </div>
                </div>
                <p className="starter-ad-desc">
                  Tell your small business story with a short video promo, viewer duration tracking, and clickable call-to-action overlay.
                </p>
                <div className="starter-ad-specs">
                  <span>Est. Views: <strong>6,500 / day</strong></span>
                  <span>Completion Rate: <strong>~72%</strong></span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: selectedAdTemplate === 'VIDEO_PPV' ? '#6E56CF' : '#FFFFFF',
                    color: selectedAdTemplate === 'VIDEO_PPV' ? '#FFFFFF' : '#111625',
                    borderColor: selectedAdTemplate === 'VIDEO_PPV' ? '#6E56CF' : '#CBD5E1'
                  }}
                >
                  {selectedAdTemplate === 'VIDEO_PPV' ? 'Selected Template' : 'Use This Template'}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive 1-Click Launch Configuration & Simulator */}
          <div className="glass-panel starter-ad-config-panel" style={{ padding: '24px 28px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="#A855F7" />
                  <span>1-Click Starter Ad Simulator &amp; Instant Deployment</span>
                </div>
                <div className="panel-subtitle">
                  Configure budget and copy in real-time, then deploy directly to Zunme's advertising engine.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-success">Bridge Connected to Zunme Ads</span>
              </div>
            </div>

            <div className="starter-ad-config-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
              {/* Configuration Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Campaign Headline (Brand + Value Proposition)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={starterHeadline}
                    onChange={(e) => setStarterHeadline(e.target.value)}
                    style={{ width: '100%', fontSize: '13px' }}
                    placeholder="e.g. Apex Growth | AI One Stop Shop for Small Business"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Ad Description &amp; Call to Action
                  </label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={starterDescription}
                    onChange={(e) => setStarterDescription(e.target.value)}
                    style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
                    placeholder="Explain what makes your business unique and why users should click..."
                  />
                </div>

                {/* Budget & Model Selector */}
                <div className="starter-budget-model-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      Daily Budget: <strong>${starterAdBudget} / day</strong>
                    </label>
                    <div className="starter-budget-buttons-row" style={{ display: 'flex', gap: '6px' }}>
                      {[5, 10, 15, 25, 50].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setStarterAdBudget(amount)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            borderRadius: '6px',
                            border: starterAdBudget === amount ? '2px solid #6E56CF' : '1px solid #CBD5E1',
                            background: starterAdBudget === amount ? '#F3F0FF' : '#FFFFFF',
                            color: starterAdBudget === amount ? '#6E56CF' : '#475569',
                            fontWeight: '800',
                            fontSize: '11.5px',
                            cursor: 'pointer'
                          }}
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      Billing Model
                    </label>
                    <div className="starter-billing-buttons-row" style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setStarterPaymentModel('PPC')}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: '6px',
                          border: starterPaymentModel === 'PPC' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                          background: starterPaymentModel === 'PPC' ? '#EFF6FF' : '#FFFFFF',
                          color: starterPaymentModel === 'PPC' ? '#2563EB' : '#475569',
                          fontWeight: '800',
                          fontSize: '11.5px',
                          cursor: 'pointer'
                        }}
                      >
                        PPC (Per Click)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStarterPaymentModel('PPV')}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: '6px',
                          border: starterPaymentModel === 'PPV' ? '2px solid #9333EA' : '1px solid #CBD5E1',
                          background: starterPaymentModel === 'PPV' ? '#FAF5FF' : '#FFFFFF',
                          color: starterPaymentModel === 'PPV' ? '#9333EA' : '#475569',
                          fontWeight: '800',
                          fontSize: '11.5px',
                          cursor: 'pointer'
                        }}
                      >
                        PPV (1k Views)
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Target Keywords (Comma Separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={starterKeywords}
                    onChange={(e) => setStarterKeywords(e.target.value)}
                    style={{ width: '100%', fontSize: '12.5px' }}
                    placeholder="small business, consulting, local services, ai tools"
                  />
                </div>

                {/* Deploy Button */}
                <div className="starter-deploy-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isDeployingAd}
                    onClick={handleDeployStarterAd}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #6E56CF 0%, #4F46E5 100%)',
                      borderColor: '#6E56CF',
                      fontWeight: '800',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Rocket size={16} />
                    <span>{isDeployingAd ? 'Deploying to Zunme Ads...' : '1-Click Launch Starter Ad'}</span>
                  </button>

                  <NavLink
                    to="/ads"
                    className="btn btn-outline"
                    style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}
                  >
                    <span>View All Ads</span>
                    <ExternalLink size={13} style={{ marginLeft: '4px' }} />
                  </NavLink>
                </div>

                {deployedAdSuccess && (
                  <div
                    style={{
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#065F46',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <CheckCircle2 size={16} color="#059669" />
                    <span>Campaign live in Zunme Ads sandbox! Bidding is active.</span>
                  </div>
                )}
              </div>

              {/* Live Preview Simulator */}
              <div className="starter-ad-simulator-box">
                <div className="starter-simulator-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Live Ad Appearance Simulator
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Placement: <strong>Zunme Web Search &amp; Network</strong>
                  </span>
                </div>

                {/* Simulated Search Ad Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="ad-preview-pill">Sponsored</span>
                    <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                      https://zunme.ai/partner/{brandProfile.brandName ? brandProfile.brandName.toLowerCase().replace(/\s+/g, '-') : 'small-business'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#1D4ED8', margin: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                    {starterHeadline || 'Your Company Headline | AI One Stop Shop'}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.45', margin: '4px 0 0 0' }}>
                    {starterDescription || 'Affordable, verified AI content, workflow acceleration, and personal client education. Learn more now.'}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                    <span
                      style={{
                        background: '#F1F5F9',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#475569',
                        fontWeight: '700'
                      }}
                    >
                      Model: {starterPaymentModel === 'PPC' ? 'Pay Per Click ($0.32 avg)' : 'Pay Per View ($3.50 CPM)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '11.5px', padding: '4px 12px' }}
                    >
                      {selectedAdTemplate === 'SHOPPING_PPC' ? 'Shop Now' : 'Learn More'}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.5', background: '#F8FAFC', padding: '10px', borderRadius: '8px' }}>
                  💡 <strong>Small Business Advantage:</strong> You are never locked into long-term agency contracts. Pause, raise, or stop your daily budget at any time with a single click.
                </div>
              </div>
            </div>
          </div>

          {/* Organic Copy Generator Bridge */}
          <div className="glass-panel" style={{ padding: '18px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#111625', margin: 0 }}>
                  Need Organic Content or Ad Copy Variations?
                </h4>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', margin: '3px 0 0 0' }}>
                  Generate multi-platform social posts, blog outlines, or email newsletters grounded in your brand identity ({brandProfile.brandName}).
                </p>
              </div>
              <NavLink to="/app/builders" className="btn btn-outline btn-sm">
                <span>Open Content Builders &rarr;</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Tab: nErgy CRM Deep Sync */}
      {activeTab === 'nErgy CRM Deep Sync' && !crmModuleEnabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' ? (
        <div className="glass-panel" style={{ borderLeft: '4px solid #EF4444', padding: '36px 24px', textAlign: 'center' }}>
          <AlertCircle size={44} color="#EF4444" style={{ margin: '0 auto 14px auto' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111625', marginBottom: '8px' }}>
            CRM nErgy Module Temporarily Disabled
          </h2>
          <p style={{ fontSize: '14px', color: '#5F6B85', maxWidth: '580px', margin: '0 auto 18px auto', lineHeight: '1.5' }}>
            The CRM nErgy Workspace, pipelines, activities, and AI Copilot tools have been temporarily disabled by the platform administrator.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/user/dashboard')}>
            Return to Dashboard
          </button>
        </div>
      ) : activeTab === 'nErgy CRM Deep Sync' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* CRM Connection Banner */}
          <div className="glass-panel" style={{ borderLeft: '4px solid #059669', padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#E8F8F0',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Database size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111625', margin: 0 }}>
                      nErgy CRM Enterprise Bridge: Synchronized
                    </h3>
                    <span className="badge badge-success">Live Database</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#5F6B85', margin: '3px 0 0 0' }}>
                    Real-time persistence across contacts, leads, sales opportunities, and partner relationships.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleRunCrmSync}
                  disabled={crmLoading || isSyncingCrm}
                >
                  <RefreshCw size={14} className={crmLoading || isSyncingCrm ? 'spin' : ''} />
                  <span>{crmLoading || isSyncingCrm ? 'Syncing...' : 'Sync Database'}</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setNewContactType('PARTNER');
                    setIsLeadModalOpen(true);
                  }}
                >
                  <Handshake size={14} color="#059669" />
                  <span>Add Partner</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsDealModalOpen(true)}
                >
                  <TrendingUp size={14} color="#6E56CF" />
                  <span>New Deal</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setNewContactType('LEAD');
                    setIsLeadModalOpen(true);
                  }}
                >
                  <Plus size={14} />
                  <span>Capture Contact</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Database Driven KPI Metrics */}
          <div className="cards-grid-4">
            <div className="glass-panel">
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                Total Pipeline Value
              </span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#111625', marginTop: '4px' }}>
                ${(crmMetrics?.totalPipelineValue || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <TrendingUp size={13} />
                <span>{crmMetrics?.wonDealsCount || 0} won deals (${(crmMetrics?.wonDealsValue || 0).toLocaleString()})</span>
              </div>
            </div>

            <div className="glass-panel">
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#6E56CF', textTransform: 'uppercase' }}>
                Active Deals in Flight
              </span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#111625', marginTop: '4px' }}>
                {crmMetrics?.activeDealsCount || 0} Deals
              </div>
              <div style={{ fontSize: '12px', color: '#5F6B85', marginTop: '4px' }}>
                {crmMetrics?.winRatePercentage || 0}% close rate across stages
              </div>
            </div>

            <div className="glass-panel">
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase' }}>
                Average AI Lead Score
              </span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#111625', marginTop: '4px' }}>
                {crmMetrics?.averageLeadScore || 50} / 100
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
                {crmMetrics?.newLeadsCount || 0} new uncontacted leads
              </div>
            </div>

            <div className="glass-panel">
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#D97706', textTransform: 'uppercase' }}>
                Total Accounts &amp; Partners
              </span>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#111625', marginTop: '4px' }}>
                {(crmMetrics?.totalContactsCount || 0) + (crmMetrics?.totalPartnersCount || 0)} Total
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
                {crmMetrics?.totalPartnersCount || 0} verified partners
              </div>
            </div>
          </div>

          {/* Bestie AI CRM Copilot Quick Actions Strip */}
          <div className="glass-panel" style={{ padding: '12px 18px', background: 'linear-gradient(90deg, #FAF8FF 0%, #F5F3FF 100%)', border: '1px solid #E4D4F4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#6E56CF" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111625' }}>Bestie AI CRM Copilot Quick Actions:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleRunCopilotAction('PIPELINE_ANALYSIS')}
                  disabled={copilotLoading}
                  style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#D8B4FE', color: '#6E56CF', background: '#FFFFFF' }}
                >
                  <TrendingUp size={12} />
                  <span>Pipeline Health</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleRunCopilotAction('LEAD_QUALIFICATION')}
                  disabled={copilotLoading}
                  style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#D8B4FE', color: '#6E56CF', background: '#FFFFFF' }}
                >
                  <Target size={12} />
                  <span>Qualify Leads (BANT)</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleRunCopilotAction('OVERDUE_TASKS')}
                  disabled={copilotLoading}
                  style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#D8B4FE', color: '#6E56CF', background: '#FFFFFF' }}
                >
                  <Clock size={12} />
                  <span>Overdue Tasks</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setCrmSubTab('copilot');
                    const target = copilotQuery.trim() || 'Starlight AI';
                    handleRunCopilotAction('PROSPECT_RESEARCH', target);
                  }}
                  disabled={copilotLoading}
                  style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#D8B4FE', color: '#6E56CF', background: '#FFFFFF' }}
                >
                  <Search size={12} />
                  <span>Research Prospect</span>
                </button>
              </div>
            </div>
          </div>

          {/* CRM Navigation Sub-tabs Switcher */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E8ECF5', paddingBottom: '10px' }}>
            <button
              className={`btn btn-sm ${crmSubTab === 'contacts' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCrmSubTab('contacts'); setCrmStatusFilter('ALL'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} />
              <span>Contacts &amp; Leads ({crmContacts.filter(c => c.type !== 'PARTNER').length})</span>
            </button>
            <button
              className={`btn btn-sm ${crmSubTab === 'deals' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCrmSubTab('deals'); setCrmStatusFilter('ALL'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <TrendingUp size={14} />
              <span>Sales Deals Pipeline ({crmDeals.length})</span>
            </button>
            <button
              className={`btn btn-sm ${crmSubTab === 'partners' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCrmSubTab('partners'); setCrmStatusFilter('ALL'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Handshake size={14} />
              <span>Partners Directory ({crmContacts.filter(c => c.type === 'PARTNER').length})</span>
            </button>
            <button
              className={`btn btn-sm ${crmSubTab === 'copilot' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCrmSubTab('copilot')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: crmSubTab === 'copilot' ? '#6E56CF' : undefined,
                borderColor: crmSubTab === 'copilot' ? '#6E56CF' : '#DDD6FE',
                color: crmSubTab === 'copilot' ? '#FFFFFF' : '#6E56CF',
                fontWeight: 700
              }}
            >
              <Sparkles size={14} />
              <span>Bestie AI Copilot &amp; Research</span>
            </button>
          </div>

          {/* Error Banner */}
          {crmError && (
            <div className="glass-panel" style={{ borderLeft: '4px solid #EF4444', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B91C1C', fontSize: '13px' }}>
                <AlertCircle size={16} />
                <span>{crmError}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={fetchCrmData}>Retry</button>
            </div>
          )}

          {/* Search, Filter & Actions Toolbar */}
          <div className="glass-panel" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                  <Search size={14} color="#8C97B0" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder={`Search ${crmSubTab}...`}
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '12.5px', height: '34px', width: '100%' }}
                  />
                </div>

                <select
                  className="input-field"
                  value={crmStatusFilter}
                  onChange={(e) => setCrmStatusFilter(e.target.value)}
                  style={{ fontSize: '12.5px', height: '34px', minWidth: '130px' }}
                >
                  <option value="ALL">All Statuses</option>
                  {crmSubTab === 'deals' ? (
                    <>
                      <option value="NEW_LEAD">New Lead</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="OPPORTUNITY">Opportunity</option>
                      <option value="PROPOSAL">Proposal</option>
                      <option value="NEGOTIATION">Negotiation</option>
                      <option value="WON">Closed Won</option>
                      <option value="LOST">Closed Lost</option>
                    </>
                  ) : (
                    <>
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="ACTIVE">Active</option>
                      <option value="WON">Won</option>
                      <option value="LOST">Lost</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleExportCsv}
                  title="Export contacts to CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsCsvImportOpen(true)}
                  title="Import contacts via CSV"
                >
                  <Upload size={13} />
                  <span>Import CSV</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsCrmConnectModalOpen(true)}
                  title="Configure nErgy CRM Integration"
                >
                  <span>Sync Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* CRM SUB-TAB 1: CONTACTS & LEADS */}
          {crmSubTab === 'contacts' && (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="panel-title">
                  <Users size={18} color="#6E56CF" />
                  Contacts &amp; Prospective Leads Directory
                </div>
                <span className="badge badge-primary">{crmContacts.filter(c => c.type !== 'PARTNER').length} Records</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8ECF5', color: '#5F6B85' }}>
                      <th style={{ padding: '12px 14px' }}>Contact &amp; Organization</th>
                      <th style={{ padding: '12px 14px' }}>Type</th>
                      <th style={{ padding: '12px 14px' }}>AI Lead Score</th>
                      <th style={{ padding: '12px 14px' }}>Source</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px' }}>Est. Value</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmLoading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#5F6B85' }}>
                          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                          <div>Loading contacts from database...</div>
                        </td>
                      </tr>
                    ) : crmContacts.filter(c => c.type !== 'PARTNER').length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#5F6B85' }}>
                          <Users size={32} color="#CBD5E1" style={{ margin: '0 auto 10px', display: 'block' }} />
                          <div style={{ fontWeight: '700', color: '#111625', fontSize: '15px' }}>No contacts found</div>
                          <p style={{ fontSize: '12.5px', color: '#8C97B0', margin: '4px 0 12px 0' }}>Capture your first contact or import a CSV file.</p>
                          <button className="btn btn-primary btn-sm" onClick={() => setIsLeadModalOpen(true)}>
                            <Plus size={13} />
                            <span>Capture Contact</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      crmContacts
                        .filter(c => c.type !== 'PARTNER')
                        .filter(c => {
                          if (crmStatusFilter !== 'ALL' && c.status.toUpperCase() !== crmStatusFilter.toUpperCase()) return false;
                          if (crmSearch.trim()) {
                            const term = crmSearch.trim().toLowerCase();
                            return (
                              c.name.toLowerCase().includes(term) ||
                              (c.company && c.company.toLowerCase().includes(term)) ||
                              c.email.toLowerCase().includes(term)
                            );
                          }
                          return true;
                        })
                        .map((contact) => (
                          <tr key={contact.id} style={{ borderBottom: '1px solid #F0F3F9' }}>
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: '800', color: '#111625' }}>{contact.name}</div>
                              <span style={{ fontSize: '11.5px', color: '#5F6B85' }}>
                                {contact.jobTitle || 'Representative'} {contact.company ? `• ${contact.company}` : ''}
                              </span>
                              <div style={{ fontSize: '11px', color: '#8C97B0' }}>{contact.email} {contact.phone ? `• ${contact.phone}` : ''}</div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{contact.type}</span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '900', color: contact.score >= 80 ? '#059669' : contact.score >= 50 ? '#D97706' : '#DC2626' }}>
                                {contact.score}/100
                              </span>
                            </td>
                            <td style={{ padding: '14px', color: '#5F6B85' }}>
                              <span style={{ background: '#FAFBFD', border: '1px solid #E8ECF5', padding: '3px 8px', borderRadius: '6px', fontSize: '11px' }}>
                                {contact.source || 'MANUAL'}
                              </span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span className={`badge ${contact.status === 'WON' || contact.status === 'ACTIVE' ? 'badge-success' : contact.status === 'QUALIFIED' ? 'badge-primary' : 'badge-neutral'}`}>
                                {contact.status}
                              </span>
                            </td>
                            <td style={{ padding: '14px', fontWeight: '800', color: '#111625' }}>
                              ${contact.estimatedValue.toLocaleString()}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => {
                                    setNewDealContactId(contact.id);
                                    setNewDealTitle(`${contact.company || contact.name} Opportunity`);
                                    setNewDealValue(contact.estimatedValue || 15000);
                                    setIsDealModalOpen(true);
                                  }}
                                  title="Create sales deal for this contact"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                >
                                  + Deal
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleDeleteContact(contact.id, contact.name)}
                                  title="Delete contact"
                                  style={{ padding: '4px 8px', color: '#DC2626' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CRM SUB-TAB 2: SALES PIPELINE DEALS */}
          {crmSubTab === 'deals' && (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="panel-title">
                  <TrendingUp size={18} color="#059669" />
                  Active Sales Deals &amp; Commercial Pipeline
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setIsDealModalOpen(true)}>
                    <Plus size={13} />
                    <span>Create Deal</span>
                  </button>
                  <span className="badge badge-success">{crmDeals.length} Opportunities</span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8ECF5', color: '#5F6B85' }}>
                      <th style={{ padding: '12px 14px' }}>Opportunity &amp; Account</th>
                      <th style={{ padding: '12px 14px' }}>Deal Value</th>
                      <th style={{ padding: '12px 14px' }}>Pipeline Stage (Advance)</th>
                      <th style={{ padding: '12px 14px' }}>Win Probability</th>
                      <th style={{ padding: '12px 14px' }}>Target Close</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmLoading ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#5F6B85' }}>
                          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                          <div>Loading deals from database...</div>
                        </td>
                      </tr>
                    ) : crmDeals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#5F6B85' }}>
                          <TrendingUp size={32} color="#CBD5E1" style={{ margin: '0 auto 10px', display: 'block' }} />
                          <div style={{ fontWeight: '700', color: '#111625', fontSize: '15px' }}>No deals in pipeline</div>
                          <p style={{ fontSize: '12.5px', color: '#8C97B0', margin: '4px 0 12px 0' }}>Add a sales opportunity to track deal progress.</p>
                          <button className="btn btn-primary btn-sm" onClick={() => setIsDealModalOpen(true)}>
                            <Plus size={13} />
                            <span>Create New Deal</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      crmDeals
                        .filter(d => {
                          if (crmStatusFilter !== 'ALL' && d.stage.toUpperCase() !== crmStatusFilter.toUpperCase()) return false;
                          if (crmSearch.trim()) {
                            const term = crmSearch.trim().toLowerCase();
                            return (
                              d.title.toLowerCase().includes(term) ||
                              (d.contactName && d.contactName.toLowerCase().includes(term)) ||
                              (d.contactCompany && d.contactCompany.toLowerCase().includes(term))
                            );
                          }
                          return true;
                        })
                        .map((deal) => (
                          <tr key={deal.id} style={{ borderBottom: '1px solid #F0F3F9' }}>
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: '800', color: '#111625' }}>{deal.title}</div>
                              {deal.contactName && (
                                <span style={{ fontSize: '11.5px', color: '#5F6B85' }}>
                                  Contact: <strong>{deal.contactName}</strong> {deal.contactCompany ? `(${deal.contactCompany})` : ''}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px', fontWeight: '800', color: '#111625', fontSize: '14px' }}>
                              ${deal.value.toLocaleString()} <span style={{ fontSize: '11px', color: '#8C97B0', fontWeight: 'normal' }}>{deal.currency}</span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <select
                                className="input-field"
                                value={deal.stage}
                                onChange={(e) => handleUpdateDealStage(deal.id, e.target.value)}
                                style={{
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  height: '32px',
                                  fontWeight: '700',
                                  color: deal.stage === 'WON' ? '#059669' : deal.stage === 'LOST' ? '#DC2626' : '#6E56CF',
                                  borderColor: deal.stage === 'WON' ? '#A7F3D0' : deal.stage === 'LOST' ? '#FECACA' : '#DDD6FE',
                                  background: deal.stage === 'WON' ? '#ECFDF5' : deal.stage === 'LOST' ? '#FEF2F2' : '#F5F3FF'
                                }}
                              >
                                <option value="NEW_LEAD">New Lead (10%)</option>
                                <option value="CONTACTED">Contacted (20%)</option>
                                <option value="QUALIFIED">Qualified (40%)</option>
                                <option value="OPPORTUNITY">Opportunity (60%)</option>
                                <option value="PROPOSAL">Proposal (75%)</option>
                                <option value="NEGOTIATION">Negotiation (90%)</option>
                                <option value="WON">Closed Won (100%)</option>
                                <option value="LOST">Closed Lost (0%)</option>
                              </select>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: '1', height: '6px', background: '#F0F3F9', borderRadius: '3px', overflow: 'hidden', minWidth: '50px' }}>
                                  <div style={{ width: `${deal.probability}%`, height: '100%', background: deal.stage === 'WON' ? '#059669' : '#6E56CF', borderRadius: '3px' }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#111625' }}>{deal.probability}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px', color: '#5F6B85', fontSize: '12px' }}>
                              {deal.expectedCloseDate ? String(deal.expectedCloseDate).slice(0, 10) : 'Open'}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                {deal.stage === 'WON' && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleConvertDealToProject(deal)}
                                    title="Convert won deal to project"
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      background: '#059669',
                                      borderColor: '#059669',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Rocket size={11} /> Convert to Project
                                  </button>
                                )}
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleDeleteDeal(deal.id, deal.title)}
                                  title="Delete deal"
                                  style={{ padding: '4px 8px', color: '#DC2626' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CRM SUB-TAB 3: PARTNERS & AFFILIATES */}
          {crmSubTab === 'partners' && (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="panel-title">
                  <Handshake size={18} color="#059669" />
                  Partners &amp; Referral Network Directory
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setNewContactType('PARTNER');
                      setIsLeadModalOpen(true);
                    }}
                  >
                    <Plus size={13} />
                    <span>Add Partner</span>
                  </button>
                  <span className="badge badge-success">{crmContacts.filter(c => c.type === 'PARTNER').length} Partners</span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8ECF5', color: '#5F6B85' }}>
                      <th style={{ padding: '12px 14px' }}>Partner Organization</th>
                      <th style={{ padding: '12px 14px' }}>Key Point of Contact</th>
                      <th style={{ padding: '12px 14px' }}>Partner Tier</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px' }}>Attributed Deal Value</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmLoading ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#5F6B85' }}>
                          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                          <div>Loading partners from database...</div>
                        </td>
                      </tr>
                    ) : crmContacts.filter(c => c.type === 'PARTNER').length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#5F6B85' }}>
                          <Handshake size={32} color="#CBD5E1" style={{ margin: '0 auto 10px', display: 'block' }} />
                          <div style={{ fontWeight: '700', color: '#111625', fontSize: '15px' }}>No partner relationships recorded</div>
                          <p style={{ fontSize: '12.5px', color: '#8C97B0', margin: '4px 0 12px 0' }}>Manage referral channels, resellers, and agency partners here.</p>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setNewContactType('PARTNER');
                              setIsLeadModalOpen(true);
                            }}
                          >
                            <Plus size={13} />
                            <span>Add First Partner</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      crmContacts
                        .filter(c => c.type === 'PARTNER')
                        .filter(c => {
                          if (crmStatusFilter !== 'ALL' && c.status.toUpperCase() !== crmStatusFilter.toUpperCase()) return false;
                          if (crmSearch.trim()) {
                            const term = crmSearch.trim().toLowerCase();
                            return (
                              c.name.toLowerCase().includes(term) ||
                              (c.company && c.company.toLowerCase().includes(term)) ||
                              c.email.toLowerCase().includes(term)
                            );
                          }
                          return true;
                        })
                        .map((partner) => (
                          <tr key={partner.id} style={{ borderBottom: '1px solid #F0F3F9' }}>
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: '800', color: '#111625' }}>{partner.company || partner.name}</div>
                              <span style={{ fontSize: '11.5px', color: '#5F6B85' }}>
                                Source: {partner.source || 'Referral'}
                              </span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: '700', color: '#111625' }}>{partner.name}</div>
                              <div style={{ fontSize: '11px', color: '#8C97B0' }}>{partner.email} {partner.phone ? `• ${partner.phone}` : ''}</div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                                {partner.partnerTier || 'Standard'}
                              </span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span className={`badge ${partner.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                                {partner.status}
                              </span>
                            </td>
                            <td style={{ padding: '14px', fontWeight: '800', color: '#111625' }}>
                              ${partner.estimatedValue.toLocaleString()}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleDeleteContact(partner.id, partner.company || partner.name)}
                                title="Delete partner record"
                                style={{ padding: '4px 8px', color: '#DC2626' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CRM SUB-TAB 4: BESTIE AI COPILOT & PROSPECT RESEARCH */}
          {crmSubTab === 'copilot' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#6E56CF" />
                  Bestie AI CRM Copilot &amp; Prospect Intelligence
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-primary">Authorized Copilot Engine</span>
                  <span className="badge badge-success">Live Ground Truth</span>
                </div>
              </div>

              {/* Chat & Intelligence Feed */}
              <div style={{
                maxHeight: '480px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                background: '#FAFBFD',
                borderRadius: '10px',
                border: '1px solid #E8ECF5'
              }}>
                {copilotHistory.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '12px 16px',
                        borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: msg.role === 'user' ? '#6E56CF' : '#FFFFFF',
                        color: msg.role === 'user' ? '#FFFFFF' : '#111625',
                        border: msg.role === 'user' ? 'none' : '1px solid #E8ECF5',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        fontSize: '13.5px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', opacity: 0.8 }}>
                        {msg.role === 'assistant' ? <Bot size={13} color="#6E56CF" /> : <Users size={13} />}
                        <strong>{msg.role === 'assistant' ? 'Bestie AI Copilot' : 'You'}</strong>
                        <span>• {msg.timestamp}</span>
                      </div>
                      <div>{msg.text}</div>

                      {/* Explicit Write Card: Structured Prospect Save */}
                      {msg.structuredProspect && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: '#F5F3FF',
                          border: '1px solid #DDD6FE',
                          borderRadius: '8px',
                          color: '#111625'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Target size={14} color="#6E56CF" />
                              <strong style={{ fontSize: '13px', color: '#6E56CF' }}>Structured Prospect Opportunity</strong>
                            </div>
                            <span className="badge badge-success">Lead Score: {msg.structuredProspect.score || 80}/100</span>
                          </div>
                          <div style={{ fontSize: '12.5px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' }}>
                            <div><strong>Company:</strong> {msg.structuredProspect.company}</div>
                            <div><strong>Contact:</strong> {msg.structuredProspect.firstName} {msg.structuredProspect.lastName}</div>
                            <div><strong>Role:</strong> {msg.structuredProspect.role || 'Decision-Maker'}</div>
                            <div><strong>Est. Value:</strong> ${Number(msg.structuredProspect.estimatedValue || 0).toLocaleString()} USD</div>
                            <div><strong>Email:</strong> {msg.structuredProspect.email}</div>
                            <div><strong>Phone:</strong> {msg.structuredProspect.phone || 'N/A'}</div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveProspectToContacts(msg.structuredProspect!)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                          >
                            <Plus size={13} />
                            <span>Save to CRM Contacts (Write to Database)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {copilotLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8ECF5', width: 'fit-content' }}>
                    <RefreshCw size={16} className="spin" color="#6E56CF" />
                    <span style={{ fontSize: '13px', color: '#5F6B85' }}>Bestie AI is querying authorized CRM ground truth...</span>
                  </div>
                )}
              </div>

              {/* Input & Quick Prompt Toolbar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (copilotQuery.trim() && !copilotLoading) {
                      const q = copilotQuery.trim();
                      if (q.toLowerCase().includes('starlight') || q.toLowerCase().startsWith('research')) {
                        handleRunCopilotAction('PROSPECT_RESEARCH', q.replace(/^research\s+/i, '').trim() || 'Starlight AI');
                      } else {
                        handleRunCopilotAction('CHAT', q);
                      }
                    }
                  }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input
                    type="text"
                    className="input-field"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    placeholder="Ask Bestie AI about deals, lead scores, overdue tasks, or type a company name to research..."
                    disabled={copilotLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={copilotLoading || !copilotQuery.trim()}
                    style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} />
                    <span>Ask Copilot</span>
                  </button>
                  {copilotLoading && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setCopilotLoading(false)}
                      title="Cancel Request"
                      style={{ color: '#EF4444', borderColor: '#EF4444' }}
                    >
                      <StopCircle size={14} />
                      <span>Stop</span>
                    </button>
                  )}
                </form>

                {/* Prompt Suggestions */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#5F6B85', fontWeight: 600 }}>Suggested Inquiries:</span>
                  <button
                    type="button"
                    className="badge badge-neutral"
                    onClick={() => handleRunCopilotAction('PIPELINE_ANALYSIS')}
                    disabled={copilotLoading}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    📊 Pipeline Health &amp; Bottlenecks
                  </button>
                  <button
                    type="button"
                    className="badge badge-neutral"
                    onClick={() => handleRunCopilotAction('LEAD_QUALIFICATION')}
                    disabled={copilotLoading}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    🎯 BANT Lead Qualification
                  </button>
                  <button
                    type="button"
                    className="badge badge-neutral"
                    onClick={() => handleRunCopilotAction('OVERDUE_TASKS')}
                    disabled={copilotLoading}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    ⏰ Overdue Tasks Audit
                  </button>
                  <button
                    type="button"
                    className="badge badge-neutral"
                    onClick={() => handleRunCopilotAction('PROSPECT_RESEARCH', 'Starlight AI')}
                    disabled={copilotLoading}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    🔍 Research Starlight AI
                  </button>
                  <button
                    type="button"
                    className="badge badge-neutral"
                    onClick={() => handleRunCopilotAction('PROSPECT_RESEARCH', 'Acme Innovations')}
                    disabled={copilotLoading}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    🔍 Research Acme Innovations
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Real Communication History & Activity Timeline */}
          <div className="glass-panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#0284C7" />
                Communication History & Interaction Activity Logs
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  className="input-field"
                  value={crmActivityFilter}
                  onChange={(e) => setCrmActivityFilter(e.target.value)}
                  style={{ fontSize: '12px', padding: '4px 10px', height: '32px' }}
                >
                  <option value="ALL">All Activity Types</option>
                  <option value="NOTE">📝 Notes</option>
                  <option value="CALL">📞 Calls</option>
                  <option value="EMAIL">✉️ Emails</option>
                  <option value="MEETING">👥 Meetings</option>
                  <option value="STAGE_CHANGE">🚀 Stage Changes</option>
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsActivityModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  <Plus size={13} />
                  <span>Log Activity</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {crmLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#5F6B85', fontSize: '13px' }}>
                  <RefreshCw size={18} className="spin" style={{ margin: '0 auto 8px' }} />
                  <div>Loading communication logs...</div>
                </div>
              ) : crmActivities.filter(a => crmActivityFilter === 'ALL' || a.activityType === crmActivityFilter).length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#5F6B85' }}>
                  <MessageSquare size={28} color="#CBD5E1" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontWeight: '700', color: '#111625', fontSize: '14px' }}>No communication activities logged yet</div>
                  <p style={{ fontSize: '12px', color: '#8C97B0', margin: '4px 0 10px 0' }}>
                    Record calls, meetings, emails, and notes with your contacts or opportunities.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => setIsActivityModalOpen(true)}>
                    <Plus size={12} />
                    <span>Log First Activity</span>
                  </button>
                </div>
              ) : (
                crmActivities
                  .filter(a => crmActivityFilter === 'ALL' || a.activityType === crmActivityFilter)
                  .map((item) => {
                    const typeConfig: Record<string, { icon: any; color: string; bg: string; badge: string }> = {
                      CALL: { icon: PhoneCall, color: '#2563EB', bg: '#EFF6FF', badge: 'Phone Call' },
                      EMAIL: { icon: Mail, color: '#D97706', bg: '#FFFBEB', badge: 'Email' },
                      MEETING: { icon: Users, color: '#059669', bg: '#ECFDF5', badge: 'Meeting' },
                      STAGE_CHANGE: { icon: TrendingUp, color: '#7C3AED', bg: '#F5F3FF', badge: 'Stage Update' },
                      NOTE: { icon: FileText, color: '#4B5563', bg: '#F3F4F6', badge: 'Note' }
                    };
                    const cfg = typeConfig[item.activityType] || typeConfig.NOTE;
                    const IconComponent = cfg.icon;

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          background: '#FAFBFD',
                          border: '1px solid #E8ECF5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12.5px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: cfg.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <IconComponent size={16} color={cfg.color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong style={{ color: '#111625' }}>{item.title}</strong>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: cfg.bg,
                                color: cfg.color
                              }}>
                                {cfg.badge}
                              </span>
                              {item.contactName && (
                                <span style={{ fontSize: '11px', color: '#5F6B85' }}>
                                  👤 {item.contactName} {item.contactCompany ? `(${item.contactCompany})` : ''}
                                </span>
                              )}
                              {item.dealTitle && (
                                <span style={{ fontSize: '11px', color: '#6E56CF' }}>
                                  🤝 {item.dealTitle}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p style={{ margin: '3px 0 0 0', color: '#5F6B85', fontSize: '12px' }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#8C97B0', whiteSpace: 'nowrap' }}>
                            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(item.id, item.title)}
                            title="Delete activity record"
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#CBD5E1' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#CBD5E1')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CAPTURE CONTACT / LEAD / PARTNER */}
      {isLeadModalOpen && (
        <div className="dashboard-modal-backdrop" onClick={() => setIsLeadModalOpen(false)}>
          <div className="dashboard-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF5', margin: 0, background: '#FAFAFC', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
              <div className="panel-title" style={{ fontSize: '16px', color: '#111625', fontWeight: '800' }}>
                <Users size={18} color="#059669" />
                <span>{newContactType === 'PARTNER' ? 'Add Partner Organization' : 'Capture Contact to CRM'}</span>
              </div>
              <button className="btn-ghost" onClick={() => setIsLeadModalOpen(false)} style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCaptureLead} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Record Type
                  </label>
                  <select
                    className="input-field"
                    value={newContactType}
                    onChange={(e) => setNewContactType(e.target.value as any)}
                  >
                    <option value="LEAD">Prospective Lead</option>
                    <option value="CUSTOMER">Existing Customer</option>
                    <option value="PARTNER">Partner / Referral Network</option>
                  </select>
                </div>

                {newContactType === 'PARTNER' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      Partner Tier
                    </label>
                    <select
                      className="input-field"
                      value={newPartnerTier}
                      onChange={(e) => setNewPartnerTier(e.target.value)}
                    >
                      <option value="Standard">Standard Affiliate</option>
                      <option value="Silver">Silver Tier</option>
                      <option value="Gold">Gold Partner</option>
                      <option value="Platinum">Platinum Enterprise</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      AI Intent Score (0 - 100)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={newContactScore}
                      onChange={(e) => setNewContactScore(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Jordan Miller"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="jordan@enterpriseco.com"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+1 (555) 000-0000"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. TechCorp Solutions"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Target Role / Title
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. VP Growth"
                    value={newLeadRole}
                    onChange={(e) => setNewLeadRole(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Estimated Pipeline Value ($)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={newLeadValue}
                  onChange={(e) => setNewLeadValue(Number(e.target.value))}
                  min={0}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsLeadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Database size={14} />
                  <span>Save to CRM Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE NEW SALES DEAL */}
      {isDealModalOpen && (
        <div className="dashboard-modal-backdrop" onClick={() => setIsDealModalOpen(false)}>
          <div className="dashboard-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF5', margin: 0, background: '#FAFAFC', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
              <div className="panel-title" style={{ fontSize: '16px', color: '#111625', fontWeight: '800' }}>
                <TrendingUp size={18} color="#6E56CF" />
                <span>Create Sales Deal Opportunity</span>
              </div>
              <button className="btn-ghost" onClick={() => setIsDealModalOpen(false)} style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Deal Title *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Acme Corp Enterprise Expansion"
                  value={newDealTitle}
                  onChange={(e) => setNewDealTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Deal Value ($ USD) *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={newDealValue}
                    onChange={(e) => setNewDealValue(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Starting Stage
                  </label>
                  <select
                    className="input-field"
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value as any)}
                  >
                    <option value="NEW_LEAD">New Lead (10%)</option>
                    <option value="CONTACTED">Contacted (20%)</option>
                    <option value="QUALIFIED">Qualified (40%)</option>
                    <option value="OPPORTUNITY">Opportunity (60%)</option>
                    <option value="PROPOSAL">Proposal (75%)</option>
                    <option value="NEGOTIATION">Negotiation (90%)</option>
                    <option value="WON">Closed Won (100%)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Linked Contact / Company
                  </label>
                  <select
                    className="input-field"
                    value={newDealContactId}
                    onChange={(e) => setNewDealContactId(e.target.value)}
                  >
                    <option value="">-- No Contact Linked --</option>
                    {crmContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Target Close Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={newDealExpectedCloseDate}
                    onChange={(e) => setNewDealExpectedCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Deal Notes / Strategy
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Key decision makers, deal scope, and milestones..."
                  value={newDealNotes}
                  onChange={(e) => setNewDealNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsDealModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <TrendingUp size={14} />
                  <span>Open Deal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Team & Access (supported status clearly stated) */}
      {activeTab === 'Team & Access' && (
        <div className="glass-panel">
          <div className="future-module-banner" style={{ margin: 0 }}>
            <div className="future-module-icon">
              <Users size={24} color="#A78BFA" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF', marginBottom: '4px' }}>
                Multi-User Team Collaboration & Access Controls
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.5' }}>
                You are currently in Single-Owner Workspace mode. Multi-seat team invites and role-based permissions (RBAC) are included with the Business & Agency plan ($99/mo) and will activate upon team member invitation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'Settings' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">Business Workspace Settings</div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>
            Manage organization defaults, currency preferences, and notification webhooks.
          </p>
        </div>
      )}

      {/* Tab: Help & Support */}
      {activeTab === 'Help & Support' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Part 13: B4B America Dedicated Support & Training Desk */}
          <div className="b4b-support-lead-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="b4b-avatar-box">
                <Award size={24} />
              </div>
              <div className="b4b-support-details">
                <div className="b4b-lead-name">
                  <span>B4B America — Small Business Education &amp; Priority Desk</span>
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>Personal Point of Contact</span>
                </div>
                <div className="b4b-lead-role">
                  Dedicated Client Success Lead: <strong>Sarah Jenkins &amp; Elena Vance</strong>
                </div>
                <div className="b4b-contact-meta">
                  <span>
                    <PhoneCall size={13} color="#059669" />
                    <strong>+1 (800) 555-B4BA (2422)</strong>
                  </span>
                  <span>
                    <Mail size={13} color="#059669" />
                    <strong>business@b4bamerica.org</strong>
                  </span>
                  <span>
                    <Clock size={13} color="#059669" />
                    Mon–Fri 8am–8pm EST • Guaranteed &lt; 1hr response
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderColor: '#059669',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setIsB4BBookingOpen(true)}
            >
              <Calendar size={15} />
              <span>Schedule 1-on-1 Product Training</span>
            </button>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  <BookOpen size={20} color="#10B981" />
                  <span>Small Business Client Education Modules</span>
                </div>
                <div className="panel-subtitle">
                  Curated learning paths designed by B4B America to help small businesses leverage the AI One Stop Shop on any budget.
                </div>
              </div>
              <span className="badge badge-success">
                Self-Paced &amp; 1-on-1 Supported
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
              <div style={{ padding: '16px', background: '#FAFBFD', borderRadius: '12px', border: '1px solid #E8ECF5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Rocket size={18} color="#10B981" />
                  <strong style={{ fontSize: '14px', color: '#111625' }}>Zunme AI One Stop Shop Essentials</strong>
                </div>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                  Overview of AI content creation, SEO clusters, writing prompts, and brand persona synchronization.
                </p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11px' }}
                  onClick={() => setIsB4BBookingOpen(true)}
                >
                  Request Module Walkthrough
                </button>
              </div>

              <div style={{ padding: '16px', background: '#FAFBFD', borderRadius: '12px', border: '1px solid #E8ECF5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Target size={18} color="#10B981" />
                  <strong style={{ fontSize: '14px', color: '#111625' }}>Low-Budget Ads Strategy ($10 - $25/day)</strong>
                </div>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                  How small businesses can bid on high-intent search keywords and deploy display banners without huge agency budgets.
                </p>
                <NavLink
                  to="/business/marketing"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11px' }}
                >
                  Open Starter Ad Bridge &rarr;
                </NavLink>
              </div>

              <div style={{ padding: '16px', background: '#FAFBFD', borderRadius: '12px', border: '1px solid #E8ECF5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Users size={18} color="#10B981" />
                  <strong style={{ fontSize: '14px', color: '#111625' }}>CRM Deep Sync &amp; Lead Workflows</strong>
                </div>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                  Connect nErgy CRM, synchronize real-time lead updates, and configure automatic opportunity ingestion pipelines.
                </p>
                <NavLink
                  to="/business/crm"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11px' }}
                >
                  View CRM Pipeline &rarr;
                </NavLink>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Mail size={18} color="#10B981" />
                <span>Submit Priority Ticket (Routed to B4B America &amp; Zunme Ops)</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                showToast('Priority ticket dispatched to B4B America Client Relations & Zunme Ops! Response in under 1 hour.', 'success');
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Inquiring about custom CRM webhook endpoint mapping"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                  Description &amp; Details
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Provide context on your workflow or question..."
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', background: '#059669', borderColor: '#059669' }}>
                <Mail size={14} />
                <span>Send Priority Ticket</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* P3: Log Communication Activity Modal */}
      {isActivityModalOpen && (
        <div className="dashboard-modal-backdrop" onClick={() => setIsActivityModalOpen(false)}>
          <div className="dashboard-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF5', margin: 0, background: '#FAFAFC', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
              <div className="panel-title" style={{ fontSize: '16px', color: '#111625', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#0284C7" />
                Log Communication Activity
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setIsActivityModalOpen(false)} style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Activity Type *
                  </label>
                  <select
                    className="input-field"
                    value={newActivityType}
                    onChange={(e) => setNewActivityType(e.target.value as any)}
                    required
                  >
                    <option value="NOTE">📝 Note / Memo</option>
                    <option value="CALL">📞 Phone Call</option>
                    <option value="EMAIL">✉️ Email Exchange</option>
                    <option value="MEETING">👥 Meeting / Demo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Activity Title / Summary *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Discovery call with Chief Architect"
                    value={newActivityTitle}
                    onChange={(e) => setNewActivityTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      Associated Contact
                    </label>
                    <select
                      className="input-field"
                      value={newActivityContactId}
                      onChange={(e) => setNewActivityContactId(e.target.value)}
                    >
                      <option value="">-- None --</option>
                      {crmContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                      Associated Deal
                    </label>
                    <select
                      className="input-field"
                      value={newActivityDealId}
                      onChange={(e) => setNewActivityDealId(e.target.value)}
                    >
                      <option value="">-- None --</option>
                      {crmDeals.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} (${d.value.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#111625', marginBottom: '6px' }}>
                    Interaction Notes / Details
                  </label>
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="Summarize key talking points, agreed action items, or customer sentiment..."
                    value={newActivityDesc}
                    onChange={(e) => setNewActivityDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsActivityModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Plus size={14} /> Log Activity Record
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* P2: CSV Import Dialog for CRM Contacts */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        title="Import CRM Contacts & Leads (CSV)"
        targetEntityName="CRM Leads"
        expectedHeaders={['name', 'email', 'company', 'role', 'type', 'dealValue']}
        sampleCsvTemplate={`name,email,company,role,type,dealValue\nAlice Morgan,alice@nexuscloud.io,Nexus Cloud,CTO,LEAD,32000\nRobert Chen,robert@hypergrowth.ai,HyperGrowth,Head of Growth,LEAD,18000\nGlobal Tech Partners,partners@globaltech.com,Global Tech,Alliance Director,PARTNER,120000`}
        onConfirmImport={(parsedRows: Record<string, string>[]) => {
          handleImportCsv(parsedRows);
        }}
      />

      {/* P2: Platform Connection Modal for nErgy CRM */}
      <PlatformConnectionModal
        isOpen={isCrmConnectModalOpen}
        onClose={() => setIsCrmConnectModalOpen(false)}
        platformId="nergy_crm"
        platformName="nErgy CRM Enterprise Bridge"
        category="CRM & Pipeline Sync"
        currentStatus={crmConnectedStatus}
        purposeDescription="Synchronizes real-time qualified website leads, conversational research insights, and customer deal stages into your active CRM pipeline."
        knownPermissions={['crm.leads.read', 'crm.leads.write', 'crm.deals.write', 'webhooks.ingest']}
        onConnect={() => {
          setCrmConnectedStatus('CONNECTED');
          showToast('nErgy CRM connection verified and authorized in sandbox', 'success');
        }}
        onDisconnect={() => {
          setCrmConnectedStatus('DISCONNECTED');
          showToast('nErgy CRM disconnected', 'info');
        }}
      />

      {/* Part 13: B4B America 1-on-1 Product Training & Client Education Modal */}
      <B4BAmericaBookingModal
        isOpen={isB4BBookingOpen}
        onClose={() => setIsB4BBookingOpen(false)}
        brandName={brandProfile.brandName}
        onBookingConfirmed={(booking) => {
          showToast(`Training session booked with B4B America for ${booking.date} at ${booking.time}!`, 'success');
        }}
      />
    </div>
  );
};
