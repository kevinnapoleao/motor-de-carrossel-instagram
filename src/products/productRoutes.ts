import http from 'node:http';
import { ProductService } from './productService.js';
import { ProductFilterQuery } from './productTypes.js';
import { ZodError } from 'zod';

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 
    'Content-Type': 'application/json; charset=utf-8', 
    'Cache-Control': 'no-store' 
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req: http.IncomingMessage, maxBytes = 1024 * 1024): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw Object.assign(new Error('O corpo da requisição ultrapassa o limite permitido.'), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Corpo JSON inválido.'), { statusCode: 400 });
  }
}

export class ProductRoutes {
  private service: ProductService;

  constructor(service?: ProductService) {
    this.service = service || new ProductService();
  }

  /**
   * Handles incoming HTTP requests for `/api/products` endpoints.
   * Returns true if route was handled, false otherwise.
   */
  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
    if (!url.pathname.startsWith('/api/products')) {
      return false;
    }

    try {
      // GET /api/products
      if (req.method === 'GET' && url.pathname === '/api/products') {
        const query = url.searchParams;
        const filters: ProductFilterQuery = {
          page: query.has('page') ? Number(query.get('page')) : undefined,
          limit: query.has('limit') ? Number(query.get('limit')) : undefined,
          search: query.get('search') || undefined,
          category: query.get('category') || undefined,
          minPrice: query.has('minPrice') ? Number(query.get('minPrice')) : undefined,
          maxPrice: query.has('maxPrice') ? Number(query.get('maxPrice')) : undefined,
          sortBy: (query.get('sortBy') as any) || undefined,
          sortOrder: (query.get('sortOrder') as any) || undefined,
        };

        const result = this.service.listProducts(filters);
        json(res, 200, { success: true, ...result });
        return true;
      }

      // POST /api/products
      if (req.method === 'POST' && url.pathname === '/api/products') {
        const body = await readBody(req);
        const product = this.service.createProduct(body);
        json(res, 201, { success: true, product });
        return true;
      }

      const idMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
      if (idMatch) {
        const productId = decodeURIComponent(idMatch[1]);

        // GET /api/products/:id
        if (req.method === 'GET') {
          const product = this.service.getProductById(productId);
          if (!product) {
            json(res, 404, { success: false, error: 'Produto não encontrado.' });
            return true;
          }
          json(res, 200, { success: true, product });
          return true;
        }

        // PUT or PATCH /api/products/:id
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const body = await readBody(req);
          const product = this.service.updateProduct(productId, body);
          if (!product) {
            json(res, 404, { success: false, error: 'Produto não encontrado para atualização.' });
            return true;
          }
          json(res, 200, { success: true, product });
          return true;
        }

        // DELETE /api/products/:id
        if (req.method === 'DELETE') {
          const deleted = this.service.deleteProduct(productId);
          if (!deleted) {
            json(res, 404, { success: false, error: 'Produto não encontrado para remoção.' });
            return true;
          }
          json(res, 200, { success: true, message: 'Produto removido com sucesso.', id: productId });
          return true;
        }
      }

      return false;
    } catch (error: any) {
      if (error instanceof ZodError) {
        json(res, 400, {
          success: false,
          error: 'Falha de validação dos dados do produto.',
          issues: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
        return true;
      }

      const status = error.statusCode || 500;
      json(res, status, {
        success: false,
        error: error.message || 'Erro interno ao processar produto.'
      });
      return true;
    }
  }
}
