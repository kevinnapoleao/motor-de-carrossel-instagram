import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { 
  Product, 
  CreateProductInput, 
  UpdateProductInput, 
  ProductFilterQuery,
  CreateProductSchema,
  UpdateProductSchema
} from './productTypes.js';

export class ProductService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.resolve(process.cwd(), 'database.sqlite');
    this.db = new Database(finalPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(createdAt);
    `);
  }

  public listProducts(filters: ProductFilterQuery = {}): {
    items: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.search && filters.search.trim()) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    if (filters.category && filters.category.trim()) {
      conditions.push('category = ?');
      params.push(filters.category.trim());
    }

    if (typeof filters.minPrice === 'number' && !isNaN(filters.minPrice)) {
      conditions.push('price >= ?');
      params.push(filters.minPrice);
    }

    if (typeof filters.maxPrice === 'number' && !isNaN(filters.maxPrice)) {
      conditions.push('price <= ?');
      params.push(filters.maxPrice);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`);
    const { total } = countStmt.get(...params) as { total: number };

    // Sorting
    const validSortFields: Record<string, string> = {
      name: 'name',
      price: 'price',
      stock: 'stock',
      createdAt: 'createdAt'
    };
    const sortField = filters.sortBy && validSortFields[filters.sortBy] ? validSortFields[filters.sortBy] : 'createdAt';
    const sortDir = filters.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Pagination
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const listStmt = this.db.prepare(`
      SELECT * FROM products
      ${whereClause}
      ORDER BY ${sortField} ${sortDir}
      LIMIT ? OFFSET ?
    `);

    const items = listStmt.all(...params, limit, offset) as Product[];

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  public getProductById(id: string): Product | null {
    const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
    const row = stmt.get(id) as Product | undefined;
    return row || null;
  }

  public createProduct(data: unknown): Product {
    const validated: CreateProductInput = CreateProductSchema.parse(data);
    const id = `prod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO products (id, name, description, price, stock, category, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      validated.name,
      validated.description || '',
      validated.price,
      validated.stock ?? 0,
      validated.category,
      now,
      now
    );

    return this.getProductById(id)!;
  }

  public updateProduct(id: string, data: unknown): Product | null {
    const existing = this.getProductById(id);
    if (!existing) {
      return null;
    }

    const validated: UpdateProductInput = UpdateProductSchema.parse(data);
    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (validated.name !== undefined) {
      updates.push('name = ?');
      params.push(validated.name);
    }
    if (validated.description !== undefined) {
      updates.push('description = ?');
      params.push(validated.description);
    }
    if (validated.price !== undefined) {
      updates.push('price = ?');
      params.push(validated.price);
    }
    if (validated.stock !== undefined) {
      updates.push('stock = ?');
      params.push(validated.stock);
    }
    if (validated.category !== undefined) {
      updates.push('category = ?');
      params.push(validated.category);
    }

    updates.push('updatedAt = ?');
    params.push(now);

    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE products
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);

    return this.getProductById(id);
  }

  public deleteProduct(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public close(): void {
    this.db.close();
  }
}
