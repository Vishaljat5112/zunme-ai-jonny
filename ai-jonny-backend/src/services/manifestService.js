import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANDIDATE_PATHS = [
  path.resolve(__dirname, '../../../products.json'),
  path.resolve(__dirname, '../../../../products.json'),
  path.resolve(process.cwd(), 'products.json')
];

/**
 * ManifestService
 * 
 * Manages SaaS product manifests, domain definitions, and multi-tenant scoping.
 */
export class ManifestService {
  static cachedManifest = null;
  static lastLoadTime = 0;

  /**
   * Load products.json manifest.
   */
  static async loadProducts(forceReload = false) {
    const now = Date.now();
    if (!forceReload && this.cachedManifest && now - this.lastLoadTime < 30000) {
      return this.cachedManifest;
    }

    for (const filePath of CANDIDATE_PATHS) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        this.cachedManifest = data.products || [];
        this.lastLoadTime = now;
        return this.cachedManifest;
      } catch {
        // Try next candidate
      }
    }

    console.warn('[ManifestService] Could not load products.json from candidate paths.');
    return [];
  }

  /**
   * List all products.
   */
  static async listProducts() {
    return this.loadProducts();
  }

  /**
   * Get single product by ID or category.
   */
  static async getProduct(identifier) {
    const products = await this.loadProducts();
    return (
      products.find(
        (p) =>
          p.id?.toLowerCase() === identifier.toLowerCase() ||
          p.category?.toLowerCase() === identifier.toLowerCase() ||
          p.name?.toLowerCase().includes(identifier.toLowerCase())
      ) || null
    );
  }

  /**
   * Register or update a product manifest in-memory.
   */
  static async registerProduct(productData) {
    if (!productData || !productData.id || !productData.name) {
      throw new Error('Invalid product manifest: id and name are required.');
    }

    const products = await this.loadProducts();
    const existingIndex = products.findIndex((p) => p.id === productData.id);

    if (existingIndex >= 0) {
      products[existingIndex] = { ...products[existingIndex], ...productData, updatedAt: new Date().toISOString() };
    } else {
      products.push({
        ...productData,
        status: productData.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    this.cachedManifest = products;
    return productData;
  }
}
