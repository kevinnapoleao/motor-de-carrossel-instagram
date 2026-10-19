import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ProductRoutes } from '../src/products/productRoutes.js';
import { ProductService } from '../src/products/productService.js';
import { Product } from '../src/products/productTypes.js';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: http.IncomingHttpHeaders;
}

describe('Suíte de Testes da API de Produtos (CRUD, Validações & Regras de Negócio)', () => {
  let server: http.Server;
  let baseUrl: string;
  let service: ProductService;
  const testDbPath = path.resolve(process.cwd(), 'tests', 'test-products-suite.sqlite');

  // Helper para fazer requisições HTTP locais contra o servidor de teste
  async function makeRequest<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = new URL(options.path, baseUrl);
      const reqHeaders: Record<string, string> = {
        'Accept': 'application/json',
        ...(options.headers || {})
      };

      let bodyData: string | undefined;
      if (options.body !== undefined) {
        bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(bodyData).toString();
      }

      const req = http.request(
        url,
        {
          method: options.method,
          headers: reqHeaders,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            let parsedBody: any;
            try {
              parsedBody = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              parsedBody = rawBody;
            }

            resolve({
              status: res.statusCode || 500,
              data: parsedBody,
              headers: res.headers,
            });
          });
        }
      );

      req.on('error', reject);

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  before(async () => {
    // Limpeza inicial do banco de testes
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }

    service = new ProductService(testDbPath);
    const routes = new ProductRoutes(service);

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const handled = await routes.handleRequest(req, res, url);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint não encontrado.' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    service.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  // Limpa os registros da tabela antes de cada bloco de testes para isolamento
  beforeEach(() => {
    const list = service.listProducts({ limit: 100 });
    for (const item of list.items) {
      service.deleteProduct(item.id);
    }
  });

  // =========================================================================
  // 1. LISTAGEM DE PRODUTOS
  // =========================================================================
  describe('GET /api/products (Listagem)', () => {
    it('deve retornar status 200 e array vazio quando não houver produtos cadastrados', async () => {
      const res = await makeRequest({ method: 'GET', path: '/api/products' });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.items), 'items deve ser um array');
      assert.equal(res.data.items.length, 0);
      assert.equal(res.data.total, 0);
      assert.equal(res.data.page, 1);
    });

    it('deve retornar lista com produtos cadastrados, contendo os campos obrigatórios', async () => {
      service.createProduct({
        name: 'Teclado Mecânico RGB',
        description: 'Teclado para digitação ágil',
        price: 250.00,
        stock: 10,
        category: 'Periféricos'
      });
      service.createProduct({
        name: 'Mouse Gamer Wireless',
        description: 'Mouse ultraleve',
        price: 180.50,
        stock: 25,
        category: 'Periféricos'
      });

      const res = await makeRequest({ method: 'GET', path: '/api/products' });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.total, 2);
      assert.equal(res.data.items.length, 2);

      const item = res.data.items[0];
      assert.ok(item.id);
      assert.ok(item.name);
      assert.equal(typeof item.price, 'number');
      assert.equal(typeof item.stock, 'number');
      assert.ok(item.category);
      assert.ok(item.createdAt);
      assert.ok(item.updatedAt);
    });

    it('deve filtrar produtos por categoria com exatidão', async () => {
      service.createProduct({ name: 'Webcam 4K', price: 400, stock: 5, category: 'Vídeo' });
      service.createProduct({ name: 'Microfone Condensador', price: 350, stock: 8, category: 'Áudio' });
      service.createProduct({ name: 'Fone de Ouvido', price: 150, stock: 20, category: 'Áudio' });

      const resAudio = await makeRequest({ method: 'GET', path: '/api/products?category=Áudio' });
      assert.equal(resAudio.status, 200);
      assert.equal(resAudio.data.total, 2);
      assert.ok(resAudio.data.items.every((p: Product) => p.category === 'Áudio'));

      const resVideo = await makeRequest({ method: 'GET', path: '/api/products?category=Vídeo' });
      assert.equal(resVideo.status, 200);
      assert.equal(resVideo.data.total, 1);
      assert.equal(resVideo.data.items[0].name, 'Webcam 4K');
    });

    it('deve filtrar por termo de busca no nome ou descrição', async () => {
      service.createProduct({ name: 'Monitor Gamer 144Hz', description: 'Painel IPS', price: 1200, stock: 4, category: 'Monitores' });
      service.createProduct({ name: 'Suporte de Monitor', description: 'Gamer articulado com pistão a gás', price: 199, stock: 12, category: 'Acessórios' });
      service.createProduct({ name: 'Cadeira Escritório', description: 'Ergonômica NR17', price: 899, stock: 7, category: 'Móveis' });

      const res = await makeRequest({ method: 'GET', path: '/api/products?search=Gamer' });
      assert.equal(res.status, 200);
      assert.equal(res.data.total, 2);
      const names = res.data.items.map((i: Product) => i.name);
      assert.ok(names.includes('Monitor Gamer 144Hz'));
      assert.ok(names.includes('Suporte de Monitor'));
    });

    it('deve filtrar por faixa de preço (minPrice e maxPrice)', async () => {
      service.createProduct({ name: 'Item Barato', price: 50, stock: 10, category: 'Geral' });
      service.createProduct({ name: 'Item Médio', price: 250, stock: 10, category: 'Geral' });
      service.createProduct({ name: 'Item Caro', price: 900, stock: 10, category: 'Geral' });

      const res = await makeRequest({ method: 'GET', path: '/api/products?minPrice=100&maxPrice=500' });
      assert.equal(res.status, 200);
      assert.equal(res.data.total, 1);
      assert.equal(res.data.items[0].name, 'Item Médio');
    });

    it('deve respeitar paginação (page e limit)', async () => {
      for (let i = 1; i <= 5; i++) {
        service.createProduct({ name: `Produto ${i}`, price: i * 10, stock: i, category: 'Geral' });
      }

      const resPage1 = await makeRequest({ method: 'GET', path: '/api/products?page=1&limit=2' });
      assert.equal(resPage1.status, 200);
      assert.equal(resPage1.data.items.length, 2);
      assert.equal(resPage1.data.total, 5);
      assert.equal(resPage1.data.totalPages, 3);

      const resPage2 = await makeRequest({ method: 'GET', path: '/api/products?page=2&limit=2' });
      assert.equal(resPage2.status, 200);
      assert.equal(resPage2.data.items.length, 2);
      assert.notEqual(resPage1.data.items[0].id, resPage2.data.items[0].id);
    });
  });

  // =========================================================================
  // 2. CRIAÇÃO DE PRODUTO (POST /api/products)
  // =========================================================================
  describe('POST /api/products (Criação & Validações)', () => {
    it('deve criar um produto com sucesso quando o payload for válido', async () => {
      const payload = {
        name: 'Placa de Vídeo RTX 4070',
        description: '12GB GDDR6X, DLSS 3',
        price: 4399.99,
        stock: 3,
        category: 'Hardware'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payload
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.ok(res.data.product.id.startsWith('prod_'));
      assert.equal(res.data.product.name, payload.name);
      assert.equal(res.data.product.price, 4399.99);
      assert.equal(res.data.product.stock, 3);
      assert.equal(res.data.product.category, payload.category);
      assert.ok(res.data.product.createdAt);
      assert.ok(res.data.product.updatedAt);

      // Verificação de persistência no banco
      const persisted = service.getProductById(res.data.product.id);
      assert.ok(persisted);
      assert.equal(persisted?.name, payload.name);
    });

    it('deve usar valores padrão para descrição (string vazia) e estoque (0) se omitidos', async () => {
      const payload = {
        name: 'Cabo HDMI 2.1 Ultra High Speed',
        price: 45.90,
        category: 'Cabos'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payload
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.product.description, '');
      assert.equal(res.data.product.stock, 0);
    });

    it('deve retornar 400 ao tentar criar produto com preço negativo', async () => {
      const payload = {
        name: 'Produto Teste Preço Negativo',
        price: -50,
        category: 'Testes'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payload
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.ok(res.data.issues);
      const priceIssue = res.data.issues.find((i: any) => i.field === 'price');
      assert.ok(priceIssue, 'Deve reportar issue no campo price');
      assert.match(priceIssue.message, /não pode ser negativo/i);
    });

    it('deve retornar 400 quando campos obrigatórios estiverem ausentes (name, price, category)', async () => {
      const payload = {
        description: 'Sem nome, sem preço e sem categoria'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payload
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      const fields = res.data.issues.map((i: any) => i.field);
      assert.ok(fields.includes('name'), 'Deve indicar ausência de name');
      assert.ok(fields.includes('price'), 'Deve indicar ausência de price');
      assert.ok(fields.includes('category'), 'Deve indicar ausência de category');
    });

    it('deve retornar 400 se o nome for muito curto (< 2 caracteres)', async () => {
      const payload = {
        name: 'A',
        price: 100,
        category: 'Geral'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payload
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      const nameIssue = res.data.issues.find((i: any) => i.field === 'name');
      assert.ok(nameIssue);
      assert.match(nameIssue.message, /mínimo 2 caracteres/i);
    });

    it('deve retornar 400 se o estoque for número com casas decimais ou negativo', async () => {
      const payloadDecimal = {
        name: 'Produto Estoque Fracionado',
        price: 99.00,
        stock: 3.5,
        category: 'Geral'
      };

      const resDecimal = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payloadDecimal
      });

      assert.equal(resDecimal.status, 400);
      const stockIssue = resDecimal.data.issues.find((i: any) => i.field === 'stock');
      assert.ok(stockIssue);
      assert.match(stockIssue.message, /número inteiro/i);

      const payloadNeg = {
        name: 'Produto Estoque Negativo',
        price: 99.00,
        stock: -2,
        category: 'Geral'
      };

      const resNeg = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: payloadNeg
      });

      assert.equal(resNeg.status, 400);
      const stockNegIssue = resNeg.data.issues.find((i: any) => i.field === 'stock');
      assert.ok(stockNegIssue);
    });

    it('deve retornar 400 ao receber um JSON malformado', async () => {
      const res = await makeRequest({
        method: 'POST',
        path: '/api/products',
        body: '{ malformed json: true, ',
        headers: { 'Content-Type': 'application/json' }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /JSON inválido/i);
    });
  });

  // =========================================================================
  // 3. BUSCA DE PRODUTO POR ID (GET /api/products/:id)
  // =========================================================================
  describe('GET /api/products/:id (Busca por ID)', () => {
    it('deve retornar 200 e os dados corretos do produto para ID existente', async () => {
      const created = service.createProduct({
        name: 'Processador AMD Ryzen 7 7800X3D',
        description: 'V-Cache 3D, AM5',
        price: 2899.00,
        stock: 14,
        category: 'Processadores'
      });

      const res = await makeRequest({
        method: 'GET',
        path: `/api/products/${created.id}`
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.product.id, created.id);
      assert.equal(res.data.product.name, created.name);
      assert.equal(res.data.product.price, 2899.00);
      assert.equal(res.data.product.category, 'Processadores');
    });

    it('deve retornar 404 para ID inexistente', async () => {
      const res = await makeRequest({
        method: 'GET',
        path: '/api/products/prod_inexistente_999999'
      });

      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /não encontrado/i);
    });
  });

  // =========================================================================
  // 4. ATUALIZAÇÃO DE PRODUTO (PUT / PATCH /api/products/:id)
  // =========================================================================
  describe('PUT/PATCH /api/products/:id (Atualização & Validações)', () => {
    it('deve atualizar parcialmente os campos do produto com sucesso', async () => {
      const product = service.createProduct({
        name: 'SSD NVMe 1TB',
        description: 'Leitura 3500MB/s',
        price: 499.00,
        stock: 20,
        category: 'Armazenamento'
      });

      const updatePayload = {
        price: 429.00,
        stock: 18
      };

      const res = await makeRequest({
        method: 'PUT',
        path: `/api/products/${product.id}`,
        body: updatePayload
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.product.id, product.id);
      assert.equal(res.data.product.price, 429.00);
      assert.equal(res.data.product.stock, 18);
      assert.equal(res.data.product.name, 'SSD NVMe 1TB'); // Preservado
      assert.equal(res.data.product.category, 'Armazenamento'); // Preservado

      // updatedAt deve ter sido atualizado
      assert.ok(new Date(res.data.product.updatedAt).getTime() >= new Date(product.updatedAt).getTime());
    });

    it('deve suportar o método PATCH equivalentemente', async () => {
      const product = service.createProduct({
        name: 'Roteador Wi-Fi 6',
        price: 320.00,
        stock: 10,
        category: 'Rede'
      });

      const res = await makeRequest({
        method: 'PATCH',
        path: `/api/products/${product.id}`,
        body: { name: 'Roteador Wi-Fi 6 AX3000 Gigabit' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.product.name, 'Roteador Wi-Fi 6 AX3000 Gigabit');
    });

    it('deve retornar 404 ao tentar atualizar um produto que não existe', async () => {
      const res = await makeRequest({
        method: 'PUT',
        path: '/api/products/prod_inexistente_888',
        body: { price: 199.99 }
      });

      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /não encontrado/i);
    });

    it('deve retornar 400 ao tentar atualizar com payload vazio (nenhum campo fornecido)', async () => {
      const product = service.createProduct({
        name: 'Hub USB-C 7 em 1',
        price: 150.00,
        stock: 10,
        category: 'Acessórios'
      });

      const res = await makeRequest({
        method: 'PUT',
        path: `/api/products/${product.id}`,
        body: {}
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /Falha de validação/i);
    });

    it('deve retornar 400 ao tentar atualizar preço para valor negativo', async () => {
      const product = service.createProduct({
        name: 'Mousepad Gamer Extra Grande',
        price: 89.90,
        stock: 15,
        category: 'Acessórios'
      });

      const res = await makeRequest({
        method: 'PUT',
        path: `/api/products/${product.id}`,
        body: { price: -10 }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      const priceIssue = res.data.issues.find((i: any) => i.field === 'price');
      assert.ok(priceIssue);
      assert.match(priceIssue.message, /não pode ser negativo/i);
    });
  });

  // =========================================================================
  // 5. REMOÇÃO DE PRODUTO (DELETE /api/products/:id)
  // =========================================================================
  describe('DELETE /api/products/:id (Remoção & Verificação pós-exclusão)', () => {
    it('deve remover o produto com sucesso e retornar 404 em busca subsequente', async () => {
      const product = service.createProduct({
        name: 'Caixa de Som Bluetooth 20W',
        price: 219.00,
        stock: 6,
        category: 'Áudio'
      });

      // 1. Deletar
      const deleteRes = await makeRequest({
        method: 'DELETE',
        path: `/api/products/${product.id}`
      });

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.data.success, true);
      assert.equal(deleteRes.data.id, product.id);
      assert.match(deleteRes.data.message, /removido com sucesso/i);

      // 2. Verificação pós-exclusão via GET
      const getRes = await makeRequest({
        method: 'GET',
        path: `/api/products/${product.id}`
      });

      assert.equal(getRes.status, 404);
      assert.equal(getRes.data.success, false);

      // 3. Verificação de ausência na listagem
      const listRes = await makeRequest({
        method: 'GET',
        path: '/api/products'
      });
      const existsInList = listRes.data.items.some((p: Product) => p.id === product.id);
      assert.equal(existsInList, false, 'Produto não deve estar presente na listagem');
    });

    it('deve retornar 404 ao tentar remover um ID que não existe', async () => {
      const res = await makeRequest({
        method: 'DELETE',
        path: '/api/products/prod_inexistente_777'
      });

      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /não encontrado/i);
    });
  });
});
