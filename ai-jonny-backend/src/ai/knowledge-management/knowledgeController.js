import { KnowledgePipelineService } from './knowledgePipelineService.js';
import { SoftwareRegistry } from '../orchestrator/softwareRegistry.js';

export class KnowledgeController {
  /**
   * List all registered software ecosystems and their knowledge lifecycle status.
   */
  static async listSoftwares(req, res, next) {
    try {
      const softwares = SoftwareRegistry.listAllSoftwares();
      res.json({ success: true, softwares });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List documents for a given software ecosystem.
   */
  static async listDocuments(req, res, next) {
    try {
      const { softwareId } = req.query;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId is required' });
      }
      const documents = await KnowledgePipelineService.listDocuments({
        softwareId,
        tenantId: req.user?.tenantId || null
      });
      res.json({ success: true, documents });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload and stage a new document for a software ecosystem.
   */
  static async uploadDocument(req, res, next) {
    try {
      const { softwareId, documentName, documentType, content } = req.body;
      const document = await KnowledgePipelineService.uploadDocument({
        softwareId,
        tenantId: req.user?.tenantId || 'default_tenant',
        documentName,
        documentType: documentType || 'markdown',
        content,
        uploadUser: req.user?.id || 'admin'
      });
      res.status(201).json({ success: true, document });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a document.
   */
  static async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { softwareId } = req.query;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId query param is required' });
      }
      const result = await KnowledgePipelineService.deleteDocument({
        id,
        softwareId,
        userId: req.user?.id || 'admin'
      });
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Index knowledge documents for a software ecosystem.
   */
  static async indexSoftware(req, res, next) {
    try {
      const { softwareId } = req.body;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId is required' });
      }
      const result = await KnowledgePipelineService.indexSoftwareKnowledge({
        softwareId,
        userId: req.user?.id || 'admin'
      });
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Evaluate retrieval quality on test questions.
   */
  static async testKnowledge(req, res, next) {
    try {
      const { softwareId, testQuestion, expectedAnswer } = req.body;
      if (!softwareId || !testQuestion) {
        return res.status(400).json({ success: false, error: 'softwareId and testQuestion are required' });
      }
      const evaluation = await KnowledgePipelineService.testKnowledgeRetrieval({
        softwareId,
        testQuestion,
        expectedAnswer,
        testedBy: req.user?.id || 'admin'
      });
      res.json({ success: true, evaluation });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Publish the verified draft knowledge version.
   */
  static async publishVersion(req, res, next) {
    try {
      const { softwareId } = req.body;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId is required' });
      }
      const publication = await KnowledgePipelineService.publishKnowledgeVersion({
        softwareId,
        userId: req.user?.id || 'admin'
      });
      res.json({ success: true, publication });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Rollback knowledge version.
   */
  static async rollbackVersion(req, res, next) {
    try {
      const { softwareId, targetVersion } = req.body;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId is required' });
      }
      const rollback = await KnowledgePipelineService.rollbackKnowledgeVersion({
        softwareId,
        userId: req.user?.id || 'admin',
        targetVersion
      });
      res.json({ success: true, rollback });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List version history.
   */
  static async listVersions(req, res, next) {
    try {
      const { softwareId } = req.query;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId query param is required' });
      }
      const versions = await KnowledgePipelineService.listVersions({ softwareId });
      res.json({ success: true, versions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List audit logs.
   */
  static async listAuditLogs(req, res, next) {
    try {
      const { softwareId, limit = 50 } = req.query;
      if (!softwareId) {
        return res.status(400).json({ success: false, error: 'softwareId query param is required' });
      }
      const logs = await KnowledgePipelineService.listAuditLogs({ softwareId, limit });
      res.json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }
}

